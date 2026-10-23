// Suivi du plan de prévention (module A3, décisions de Michelle du 21/10/2026) :
// - adoption par l'employeur : référent signataire, ou conseiller en prévention si le signataire a délégué ;
//   organe consulté selon le pays ; le plan adopté ne se modifie plus (nouvelle version) ;
// - avancement des actions : IMA et le conseiller en prévention seulement ;
// - tableau de bord : réalisées, en retard, par trimestre ;
// - rappel trimestriel par e-mail au conseiller en prévention (aucun contenu du plan dans l'e-mail).
// Les règles sont aussi imposées par la base (migration 0014).
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { journaliser } from "../audit";
import { auditLog, organizations, planActionStatus, preventionPlans, reports, users } from "../db/schema";
import type { Db } from "../db/types";
import { envoyerEmail, type Email } from "../email/brevo";
import { emailIMA } from "../email/modele";
import { rapportPourReferent } from "../rapport/entreprise";
import type { Resultat } from "../rapport/rapports";
import { traducteur } from "../traduction";
import { lireContenuPlan, type ContenuPlan } from "./contenu";
import { lirePlans } from "./plans";

type Utilisateur = typeof users.$inferSelect;
type Plan = typeof preventionPlans.$inferSelect;

// --- Organe consulté, selon le pays ------------------------------------------------------------

export const ORGANES: Record<string, string[]> = {
  BE: ["cppt", "delegation_syndicale", "travailleurs"],
  FR: ["cse", "aucun_cse"],
  BR: ["cipa", "participation_travailleurs"],
  PT: ["representants_sst", "travailleurs"],
};

// --- Accès d'un référent au plan validé -----------------------------------------------------------

// Le référent peut-il signer pour ce plan (signataire de la campagne du rapport de référence, ou délégation) ?
async function peutAdopter(db: Db, u: Utilisateur, plan: Plan) {
  if (u.role !== "referent" || !plan.reportId) return false;
  const [r] = await db.select({ campaignId: reports.campaignId }).from(reports).where(eq(reports.id, plan.reportId));
  if (!r) return false;
  return (await rapportPourReferent(db, u.id, r.campaignId))?.peutSigner ?? false;
}

// Plan validé visible par un référent : le conseiller en prévention, et le signataire (pour l'adopter)
export async function planPourReferentSuivi(db: Db, u: Utilisateur) {
  if (u.role !== "referent" || !u.organizationId || u.disabledAt) return null;
  const { valide } = await lirePlans(db, u.organizationId);
  if (!valide) return null;
  const adoption = await peutAdopter(db, u, valide);
  if (!u.preventionAdvisor && !adoption) return null;
  return { plan: valide, peutAdopter: adoption && !valide.adoptedAt, peutSuivre: u.preventionAdvisor };
}

// --- Adoption ---------------------------------------------------------------------------------

const jour = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export async function adopterPlan(
  db: Db,
  u: Utilisateur,
  planId: string,
  saisie: { adopteLe: string; organe: string; avisLe: string },
  maintenant = new Date(),
): Promise<Resultat> {
  const [plan] = await db.select().from(preventionPlans).where(eq(preventionPlans.id, planId));
  if (!plan || plan.status !== "validated") return { ok: false, erreur: "introuvable" };
  if (plan.adoptedAt) return { ok: false, erreur: "planDejaAdopte" };
  if (!(await peutAdopter(db, u, plan))) return { ok: false, erreur: "signataireRequis" };
  const aujourdhui = maintenant.toISOString().slice(0, 10);
  const adopte = jour.safeParse(saisie.adopteLe);
  const avis = jour.safeParse(saisie.avisLe);
  if (!adopte.success || !(ORGANES[plan.country] ?? []).includes(saisie.organe)) return { ok: false, erreur: "saisieInvalide" };
  // France sans CSE : pas de date d'avis ; sinon date d'avis obligatoire, antérieure ou égale à l'adoption
  const sansAvis = saisie.organe === "aucun_cse";
  if (!sansAvis && (!avis.success || avis.data > adopte.data)) return { ok: false, erreur: "adoptionDates" };
  if (adopte.data > aujourdhui) return { ok: false, erreur: "adoptionDates" };
  await db
    .update(preventionPlans)
    .set({
      adoptedBy: u.id,
      adoptedAt: adopte.data,
      consultationBody: saisie.organe,
      consultationDate: sansAvis ? null : avis.data!,
      updatedAt: maintenant,
    })
    .where(eq(preventionPlans.id, planId));
  await journaliser(db, { actorUserId: u.id, action: "plan_adopted", targetType: "organization", targetId: plan.organizationId, details: { organe: saisie.organe } });
  return { ok: true, valeur: undefined };
}

// --- Avancement des actions -------------------------------------------------------------------

export const STATUTS_ACTION = ["a_faire", "en_cours", "realisee", "reportee", "abandonnee"] as const;
export type StatutAction = (typeof STATUTS_ACTION)[number];

const sansCoordonnees = (s: string) => !/[^\s@]+@[^\s@]+\.[^\s@]+/.test(s) && !/(\+?\d[\s.-]?){8,}/.test(s);

export async function majAvancement(
  db: Db,
  u: Utilisateur,
  planId: string,
  actionId: string,
  saisie: { statut: string; realiseeLe?: string; commentaire?: string },
  maintenant = new Date(),
): Promise<Resultat> {
  const [plan] = await db.select().from(preventionPlans).where(eq(preventionPlans.id, planId));
  if (!plan || plan.status !== "validated") return { ok: false, erreur: "introuvable" };
  const peut = u.role === "admin" || (u.role === "referent" && u.preventionAdvisor && u.organizationId === plan.organizationId);
  if (!peut || u.disabledAt) return { ok: false, erreur: "introuvable" };
  const contenu = lireContenuPlan(plan.content);
  if (!contenu?.actions.some((a) => a.id === actionId)) return { ok: false, erreur: "introuvable" };
  const statut = z.enum(STATUTS_ACTION).safeParse(saisie.statut);
  if (!statut.success) return { ok: false, erreur: "saisieInvalide" };
  const commentaire = (saisie.commentaire ?? "").trim();
  if (commentaire.length > 500) return { ok: false, erreur: "saisieInvalide" };
  if (!sansCoordonnees(commentaire)) return { ok: false, erreur: "risqueCoordonnees" };
  let realiseeLe: string | null = null;
  if (statut.data === "realisee") {
    const d = jour.safeParse(saisie.realiseeLe || maintenant.toISOString().slice(0, 10));
    if (!d.success || d.data > maintenant.toISOString().slice(0, 10)) return { ok: false, erreur: "adoptionDates" };
    realiseeLe = d.data;
  }
  const [avant] = await db
    .select({ status: planActionStatus.status })
    .from(planActionStatus)
    .where(and(eq(planActionStatus.planId, planId), eq(planActionStatus.actionId, actionId)));
  const valeurs = { status: statut.data, doneOn: realiseeLe, comment: commentaire || null, updatedBy: u.id, updatedAt: maintenant };
  await db
    .insert(planActionStatus)
    .values({ planId, actionId, ...valeurs })
    .onConflictDoUpdate({ target: [planActionStatus.planId, planActionStatus.actionId], set: valeurs });
  await journaliser(db, {
    actorUserId: u.id,
    action: "plan_action_updated",
    targetType: "organization",
    targetId: plan.organizationId,
    details: { action: actionId, avant: avant?.status ?? "a_faire", apres: statut.data },
  });
  return { ok: true, valeur: undefined };
}

export async function lireAvancement(db: Db, planId: string) {
  const lignes = await db.select().from(planActionStatus).where(eq(planActionStatus.planId, planId));
  return new Map(lignes.map((l) => [l.actionId, l]));
}

// --- Tableau de bord --------------------------------------------------------------------------

// Fin d'un trimestre de l'année du plan d'action (ex. T1 2027 → 2027-03-31)
export const finTrimestre = (annee: number, trimestre: number) =>
  new Date(Date.UTC(annee, trimestre * 3, 0)).toISOString().slice(0, 10);

export function tableauDeBord(
  contenu: ContenuPlan,
  annee: number,
  statuts: Map<string, { status: StatutAction }>,
  aujourdhui = new Date().toISOString().slice(0, 10),
) {
  const statut = (id: string): StatutAction => statuts.get(id)?.status ?? "a_faire";
  const termine = (s: StatutAction) => s === "realisee" || s === "abandonnee";
  const actions = contenu.actions.map((a) => {
    const s = statut(a.id);
    return { ...a, statut: s, enRetard: !termine(s) && finTrimestre(annee, a.trimestre) < aujourdhui };
  });
  const parTrimestre = [1, 2, 3, 4].map((t) => {
    const liste = actions.filter((a) => a.trimestre === t);
    return { trimestre: t, total: liste.length, realisees: liste.filter((a) => a.statut === "realisee").length };
  });
  const comptables = actions.filter((a) => a.statut !== "abandonnee");
  const realisees = comptables.filter((a) => a.statut === "realisee").length;
  return {
    actions,
    total: actions.length,
    realisees,
    pourcentage: comptables.length ? Math.round((realisees / comptables.length) * 100) : 0,
    enRetard: actions.filter((a) => a.enRetard),
    parTrimestre,
  };
}

// --- Rappel trimestriel -----------------------------------------------------------------------

const base = () => process.env.APP_URL ?? "http://localhost:3000";
const trimestreDe = (d: Date) => `${d.getUTCFullYear()}-T${Math.floor(d.getUTCMonth() / 3) + 1}`;

// Appelé chaque nuit par la tâche programmée : envoie au plus un rappel par plan et par trimestre,
// au conseiller en prévention, s'il reste des actions à mener ce trimestre ou en retard.
export async function envoyerRappelsTrimestriels(db: Db, maintenant = new Date(), envoi: (e: Email) => Promise<void> = envoyerEmail) {
  const trimestre = trimestreDe(maintenant);
  const aujourdhui = maintenant.toISOString().slice(0, 10);
  const plans = await db
    .select({ plan: preventionPlans, locale: organizations.locale })
    .from(preventionPlans)
    .innerJoin(organizations, eq(preventionPlans.organizationId, organizations.id))
    .where(eq(preventionPlans.status, "validated"));
  const dejaEnvoyes = new Set(
    (await db.select({ details: auditLog.details }).from(auditLog).where(eq(auditLog.action, "plan_reminder_sent")))
      .map((l) => (l.details as { plan?: string; trimestre?: string } | null))
      .map((d) => `${d?.plan}:${d?.trimestre}`),
  );
  let envoyes = 0;
  for (const { plan, locale } of plans) {
    if (dejaEnvoyes.has(`${plan.id}:${trimestre}`)) continue;
    const contenu = lireContenuPlan(plan.content);
    if (!contenu) continue;
    const bord = tableauDeBord(contenu, plan.actionYear, await lireAvancement(db, plan.id), aujourdhui);
    const tAnnee = Number(trimestre.slice(0, 4));
    const tNum = Number(trimestre.slice(-1));
    const aVenir = tAnnee === plan.actionYear ? bord.actions.filter((a) => a.trimestre === tNum && a.statut !== "realisee" && a.statut !== "abandonnee").length : 0;
    if (!aVenir && !bord.enRetard.length) continue;
    const conseillers = await db
      .select({ email: users.email, name: users.name })
      .from(users)
      .where(and(eq(users.organizationId, plan.organizationId), eq(users.role, "referent"), eq(users.preventionAdvisor, true), isNull(users.disabledAt)));
    const t = traducteur(locale, "Notifications");
    for (const d of conseillers) {
      try {
        await envoi(
          emailIMA(locale, d, {
            sujet: t("rappelPlanSujet"),
            salutation: t("salutation", { name: d.name }),
            paragraphes: [t("rappelPlanTexte", { aVenir, enRetard: bord.enRetard.length })],
            bouton: t("ouvrirEspace"),
            lien: `${base()}/${locale}/espace/plan`,
            mention: t("sansContenu"),
          }),
        );
        envoyes++;
      } catch (e) {
        console.error("Rappel non envoyé :", e instanceof Error ? e.message : e);
      }
    }
    await journaliser(db, { action: "plan_reminder_sent", targetType: "organization", targetId: plan.organizationId, details: { plan: plan.id, trimestre, destinataires: conseillers.length } });
  }
  return envoyes;
}
