// Campagnes de sensibilisation déclenchées (module B3, décisions de Michelle du 26/10/2026) :
// - InnerOS propose, le conseiller en prévention (ou IMA) accepte en choisissant le mois, ou refuse avec un motif ;
// - déclencheurs : risque du registre de classe « important » ou plus (échelle visée par le thème), comportement
//   indésirable signalé (sans chiffre ni groupe), événement déclaré par le conseiller, alerte réglementaire d'IMA
//   (par pays et, au besoin, par secteur) ;
// - un décès ne déclenche aucune campagne : orientation d'abord vers un professionnel ;
// - si le thème est déjà au calendrier de l'année, accepter avance la campagne existante (pas de doublon).
import { and, desc, eq, gte, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { journaliser } from "../audit";
import {
  awarenessAlerts,
  awarenessCampaigns,
  awarenessEvents,
  awarenessSuggestions,
  campaigns,
  organizations,
  reports,
  risks,
  users,
} from "../db/schema";
import type { Db } from "../db/types";
import { envoyerEmail, type Email } from "../email/brevo";
import { emailIMA } from "../email/modele";
import type { Resultat } from "../rapport/rapports";
import { lireContenuPlan } from "../plan/contenu";
import { lirePlans } from "../plan/plans";
import { enrichir } from "../risques/registre";
import { traducteur } from "../traduction";
import { peutModifierCalendrier } from "./calendrier";
import { EVENEMENTS, type Evenement, type LangueTheme } from "./contenu";
import { themeParId, themesValides, type Theme } from "./themes";

type Utilisateur = typeof users.$inferSelect;
type Origine = "registre" | "comportement" | "evenement" | "alerte";

const CLASSES_DECLENCHANTES = new Set(["important", "eleve", "tres_eleve"]);
const EVENEMENTS_PRIORITAIRES = new Set<Evenement>(["accident_grave", "agression"]);
const DUREE_EVENEMENT_JOURS = 183; // un événement déclenche des propositions pendant six mois

const sansCoordonnees = (s: string) => !/[^\s@]+@[^\s@]+\.[^\s@]+/.test(s) && !/(\+?\d[\s.-]?){8,}/.test(s);
const jour = (d: Date) => d.toISOString().slice(0, 10);
// Secteur comparé sans majuscules ni accents (le secteur est saisi librement à la création de l'entreprise)
export const normaliserSecteur = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

// Mois suivant (les campagnes se préparent : on ne propose pas le mois en cours)
function moisSuivant(maintenant: Date) {
  const m = maintenant.getUTCMonth() + 2;
  return m > 12 ? { annee: maintenant.getUTCFullYear() + 1, mois: 1 } : { annee: maintenant.getUTCFullYear(), mois: m };
}

// --- Événements -------------------------------------------------------------------------------

export async function declarerEvenement(
  db: Db,
  u: Utilisateur,
  organizationId: string,
  saisie: { type: string; date: string },
  maintenant = new Date(),
): Promise<Resultat<{ deces: boolean; propositions: number }>> {
  if (!peutModifierCalendrier(u, organizationId)) return { ok: false, erreur: "introuvable" };
  const type = z.enum(EVENEMENTS).safeParse(saisie.type);
  const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).safeParse(saisie.date);
  if (!type.success || !date.success) return { ok: false, erreur: "saisieInvalide" };
  const limite = jour(new Date(maintenant.getTime() - 365 * 86400000));
  if (date.data > jour(maintenant) || date.data < limite) return { ok: false, erreur: "evenementDate" };
  await db.insert(awarenessEvents).values({ organizationId, type: type.data, occurredOn: date.data, updatedBy: u.id });
  await journaliser(db, { actorUserId: u.id, action: "awareness_event_declared", targetType: "organization", targetId: organizationId, details: { type: type.data } });
  const propositions = await actualiserPropositions(db, organizationId, maintenant);
  return { ok: true, valeur: { deces: type.data === "deces", propositions } };
}

export async function lireEvenements(db: Db, u: Utilisateur, organizationId: string, maintenant = new Date()) {
  if (!peutModifierCalendrier(u, organizationId)) return [];
  const depuis = jour(new Date(maintenant.getTime() - 365 * 86400000));
  return db
    .select()
    .from(awarenessEvents)
    .where(and(eq(awarenessEvents.organizationId, organizationId), gte(awarenessEvents.occurredOn, depuis)))
    .orderBy(desc(awarenessEvents.occurredOn));
}

// Décès déclaré il y a moins de six mois : le calendrier rappelle l'orientation vers un professionnel
export async function decesRecent(db: Db, organizationId: string, maintenant = new Date()) {
  const depuis = jour(new Date(maintenant.getTime() - DUREE_EVENEMENT_JOURS * 86400000));
  const [e] = await db
    .select({ id: awarenessEvents.id })
    .from(awarenessEvents)
    .where(and(eq(awarenessEvents.organizationId, organizationId), eq(awarenessEvents.type, "deces"), gte(awarenessEvents.occurredOn, depuis)));
  return !!e;
}

// --- Alertes réglementaires d'IMA -------------------------------------------------------------

const PAYS = ["BE", "FR", "BR", "PT"] as const;

export const schemaAlerte = z.object({
  titre: z.string().trim().min(3).max(120),
  message: z.string().trim().min(1).max(1000),
  pays: z.array(z.enum(PAYS)).min(1),
  secteurs: z.array(z.string().trim().min(1).max(120)).nullable(), // null = tous les secteurs
  themeIds: z.array(z.string().uuid()).min(1).max(5),
  annee: z.number().int().min(2020).max(2100),
  mois: z.number().int().min(1).max(12),
});

// Secteurs connus (ceux des entreprises enregistrées), pour cibler une alerte sans faute de frappe
export async function secteursConnus(db: Db) {
  const tous = await db.selectDistinct({ sector: organizations.sector }).from(organizations);
  const parCle = new Map<string, string>();
  for (const { sector } of tous) if (!parCle.has(normaliserSecteur(sector))) parCle.set(normaliserSecteur(sector), sector.trim());
  return [...parCle.values()].sort((a, b) => a.localeCompare(b));
}

const alerteVise = (a: typeof awarenessAlerts.$inferSelect, org: { country: string; sector: string }) =>
  a.countries.includes(org.country) && (!a.sectors || a.sectors.map(normaliserSecteur).includes(normaliserSecteur(org.sector)));

export async function listerAlertes(db: Db) {
  return db.select().from(awarenessAlerts).orderBy(desc(awarenessAlerts.createdAt));
}

// Alertes en cours qui concernent l'entreprise (affichées dans son calendrier)
export async function alertesPour(db: Db, organizationId: string) {
  const [org] = await db.select().from(organizations).where(eq(organizations.id, organizationId));
  if (!org) return [];
  return (await db.select().from(awarenessAlerts).where(isNull(awarenessAlerts.withdrawnAt)).orderBy(desc(awarenessAlerts.createdAt))).filter((a) =>
    alerteVise(a, org),
  );
}

const base = () => process.env.APP_URL ?? "http://localhost:3000";

export async function creerAlerte(
  db: Db,
  admin: Utilisateur,
  saisie: unknown,
  maintenant = new Date(),
  envoi: (e: Email) => Promise<void> = envoyerEmail,
): Promise<Resultat<{ id: string; entreprises: number }>> {
  if (admin.role !== "admin" || admin.disabledAt) return { ok: false, erreur: "introuvable" };
  const a = schemaAlerte.safeParse(saisie);
  if (!a.success) return { ok: false, erreur: "saisieInvalide" };
  if (!sansCoordonnees(`${a.data.titre} ${a.data.message}`)) return { ok: false, erreur: "risqueCoordonnees" };
  for (const id of a.data.themeIds) if ((await themeParId(db, id))?.status !== "validated") return { ok: false, erreur: "introuvable" };
  const [alerte] = await db
    .insert(awarenessAlerts)
    .values({
      title: a.data.titre,
      message: a.data.message,
      countries: a.data.pays,
      sectors: a.data.secteurs?.length ? a.data.secteurs : null,
      themeIds: a.data.themeIds,
      year: a.data.annee,
      month: a.data.mois,
      createdBy: admin.id,
    })
    .returning();
  // Entreprises concernées : propositions, puis e-mail aux conseillers en prévention (titre de l'alerte seulement)
  const visees = (await db.select().from(organizations)).filter((o) => alerteVise(alerte, o));
  for (const o of visees) {
    await actualiserPropositions(db, o.id, maintenant);
    const conseillers = await db
      .select({ email: users.email, name: users.name })
      .from(users)
      .where(and(eq(users.organizationId, o.id), eq(users.role, "referent"), eq(users.preventionAdvisor, true), isNull(users.disabledAt)));
    const t = traducteur(o.locale, "Notifications");
    for (const d of conseillers) {
      try {
        await envoi(
          emailIMA(o.locale, d, {
            sujet: t("alerteSujet"),
            salutation: t("salutation", { name: d.name }),
            paragraphes: [t("alerteTexte", { titre: alerte.title })],
            bouton: t("ouvrirEspace"),
            lien: `${base()}/${o.locale}/espace/sensibilisation`,
            mention: t("sansContenu"),
          }),
        );
      } catch (e) {
        console.error("Alerte non envoyée :", e instanceof Error ? e.message : e);
      }
    }
  }
  await journaliser(db, { actorUserId: admin.id, action: "awareness_alert_created", targetType: "alert", targetId: alerte.id, details: { pays: a.data.pays, entreprises: visees.length } });
  return { ok: true, valeur: { id: alerte.id, entreprises: visees.length } };
}

// Retirer une alerte : elle disparaît des calendriers et ses propositions en attente sont supprimées
export async function retirerAlerte(db: Db, admin: Utilisateur, id: string, maintenant = new Date()): Promise<Resultat> {
  if (admin.role !== "admin" || admin.disabledAt) return { ok: false, erreur: "introuvable" };
  const [a] = await db.update(awarenessAlerts).set({ withdrawnAt: maintenant }).where(and(eq(awarenessAlerts.id, id), isNull(awarenessAlerts.withdrawnAt))).returning();
  if (!a) return { ok: false, erreur: "introuvable" };
  await db
    .delete(awarenessSuggestions)
    .where(and(eq(awarenessSuggestions.origin, "alerte"), eq(awarenessSuggestions.originRef, id), eq(awarenessSuggestions.status, "en_attente")));
  await journaliser(db, { actorUserId: admin.id, action: "awareness_alert_withdrawn", targetType: "alert", targetId: id });
  return { ok: true, valeur: undefined };
}

// --- Calcul des propositions ------------------------------------------------------------------

type Candidat = { themeId: string; origin: Origine; originRef: string; annee: number; mois: number; priority: boolean };

// Risques visibles du conseiller : saisis à la main, ou issus d'une campagne dont le rapport est validé
async function risquesDeclenchants(db: Db, organizationId: string) {
  const lignes = (await db.select().from(risks).where(eq(risks.organizationId, organizationId))).map(enrichir);
  const ids = [...new Set(lignes.map((r) => r.campaignId).filter((c): c is string => !!c))];
  const valides = ids.length
    ? new Set(
        (
          await db
            .select({ campaignId: reports.campaignId })
            .from(reports)
            .innerJoin(campaigns, eq(reports.campaignId, campaigns.id))
            .where(and(inArray(reports.campaignId, ids), eq(reports.status, "validated")))
        ).map((r) => r.campaignId),
      )
    : new Set<string>();
  return lignes.filter((r) => r.status !== "clos" && CLASSES_DECLENCHANTES.has(r.classe) && (r.campaignId === null || valides.has(r.campaignId)));
}

// Calcule les propositions de l'entreprise et enregistre les nouvelles (une même cause ne propose un thème
// qu'une fois, même refusé). Appelé à l'ouverture du calendrier par le conseiller, après une déclaration
// d'événement ou une alerte, et chaque nuit. Renvoie le nombre de nouvelles propositions.
export async function actualiserPropositions(db: Db, organizationId: string, maintenant = new Date()) {
  const [org] = await db.select().from(organizations).where(eq(organizations.id, organizationId));
  if (!org) return 0;
  const themes = await themesValides(db, org.country);
  if (!themes.length) return 0;
  const suivant = moisSuivant(maintenant);
  const candidats: Candidat[] = [];

  for (const r of await risquesDeclenchants(db, organizationId)) {
    if (!r.scaleId) continue;
    for (const t of themes.filter((th) => th.fiche!.echelles.includes(r.scaleId!)))
      candidats.push({
        themeId: t.id,
        origin: r.source === "comportement" ? "comportement" : "registre",
        originRef: r.id,
        ...suivant,
        priority: r.source === "comportement" || r.classe !== "important",
      });
  }

  const depuis = jour(new Date(maintenant.getTime() - DUREE_EVENEMENT_JOURS * 86400000));
  const evenements = await db
    .select()
    .from(awarenessEvents)
    .where(and(eq(awarenessEvents.organizationId, organizationId), gte(awarenessEvents.occurredOn, depuis)));
  for (const e of evenements) {
    if (e.type === "deces") continue; // orientation vers un professionnel, pas de campagne
    for (const t of themes.filter((th) => (th.fiche!.evenements as string[]).includes(e.type)))
      candidats.push({ themeId: t.id, origin: "evenement", originRef: e.id, ...suivant, priority: EVENEMENTS_PRIORITAIRES.has(e.type) });
  }

  const valides = new Set(themes.map((t) => t.id));
  for (const a of await alertesPour(db, organizationId)) {
    const passe = a.year < suivant.annee || (a.year === suivant.annee && a.month < suivant.mois);
    for (const id of a.themeIds.filter((i) => valides.has(i)))
      candidats.push({ themeId: id, origin: "alerte", originRef: a.id, ...(passe ? suivant : { annee: a.year, mois: a.month }), priority: true });
  }

  if (!candidats.length) return 0;
  const nouvelles = await db
    .insert(awarenessSuggestions)
    .values(candidats.map((c) => ({ organizationId, themeId: c.themeId, origin: c.origin, originRef: c.originRef, year: c.annee, month: c.mois, priority: c.priority })))
    .onConflictDoNothing()
    .returning({ id: awarenessSuggestions.id });
  if (nouvelles.length)
    await journaliser(db, { action: "awareness_suggestions_created", targetType: "organization", targetId: organizationId, details: { nombre: nouvelles.length } });
  return nouvelles.length;
}

// Chaque nuit, pour toutes les entreprises
export async function actualiserToutesPropositions(db: Db, maintenant = new Date()) {
  let total = 0;
  for (const o of await db.select({ id: organizations.id }).from(organizations)) total += await actualiserPropositions(db, o.id, maintenant);
  return total;
}

// --- Lecture des propositions -----------------------------------------------------------------

// Cause lisible d'une proposition. Pour un comportement indésirable : aucune donnée (ni chiffre, ni groupe).
export type Cause =
  | { type: "registre"; risque: string; classe: string }
  | { type: "comportement" }
  | { type: "evenement"; evenement: Evenement; date: string }
  | { type: "alerte"; titre: string; message: string };

async function cause(db: Db, s: { origin: string; originRef: string }): Promise<Cause | null> {
  if (s.origin === "registre") {
    const [r] = await db.select().from(risks).where(eq(risks.id, s.originRef));
    return r ? { type: "registre", risque: r.title, classe: enrichir(r).classe } : null;
  }
  if (s.origin === "comportement") return { type: "comportement" };
  if (s.origin === "evenement") {
    const [e] = await db.select().from(awarenessEvents).where(eq(awarenessEvents.id, s.originRef));
    return e ? { type: "evenement", evenement: e.type, date: e.occurredOn } : null;
  }
  const [a] = await db.select().from(awarenessAlerts).where(eq(awarenessAlerts.id, s.originRef));
  return a ? { type: "alerte", titre: a.title, message: a.message } : null;
}

// Propositions en attente (conseiller en prévention et IMA), les prioritaires d'abord
export async function lirePropositions(db: Db, u: Utilisateur, organizationId: string) {
  if (!peutModifierCalendrier(u, organizationId)) return [];
  const lignes = await db
    .select()
    .from(awarenessSuggestions)
    .where(and(eq(awarenessSuggestions.organizationId, organizationId), eq(awarenessSuggestions.status, "en_attente")));
  const themes = new Map<string, Theme | null>();
  const liste = [];
  for (const s of lignes) {
    if (!themes.has(s.themeId)) themes.set(s.themeId, await themeParId(db, s.themeId));
    const theme = themes.get(s.themeId);
    if (!theme || theme.status !== "validated") continue;
    const [existante] = await db
      .select()
      .from(awarenessCampaigns)
      .where(and(eq(awarenessCampaigns.organizationId, organizationId), eq(awarenessCampaigns.themeId, s.themeId), eq(awarenessCampaigns.year, s.year)));
    liste.push({ ...s, theme, cause: await cause(db, s), existante: existante ?? null });
  }
  return liste.sort((a, b) => Number(b.priority) - Number(a.priority) || a.year - b.year || a.month - b.month);
}

// Causes des propositions acceptées, par campagne (affichées au conseiller sous la campagne)
export async function causesAcceptees(db: Db, u: Utilisateur, organizationId: string) {
  const parCampagne = new Map<string, Cause[]>();
  if (!peutModifierCalendrier(u, organizationId)) return parCampagne;
  const lignes = await db
    .select()
    .from(awarenessSuggestions)
    .where(and(eq(awarenessSuggestions.organizationId, organizationId), eq(awarenessSuggestions.status, "acceptee")));
  for (const s of lignes) {
    if (!s.campaignId) continue;
    const c = await cause(db, s);
    if (c) parCampagne.set(s.campaignId, [...(parCampagne.get(s.campaignId) ?? []), c]);
  }
  return parCampagne;
}

export async function nombrePropositionsEnAttente(db: Db, organizationId: string) {
  return (
    await db
      .select({ id: awarenessSuggestions.id })
      .from(awarenessSuggestions)
      .where(and(eq(awarenessSuggestions.organizationId, organizationId), eq(awarenessSuggestions.status, "en_attente")))
  ).length;
}

// --- Décisions --------------------------------------------------------------------------------

async function propositionModifiable(db: Db, u: Utilisateur, id: string) {
  const [s] = await db.select().from(awarenessSuggestions).where(eq(awarenessSuggestions.id, id));
  if (!s || s.status !== "en_attente" || !peutModifierCalendrier(u, s.organizationId)) return null;
  return s;
}

// Accepter : ajoute la campagne au mois choisi, ou avance la campagne déjà prévue cette année-là
export async function accepterProposition(db: Db, u: Utilisateur, id: string, saisie: { mois: number }, maintenant = new Date()): Promise<Resultat<{ campagneId: string }>> {
  const s = await propositionModifiable(db, u, id);
  if (!s) return { ok: false, erreur: "introuvable" };
  const m = z.number().int().min(1).max(12).safeParse(saisie.mois);
  if (!m.success) return { ok: false, erreur: "saisieInvalide" };
  const theme = await themeParId(db, s.themeId);
  if (theme?.status !== "validated") return { ok: false, erreur: "introuvable" };
  const [existante] = await db
    .select()
    .from(awarenessCampaigns)
    .where(and(eq(awarenessCampaigns.organizationId, s.organizationId), eq(awarenessCampaigns.themeId, s.themeId), eq(awarenessCampaigns.year, s.year)));
  let campagneId: string;
  if (existante) {
    campagneId = existante.id;
    if (existante.status === "retiree")
      await db.update(awarenessCampaigns).set({ status: "prevue", month: m.data, updatedBy: u.id, updatedAt: maintenant }).where(eq(awarenessCampaigns.id, existante.id));
    else if (existante.status === "prevue" && m.data < existante.month)
      await db.update(awarenessCampaigns).set({ month: m.data, updatedBy: u.id, updatedAt: maintenant }).where(eq(awarenessCampaigns.id, existante.id));
  } else {
    const [c] = await db
      .insert(awarenessCampaigns)
      .values({ organizationId: s.organizationId, themeId: s.themeId, year: s.year, month: m.data, origin: s.origin, originRef: s.originRef, createdBy: u.id, updatedBy: u.id })
      .returning({ id: awarenessCampaigns.id });
    campagneId = c.id;
  }
  await db
    .update(awarenessSuggestions)
    .set({ status: "acceptee", campaignId: campagneId, decidedBy: u.id, decidedAt: maintenant })
    .where(eq(awarenessSuggestions.id, id));
  await journaliser(db, {
    actorUserId: u.id,
    action: "awareness_suggestion_accepted",
    targetType: "organization",
    targetId: s.organizationId,
    details: { theme: theme.code, origine: s.origin, mois: m.data, avancee: !!existante },
  });
  return { ok: true, valeur: { campagneId } };
}

export async function refuserProposition(db: Db, u: Utilisateur, id: string, motifSaisi: string, maintenant = new Date()): Promise<Resultat> {
  const s = await propositionModifiable(db, u, id);
  if (!s) return { ok: false, erreur: "introuvable" };
  const motif = motifSaisi.trim();
  if (motif.length < 3 || motif.length > 300) return { ok: false, erreur: "motifRefusRequis" };
  if (!sansCoordonnees(motif)) return { ok: false, erreur: "risqueCoordonnees" };
  await db
    .update(awarenessSuggestions)
    .set({ status: "refusee", refusalReason: motif, decidedBy: u.id, decidedAt: maintenant })
    .where(eq(awarenessSuggestions.id, id));
  await journaliser(db, { actorUserId: u.id, action: "awareness_suggestion_refused", targetType: "organization", targetId: s.organizationId, details: { origine: s.origin } });
  return { ok: true, valeur: undefined };
}

// --- Lien avec le plan de prévention ----------------------------------------------------------

// Relie une campagne à une action du plan validé de l'entreprise (ou retire le lien)
export async function lierActionPlan(db: Db, u: Utilisateur, campagneId: string, actionId: string | null, maintenant = new Date()): Promise<Resultat> {
  const [c] = await db.select().from(awarenessCampaigns).where(eq(awarenessCampaigns.id, campagneId));
  if (!c || !peutModifierCalendrier(u, c.organizationId)) return { ok: false, erreur: "introuvable" };
  let planId: string | null = null;
  if (actionId) {
    const plan = await planValide(db, c.organizationId);
    if (!plan?.contenu.actions.some((a) => a.id === actionId)) return { ok: false, erreur: "introuvable" };
    planId = plan.id;
  }
  await db
    .update(awarenessCampaigns)
    .set({ planId, planActionId: actionId, updatedBy: u.id, updatedAt: maintenant })
    .where(eq(awarenessCampaigns.id, campagneId));
  await journaliser(db, { actorUserId: u.id, action: "awareness_campaign_linked", targetType: "organization", targetId: c.organizationId, details: { action: actionId } });
  return { ok: true, valeur: undefined };
}

async function planValide(db: Db, organizationId: string) {
  const { valide } = await lirePlans(db, organizationId);
  const contenu = valide ? lireContenuPlan(valide.content) : null;
  return valide && contenu ? { id: valide.id, contenu } : null;
}

// Actions du plan validé proposées pour le lien ; celles qui traitent le risque à l'origine de la campagne d'abord
export async function actionsPourLien(db: Db, u: Utilisateur, organizationId: string) {
  if (!peutModifierCalendrier(u, organizationId)) return null;
  const plan = await planValide(db, organizationId);
  if (!plan) return null;
  return { planId: plan.id, actions: plan.contenu.actions.map((a) => ({ id: a.id, titre: a.titre, risques: a.risques })) };
}

// Campagnes liées aux actions d'un plan (page de suivi et exports du plan)
export async function campagnesDuPlan(db: Db, planId: string, langue = "fr") {
  const lignes = await db.select().from(awarenessCampaigns).where(eq(awarenessCampaigns.planId, planId));
  const parAction = new Map<string, { titre: string; statut: string; mois: number; annee: number; diffuseeLe: string | null }[]>();
  for (const c of lignes) {
    if (!c.planActionId) continue;
    const theme = await themeParId(db, c.themeId);
    const titre = theme?.kitsLus[langue as LangueTheme]?.titre || theme?.kitsLus.fr?.titre || theme?.code || "";
    parAction.set(c.planActionId, [
      ...(parAction.get(c.planActionId) ?? []),
      { titre, statut: c.status, mois: c.month, annee: c.year, diffuseeLe: c.diffusedOn },
    ]);
  }
  return parAction;
}
