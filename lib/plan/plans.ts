// Cycle d'un plan de prévention RPS (module A2) : brouillon IA ou rédaction à la main (éventuellement à partir
// du plan validé) → modifications → refus motivé ou validation IMA (liste de contrôle, praticien formé à l'IA,
// risques prioritaires couverts). Il faut un rapport validé (décision du 19/10/2026). Tout est journalisé.
import { randomUUID } from "node:crypto";
import path from "node:path";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { journaliser } from "../audit";
import { aggregates, campaigns, groups, organizations, preventionPlans, reports, users } from "../db/schema";
import type { Db } from "../db/types";
import { LANGUES_RAPPORT, lireContenu } from "../rapport/contenu";
import { appelStructure, type ResultatStructure } from "../rapport/ia";
import { iaActiveGlobalement, type Resultat } from "../rapport/rapports";
import { lireRegistre, type Risque } from "../risques/registre";
import { construireChargePlan, verifierChargePlan, type ChargePlan } from "./charge-utile";
import { planVide, risquesNonCouverts, schemaContenuPlan, type ContenuPlan } from "./contenu";

export const FICHIER_PROMPT_PLAN = path.join(process.cwd(), "prompts", "plan-prevention.system.md");

export type AppelPlan = (charge: ChargePlan) => Promise<ResultatStructure<ContenuPlan>>;
export const appelClaudePlan: AppelPlan = (charge) => appelStructure(FICHIER_PROMPT_PLAN, schemaContenuPlan, charge);

type Ligne = typeof preventionPlans.$inferSelect;
const langue = z.enum(LANGUES_RAPPORT);
const annee = z.coerce.number().int().min(2020).max(2100);

// Plan validé en vigueur et brouillon en cours (nouvelle version), s'il y en a
export async function lirePlans(db: Db, organizationId: string) {
  const lignes = await db
    .select()
    .from(preventionPlans)
    .where(and(eq(preventionPlans.organizationId, organizationId), inArray(preventionPlans.status, ["validated", "draft", "ai_draft"])))
    .orderBy(desc(preventionPlans.createdAt));
  return {
    valide: lignes.find((l) => l.status === "validated") ?? null,
    brouillon: lignes.find((l) => l.status !== "validated") ?? null,
  };
}

// Rapport validé le plus récent parmi les campagnes de l'entreprise
export async function rapportDeReference(db: Db, organizationId: string) {
  const [r] = await db
    .select({ rapport: reports, campagne: campaigns })
    .from(reports)
    .innerJoin(campaigns, eq(reports.campaignId, campaigns.id))
    .where(and(eq(campaigns.organizationId, organizationId), eq(reports.status, "validated")))
    .orderBy(desc(reports.validatedAt))
    .limit(1);
  return r ?? null;
}

// Groupes présentés dans les résultats des campagnes de l'entreprise (agrégats enregistrés, donc ≥ seuil)
async function groupesAffichables(db: Db, organizationId: string) {
  const lignes = await db
    .selectDistinct({ label: groups.label })
    .from(aggregates)
    .innerJoin(groups, eq(aggregates.groupId, groups.id))
    .innerJoin(campaigns, eq(aggregates.campaignId, campaigns.id))
    .where(eq(campaigns.organizationId, organizationId));
  return new Set(lignes.map((l) => l.label));
}

async function preparer(db: Db, adminId: string, organizationId: string, langueSaisie: string, anneeSaisie: unknown) {
  const [admin] = await db.select().from(users).where(eq(users.id, adminId));
  const [org] = await db.select().from(organizations).where(eq(organizations.id, organizationId));
  if (!admin || admin.role !== "admin" || !org) return { ok: false as const, erreur: "introuvable" };
  const lg = langue.safeParse(langueSaisie);
  const an = annee.safeParse(anneeSaisie);
  if (!lg.success || !an.success) return { ok: false as const, erreur: "saisieInvalide" };
  const ref = await rapportDeReference(db, organizationId);
  if (!ref) return { ok: false as const, erreur: "planSansRapport" };
  const { brouillon } = await lirePlans(db, organizationId);
  return { ok: true as const, admin, org, langue: lg.data, annee: an.data, ref, brouillon };
}

// Un brouillon précédent non validé est remplacé : on le marque refusé, avec le motif
async function remplacerBrouillon(db: Db, brouillon: Ligne | null, motif: string) {
  if (!brouillon) return;
  await db.update(preventionPlans).set({ status: "rejected", rejectionReason: motif, updatedAt: new Date() }).where(eq(preventionPlans.id, brouillon.id));
}

// Identifiants des risques côté IA (R1, R2…) → identifiants du registre ; références inconnues retirées
function convertirReferences(c: ContenuPlan, refs: Map<string, string>): ContenuPlan {
  const conv = (l: string[]) => [...new Set(l.map((x) => refs.get(x)).filter((x): x is string => !!x))];
  const vus = new Set<string>();
  return {
    ...c,
    objectifs: c.objectifs.map((o) => ({ ...o, risques: conv(o.risques) })),
    mesures: c.mesures.map((m) => ({ ...m, risques: conv(m.risques) })),
    actions: c.actions.map((a) => {
      const id = a.id && !vus.has(a.id) ? a.id : randomUUID();
      vus.add(id);
      return { ...a, id, risques: conv(a.risques) };
    }),
  };
}

export async function genererPlanIA(
  db: Db,
  adminId: string,
  organizationId: string,
  langueSaisie: string,
  anneeSaisie: unknown,
  appel: AppelPlan = appelClaudePlan,
): Promise<Resultat<{ planId: string }>> {
  const p = await preparer(db, adminId, organizationId, langueSaisie, anneeSaisie);
  if (!p.ok) return p;
  // Interrupteur IA : global et celui de la campagne du rapport de référence (règle 7)
  if (!iaActiveGlobalement() || !p.ref.campagne.aiDraftingEnabled) return { ok: false, erreur: "iaDesactivee" };
  const rapport = lireContenu(p.ref.rapport.finalText);
  const registre = (await lireRegistre(db, p.admin, organizationId)) ?? [];
  if (!rapport) return { ok: false, erreur: "planSansRapport" };
  if (!registre.some((r) => r.status !== "clos")) return { ok: false, erreur: "planSansRisque" };

  const { charge, refs } = construireChargePlan(p.org, registre, rapport, p.langue, p.annee);
  const anomalies = verifierChargePlan(charge, p.org.name, await groupesAffichables(db, organizationId));
  if (anomalies.length) {
    await journaliser(db, { actorUserId: adminId, action: "plan_ai_blocked", targetType: "organization", targetId: organizationId, details: { anomalies } });
    return { ok: false, erreur: "iaEnvoiBloque", detail: anomalies.join(" ; ") };
  }
  const r = await appel(charge);
  if (!r.ok) {
    await journaliser(db, { actorUserId: adminId, action: "plan_ai_failed", targetType: "organization", targetId: organizationId, details: { erreur: r.erreur } });
    return { ok: false, erreur: r.erreur, detail: r.detail };
  }
  await remplacerBrouillon(db, p.brouillon, "Remplacé par un nouveau brouillon IA");
  const [nouveau] = await db
    .insert(preventionPlans)
    .values({
      organizationId,
      status: "ai_draft",
      country: p.org.country,
      language: p.langue,
      startYear: p.annee,
      content: convertirReferences(r.contenu, refs),
      reportId: p.ref.rapport.id,
      aiModel: r.modele,
      aiPromptVersion: r.versionPrompt,
      aiGeneratedAt: new Date(),
      createdBy: adminId,
    })
    .returning({ id: preventionPlans.id });
  await journaliser(db, {
    actorUserId: adminId,
    action: "plan_ai_generated",
    targetType: "organization",
    targetId: organizationId,
    details: { modele: r.modele, prompt: r.versionPrompt, jetonsEntree: r.jetonsEntree, jetonsSortie: r.jetonsSortie },
  });
  return { ok: true, valeur: { planId: nouveau.id } };
}

// Rédaction à la main : plan vide, ou nouvelle version à partir du plan validé
export async function creerPlanManuel(
  db: Db,
  adminId: string,
  organizationId: string,
  langueSaisie: string,
  anneeSaisie: unknown,
  depuisValide = false,
): Promise<Resultat<{ planId: string }>> {
  const p = await preparer(db, adminId, organizationId, langueSaisie, anneeSaisie);
  if (!p.ok) return p;
  if (p.brouillon) return { ok: false, erreur: "planBrouillonExistant" };
  const { valide } = await lirePlans(db, organizationId);
  const contenu = depuisValide && valide ? schemaContenuPlan.parse(valide.content) : planVide();
  const [nouveau] = await db
    .insert(preventionPlans)
    .values({
      organizationId,
      status: "draft",
      country: p.org.country,
      language: depuisValide && valide ? valide.language : p.langue,
      startYear: p.annee,
      content: contenu,
      reportId: p.ref.rapport.id,
      createdBy: adminId,
    })
    .returning({ id: preventionPlans.id });
  await journaliser(db, {
    actorUserId: adminId,
    action: "plan_manual_created",
    targetType: "organization",
    targetId: organizationId,
    details: depuisValide ? { depuisValide: true } : undefined,
  });
  return { ok: true, valeur: { planId: nouveau.id } };
}

async function brouillon(db: Db, planId: string) {
  const [p] = await db.select().from(preventionPlans).where(eq(preventionPlans.id, planId));
  if (!p) return { ok: false as const, erreur: "introuvable" };
  if (p.status !== "draft" && p.status !== "ai_draft") return { ok: false as const, erreur: "planNonModifiable" };
  return { ok: true as const, plan: p };
}

export async function enregistrerPlan(db: Db, adminId: string, planId: string, contenu: unknown): Promise<Resultat> {
  const b = await brouillon(db, planId);
  if (!b.ok) return b;
  const lecture = schemaContenuPlan.safeParse(contenu);
  if (!lecture.success) return { ok: false, erreur: "planContenuInvalide" };
  await db.update(preventionPlans).set({ content: lecture.data, updatedAt: new Date() }).where(eq(preventionPlans.id, planId));
  await journaliser(db, { actorUserId: adminId, action: "plan_saved", targetType: "organization", targetId: b.plan.organizationId });
  return { ok: true, valeur: undefined };
}

export async function refuserPlan(db: Db, adminId: string, planId: string, motif: string): Promise<Resultat> {
  const b = await brouillon(db, planId);
  if (!b.ok) return b;
  const m = motif.trim();
  if (m.length < 5 || m.length > 1000) return { ok: false, erreur: "rapportMotifRequis" };
  await db.update(preventionPlans).set({ status: "rejected", rejectionReason: m, updatedAt: new Date() }).where(eq(preventionPlans.id, planId));
  await journaliser(db, { actorUserId: adminId, action: "plan_rejected", targetType: "organization", targetId: b.plan.organizationId, details: { motif: m } });
  return { ok: true, valeur: undefined };
}

export const schemaListePlan = z.object({
  risques: z.literal(true), // les risques prioritaires sont couverts et les échéances réalistes
  fonctions: z.literal(true), // responsables désignés par leur fonction, aucun nom
  cadre: z.literal(true), // conforme au cadre légal du pays
  langage: z.literal(true), // règle de langage IMA, aucune donnée individuelle
});

export async function validerPlan(
  db: Db,
  adminId: string,
  planId: string,
  saisie: { contenu: unknown; liste: unknown },
  maintenant = new Date(),
): Promise<Resultat<undefined> | { ok: false; erreur: "planRisquesNonCouverts"; detail: string }> {
  const b = await brouillon(db, planId);
  if (!b.ok) return b;
  if (!schemaListePlan.safeParse(saisie.liste).success) return { ok: false, erreur: "rapportListeIncomplete" };
  const lecture = schemaContenuPlan.safeParse(saisie.contenu);
  if (!lecture.success) return { ok: false, erreur: "planContenuInvalide" };
  if (!lecture.data.actions.length) return { ok: false, erreur: "planSansAction" };
  const [admin] = await db.select().from(users).where(eq(users.id, adminId));
  if (!admin?.aiLiteracyAt) return { ok: false, erreur: "rapportFormationIARequise" };
  const registre: Risque[] = (await lireRegistre(db, admin, b.plan.organizationId)) ?? [];
  const manquants = risquesNonCouverts(lecture.data, registre);
  if (manquants.length) return { ok: false, erreur: "planRisquesNonCouverts", detail: manquants.map((r) => r.title).join(" ; ") };

  await db.transaction(async (tx) => {
    // L'ancien plan validé est remplacé (il reste consultable dans l'historique)
    await tx
      .update(preventionPlans)
      .set({ status: "replaced", updatedAt: maintenant })
      .where(and(eq(preventionPlans.organizationId, b.plan.organizationId), eq(preventionPlans.status, "validated")));
    await tx
      .update(preventionPlans)
      .set({ status: "validated", content: lecture.data, validatedBy: adminId, validatedAt: maintenant, updatedAt: maintenant })
      .where(eq(preventionPlans.id, planId));
  });
  await journaliser(db, { actorUserId: adminId, action: "plan_validated", targetType: "organization", targetId: b.plan.organizationId });
  return { ok: true, valeur: undefined };
}

// Espace du conseiller en prévention : seulement le plan validé de son entreprise
export async function planPourReferent(db: Db, u: typeof users.$inferSelect) {
  if (u.role !== "referent" || !u.preventionAdvisor || !u.organizationId || u.disabledAt) return null;
  return (await lirePlans(db, u.organizationId)).valide;
}
