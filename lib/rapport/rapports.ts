// Cycle d'un rapport (étape 8A) : brouillon IA ou rédaction à la main → modifications → refus motivé
// ou validation IMA (liste de contrôle, praticien formé à l'IA). Tout est journalisé.
import { and, desc, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { journaliser } from "../audit";
import { campaigns, reports, users } from "../db/schema";
import type { Db } from "../db/types";
import { construireChargeUtile, verifierChargeUtile } from "./charge-utile";
import { LANGUES_RAPPORT, schemaContenuRapport, contenuVide, type ContenuRapport } from "./contenu";
import { appelClaude, type AppelIA } from "./ia";

export type Resultat<T = undefined> = { ok: true; valeur: T } | { ok: false; erreur: string; detail?: string };

// Interrupteur IA : global (AI_DRAFTING_ENABLED) et par campagne
export const iaActiveGlobalement = () => process.env.AI_DRAFTING_ENABLED !== "false";

// Rapport en cours d'une campagne : le plus récent qui n'a pas été refusé
export async function rapportCourant(db: Db, campaignId: string) {
  const [r] = await db
    .select()
    .from(reports)
    .where(and(eq(reports.campaignId, campaignId), ne(reports.status, "rejected")))
    .orderBy(desc(reports.createdAt))
    .limit(1);
  return r ?? null;
}

async function campagneCloturee(db: Db, campaignId: string) {
  const [c] = await db.select().from(campaigns).where(eq(campaigns.id, campaignId));
  if (!c) return { ok: false as const, erreur: "introuvable" };
  if (c.status !== "closed") return { ok: false as const, erreur: "rapportCampagneOuverte" };
  return { ok: true as const, campagne: c };
}

const langue = z.enum(LANGUES_RAPPORT);

export async function genererBrouillonIA(
  db: Db,
  adminId: string,
  campaignId: string,
  langueSaisie: string,
  appel: AppelIA = appelClaude,
): Promise<Resultat<{ reportId: string }>> {
  const verif = await campagneCloturee(db, campaignId);
  if (!verif.ok) return verif;
  const lg = langue.safeParse(langueSaisie);
  if (!lg.success) return { ok: false, erreur: "saisieInvalide" };
  if (!iaActiveGlobalement() || !verif.campagne.aiDraftingEnabled) return { ok: false, erreur: "iaDesactivee" };
  const existant = await rapportCourant(db, campaignId);
  if (existant?.status === "validated") return { ok: false, erreur: "rapportDejaValide" };

  const { charge, nomEntreprise, seuil } = await construireChargeUtile(db, campaignId, lg.data);
  if (!charge.resultats.length) return { ok: false, erreur: "rapportSansResultats" };
  // Contrôle bloquant avant tout envoi (règle 5)
  const anomalies = verifierChargeUtile(charge, { nomEntreprise, seuil });
  if (anomalies.length) {
    await journaliser(db, { actorUserId: adminId, action: "report_ai_blocked", targetType: "campaign", targetId: campaignId, details: { anomalies } });
    return { ok: false, erreur: "iaEnvoiBloque", detail: anomalies.join(" ; ") };
  }

  const r = await appel(charge);
  if (!r.ok) {
    await journaliser(db, { actorUserId: adminId, action: "report_ai_failed", targetType: "campaign", targetId: campaignId, details: { erreur: r.erreur } });
    return { ok: false, erreur: r.erreur, detail: r.detail };
  }

  // Un brouillon précédent non validé est remplacé : on le marque refusé, avec le motif
  if (existant) {
    await db
      .update(reports)
      .set({ status: "rejected", rejectionReason: "Remplacé par un nouveau brouillon IA", updatedAt: new Date() })
      .where(eq(reports.id, existant.id));
  }
  const [nouveau] = await db
    .insert(reports)
    .values({
      campaignId,
      status: "ai_draft",
      aiDraft: r.contenu,
      aiModel: r.modele,
      aiPromptVersion: r.versionPrompt,
      aiGeneratedAt: new Date(),
      finalText: JSON.stringify(r.contenu),
      language: lg.data,
    })
    .returning({ id: reports.id });
  await journaliser(db, {
    actorUserId: adminId,
    action: "report_ai_generated",
    targetType: "campaign",
    targetId: campaignId,
    details: { modele: r.modele, prompt: r.versionPrompt, jetonsEntree: r.jetonsEntree, jetonsSortie: r.jetonsSortie },
  });
  return { ok: true, valeur: { reportId: nouveau.id } };
}

// Rédaction entièrement à la main (interrupteur IA coupé, ou choix du praticien)
export async function creerRapportManuel(db: Db, adminId: string, campaignId: string, langueSaisie: string): Promise<Resultat<{ reportId: string }>> {
  const verif = await campagneCloturee(db, campaignId);
  if (!verif.ok) return verif;
  const lg = langue.safeParse(langueSaisie);
  if (!lg.success) return { ok: false, erreur: "saisieInvalide" };
  if (await rapportCourant(db, campaignId)) return { ok: false, erreur: "rapportExistant" };
  const [nouveau] = await db
    .insert(reports)
    .values({ campaignId, status: "draft", finalText: JSON.stringify(contenuVide()), language: lg.data })
    .returning({ id: reports.id });
  await journaliser(db, { actorUserId: adminId, action: "report_manual_created", targetType: "campaign", targetId: campaignId });
  return { ok: true, valeur: { reportId: nouveau.id } };
}

async function rapportModifiable(db: Db, reportId: string) {
  const [r] = await db.select().from(reports).where(eq(reports.id, reportId));
  if (!r) return { ok: false as const, erreur: "introuvable" };
  if (r.status !== "draft" && r.status !== "ai_draft") return { ok: false as const, erreur: "rapportNonModifiable" };
  return { ok: true as const, rapport: r };
}

export async function enregistrerContenu(db: Db, adminId: string, reportId: string, contenu: unknown): Promise<Resultat> {
  const verif = await rapportModifiable(db, reportId);
  if (!verif.ok) return verif;
  const lecture = schemaContenuRapport.safeParse(contenu);
  if (!lecture.success) return { ok: false, erreur: "rapportContenuInvalide" };
  await db.update(reports).set({ finalText: JSON.stringify(lecture.data), updatedAt: new Date() }).where(eq(reports.id, reportId));
  await journaliser(db, { actorUserId: adminId, action: "report_saved", targetType: "campaign", targetId: verif.rapport.campaignId });
  return { ok: true, valeur: undefined };
}

export async function refuserRapport(db: Db, adminId: string, reportId: string, motif: string): Promise<Resultat> {
  const verif = await rapportModifiable(db, reportId);
  if (!verif.ok) return verif;
  const m = motif.trim();
  if (m.length < 5 || m.length > 1000) return { ok: false, erreur: "rapportMotifRequis" };
  await db.update(reports).set({ status: "rejected", rejectionReason: m, updatedAt: new Date() }).where(eq(reports.id, reportId));
  await journaliser(db, { actorUserId: adminId, action: "report_rejected", targetType: "campaign", targetId: verif.rapport.campaignId, details: { motif: m } });
  return { ok: true, valeur: undefined };
}

export const schemaListeControle = z.object({
  sources: z.literal(true),
  seuil: z.literal(true),
  langage: z.literal(true),
  limites: z.literal(true),
});

export async function validerRapport(
  db: Db,
  adminId: string,
  reportId: string,
  saisie: { contenu: unknown; liste: unknown },
  maintenant = new Date(),
): Promise<Resultat> {
  const verif = await rapportModifiable(db, reportId);
  if (!verif.ok) return verif;
  if (!schemaListeControle.safeParse(saisie.liste).success) return { ok: false, erreur: "rapportListeIncomplete" };
  const lecture = schemaContenuRapport.safeParse(saisie.contenu);
  if (!lecture.success) return { ok: false, erreur: "rapportContenuInvalide" };
  if (!lecture.data.synthese.trim()) return { ok: false, erreur: "rapportSyntheseVide" };
  const [admin] = await db.select().from(users).where(eq(users.id, adminId));
  if (!admin?.aiLiteracyAt) return { ok: false, erreur: "rapportFormationIARequise" };

  await db
    .update(reports)
    .set({
      status: "validated",
      finalText: JSON.stringify(lecture.data),
      checkSourcesVerified: true,
      checkNoSmallGroup: true,
      checkLanguageRule: true,
      checkLimitsMentioned: true,
      validatedBy: adminId,
      validatedAt: maintenant,
      updatedAt: maintenant,
    })
    .where(eq(reports.id, reportId));
  await journaliser(db, { actorUserId: adminId, action: "report_validated", targetType: "campaign", targetId: verif.rapport.campaignId });
  return { ok: true, valeur: undefined };
}

// Interrupteur IA d'une campagne
export async function changerIACampagne(db: Db, adminId: string, campaignId: string, active: boolean): Promise<Resultat> {
  await db.update(campaigns).set({ aiDraftingEnabled: active }).where(eq(campaigns.id, campaignId));
  await journaliser(db, { actorUserId: adminId, action: "campaign_ai_toggled", targetType: "campaign", targetId: campaignId, details: { active } });
  return { ok: true, valeur: undefined };
}

// Formation à la maîtrise de l'IA (article 4 AI Act) : déclarée par le praticien lui-même, journalisée
export async function enregistrerFormationIA(db: Db, adminId: string, saisie: { date: string; note: string }): Promise<Resultat> {
  const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).safeParse(saisie.date);
  const note = saisie.note.trim();
  if (!date.success || note.length < 3 || note.length > 500) return { ok: false, erreur: "formationInvalide" };
  if (date.data > new Date().toISOString().slice(0, 10)) return { ok: false, erreur: "formationDateFuture" };
  await db.update(users).set({ aiLiteracyAt: date.data, aiLiteracyNote: note }).where(eq(users.id, adminId));
  await journaliser(db, { actorUserId: adminId, action: "ai_literacy_recorded", targetType: "user", targetId: adminId, details: { date: date.data } });
  return { ok: true, valeur: undefined };
}

export type { ContenuRapport };
