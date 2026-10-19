// Registre des risques RPS d'une entreprise (module A1). Tenu par IMA et par le conseiller en prévention
// de l'entreprise (référent désigné par IMA). Alimenté par les résultats collectifs des campagnes clôturées
// (jamais par des réponses individuelles), ou à la main. Toutes les écritures sont journalisées.
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { journaliser } from "../audit";
import type { Resultat } from "../admin/entreprises";
import { campaigns, reports, risks, users } from "../db/schema";
import type { Db } from "../db/types";
import { NIVEAUX_MINDSET } from "../rapport/contenu";
import { lireResultats } from "../resultats/agregats";
import {
  classeRisque,
  EXPOSITIONS,
  expositionSuggeree,
  GRAVITES,
  PROBABILITES,
  probabiliteSuggeree,
  scoreKinney,
  type SourceRisque,
} from "./kinney";
import { sensDefavorable } from "./sens";

type Utilisateur = typeof users.$inferSelect;
type LigneRisque = typeof risks.$inferSelect;

// --- Droits -----------------------------------------------------------------------------------

export function peutModifierRegistre(u: Utilisateur, organizationId: string) {
  if (u.disabledAt) return false;
  if (u.role === "admin") return true;
  return u.role === "referent" && u.preventionAdvisor && u.organizationId === organizationId;
}

// Le référent ne voit les résultats d'une campagne qu'une fois le rapport validé par IMA
async function campagnesVisibles(db: Db, organizationId: string, u: Utilisateur) {
  const fermees = await db
    .select()
    .from(campaigns)
    .where(and(eq(campaigns.organizationId, organizationId), eq(campaigns.status, "closed")))
    .orderBy(desc(campaigns.endDate));
  if (u.role === "admin") return fermees;
  if (!fermees.length) return [];
  const validees = await db
    .select({ campaignId: reports.campaignId })
    .from(reports)
    .where(and(inArray(reports.campaignId, fermees.map((c) => c.id)), eq(reports.status, "validated")));
  const ids = new Set(validees.map((v) => v.campaignId));
  return fermees.filter((c) => ids.has(c.id));
}

// --- Lecture ----------------------------------------------------------------------------------

export function enrichir(r: LigneRisque) {
  const score = scoreKinney(Number(r.probability), Number(r.exposure), Number(r.gravity));
  return { ...r, p: Number(r.probability), e: Number(r.exposure), g: Number(r.gravity), score, classe: classeRisque(score, r.source) };
}
export type Risque = ReturnType<typeof enrichir>;

export async function lireRegistre(db: Db, u: Utilisateur, organizationId: string) {
  if (u.role !== "admin" && !peutModifierRegistre(u, organizationId)) return null;
  const lignes = await db.select().from(risks).where(eq(risks.organizationId, organizationId));
  const visibles = new Set((await campagnesVisibles(db, organizationId, u)).map((c) => c.id));
  return lignes
    .filter((r) => u.role === "admin" || r.campaignId === null || visibles.has(r.campaignId))
    .map(enrichir)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
}

// --- Propositions issues des campagnes -----------------------------------------------------------

export type Proposition = {
  campaignId: string;
  reference: string;
  instrumentId: string;
  scaleId: string;
  source: Exclude<SourceRisque, "manuel">;
  nom: string;
  niveau: (typeof NIVEAUX_MINDSET)[number] | null;
  detail: string; // « 62,4 / 100 (n = 37) » ou « 3 sur 37 répondants »
  groupes: string[]; // groupes affichables de la campagne
  p: number;
  e: number;
  dejaAuRegistre: boolean;
  obligatoire: boolean; // comportement indésirable signalé
};

const estNiveau = (n: string | null): n is (typeof NIVEAUX_MINDSET)[number] =>
  !!n && (NIVEAUX_MINDSET as readonly string[]).includes(n);

export async function propositions(db: Db, u: Utilisateur, organizationId: string, langue: string) {
  const liste: Proposition[] = [];
  const existants = await db
    .select({ campaignId: risks.campaignId, instrumentId: risks.instrumentId, scaleId: risks.scaleId })
    .from(risks)
    .where(eq(risks.organizationId, organizationId));
  const deja = new Set(existants.map((r) => `${r.campaignId}:${r.instrumentId}:${r.scaleId}`));
  const nombre = (v: number) => new Intl.NumberFormat(langue, { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(v);

  for (const c of await campagnesVisibles(db, organizationId, u)) {
    const resultats = await lireResultats(db, c.id, langue);
    if (!resultats) continue;
    const groupes = resultats.groupes.map((g) => g.libelle);
    for (const q of resultats.questionnaires) {
      for (const d of q.dimensions) {
        const ensemble = d.resultats.find((r) => r.groupId === null);
        if (!ensemble) continue;
        const sens = sensDefavorable(q.code, d.id);
        const [min, max] = d.etendue;
        const sur100 = ((ensemble.moyenne - min) / (max - min)) * 100;
        liste.push({
          campaignId: c.id,
          reference: c.mandateReference,
          instrumentId: q.instrumentId,
          scaleId: d.id,
          source: "echelle",
          nom: d.nom,
          niveau: estNiveau(d.niveau) ? d.niveau : null,
          detail: `${nombre(ensemble.moyenne)}${max === 100 ? " / 100" : ` (${min}–${max})`} (n = ${ensemble.n})`,
          groupes,
          p: sens ? probabiliteSuggeree(sur100, sens) : 1,
          e: expositionSuggeree(),
          dejaAuRegistre: deja.has(`${c.id}:${q.instrumentId}:${d.id}`),
          obligatoire: false,
        });
      }
      for (const b of q.comportements?.liste ?? []) {
        if (!b.concernes) continue;
        const plusFrequente = b.frequences.findIndex((f) => f.n > 0);
        liste.push({
          campaignId: c.id,
          reference: c.mandateReference,
          instrumentId: q.instrumentId,
          scaleId: b.id,
          source: "comportement",
          nom: b.nom,
          niveau: "interactions",
          detail: `${b.concernes} / ${b.base}`,
          groupes: [], // jamais par groupe (décision du 17/10/2026)
          // Situation déjà survenue : « tout à fait possible », ou « on peut s'y attendre » à partir de 10 %
          p: b.concernes / b.base >= 0.1 ? 10 : 6,
          e: expositionSuggeree(plusFrequente),
          dejaAuRegistre: deja.has(`${c.id}:${q.instrumentId}:${b.id}`),
          obligatoire: true,
        });
      }
    }
  }
  // Comportements signalés d'abord, puis du plus probable au moins probable
  return liste.sort((a, b) => Number(b.obligatoire) - Number(a.obligatoire) || b.p - a.p);
}

// --- Écriture ---------------------------------------------------------------------------------

const valeurDans = (liste: readonly number[]) =>
  z.coerce.number().refine((v) => liste.includes(v), "valeur hors grille");
// Les textes ne doivent citer personne : adresses e-mail et numéros de téléphone refusés
const sansCoordonnees = (s: string) => !/[^\s@]+@[^\s@]+\.[^\s@]+/.test(s) && !/(\+?\d[\s.-]?){8,}/.test(s);
const texte = (max: number) => z.string().trim().max(max).refine(sansCoordonnees, "coordonnees");

export const schemaRisque = z.object({
  titre: texte(200).pipe(z.string().min(1)),
  description: texte(2000).optional(),
  niveau: z.enum(NIVEAUX_MINDSET).nullable().optional(),
  groupes: z.array(z.string().max(80)).max(50).default([]),
  p: valeurDans(PROBABILITES),
  e: valeurDans(EXPOSITIONS),
  g: valeurDans(GRAVITES),
  justification: texte(2000).optional(),
  statut: z.enum(["ouvert", "traite", "clos"]).default("ouvert"),
});
export type SaisieRisque = z.input<typeof schemaRisque>;

function erreurSaisie(e: z.ZodError) {
  return e.issues.some((i) => i.message === "coordonnees") ? "risqueCoordonnees" : "saisieInvalide";
}

const detailsJournal = (v: z.output<typeof schemaRisque>) => ({ p: v.p, e: v.e, g: v.g, score: scoreKinney(v.p, v.e, v.g), statut: v.statut });

export async function creerRisque(
  db: Db,
  u: Utilisateur,
  organizationId: string,
  saisie: SaisieRisque,
  origine?: { campaignId: string; instrumentId: string; scaleId: string },
  langue = "fr",
): Promise<Resultat<{ id: string }>> {
  if (!peutModifierRegistre(u, organizationId)) return { ok: false, erreur: "introuvable" };
  const lu = schemaRisque.safeParse(saisie);
  if (!lu.success) return { ok: false, erreur: erreurSaisie(lu.error) };
  const v = lu.data;

  let source: SourceRisque = "manuel";
  let groupes: string[] = [];
  if (origine) {
    // L'échelle doit faire partie des résultats visibles de cette campagne de l'entreprise
    const p = (await propositions(db, u, organizationId, langue)).find(
      (x) => x.campaignId === origine.campaignId && x.instrumentId === origine.instrumentId && x.scaleId === origine.scaleId,
    );
    if (!p) return { ok: false, erreur: "introuvable" };
    if (p.dejaAuRegistre) return { ok: false, erreur: "risqueDejaAuRegistre" };
    source = p.source;
    // Groupes : seulement ceux présentés dans les résultats ; jamais pour un comportement indésirable
    groupes = v.groupes.filter((g) => p.groupes.includes(g));
  }

  const [ligne] = await db
    .insert(risks)
    .values({
      organizationId,
      campaignId: origine?.campaignId ?? null,
      instrumentId: origine?.instrumentId ?? null,
      scaleId: origine?.scaleId ?? null,
      source,
      title: v.titre,
      description: v.description || null,
      mindsetLevel: v.niveau ?? null,
      groupLabels: groupes,
      probability: String(v.p),
      exposure: String(v.e),
      gravity: String(v.g),
      justification: v.justification || null,
      status: v.statut,
      createdBy: u.id,
      updatedBy: u.id,
    })
    .returning({ id: risks.id });
  await journaliser(db, { actorUserId: u.id, action: "risk_created", targetType: "risk", targetId: ligne.id, details: { ...detailsJournal(v), source } });
  return { ok: true, valeur: { id: ligne.id } };
}

export async function modifierRisque(db: Db, u: Utilisateur, riskId: string, saisie: SaisieRisque, langue = "fr"): Promise<Resultat> {
  const [r] = await db.select().from(risks).where(eq(risks.id, riskId));
  if (!r || !peutModifierRegistre(u, r.organizationId)) return { ok: false, erreur: "introuvable" };
  // Un référent ne modifie pas un risque d'une campagne dont le rapport n'est pas encore validé
  const registre = await lireRegistre(db, u, r.organizationId);
  if (!registre?.some((x) => x.id === riskId)) return { ok: false, erreur: "introuvable" };
  const lu = schemaRisque.safeParse(saisie);
  if (!lu.success) return { ok: false, erreur: erreurSaisie(lu.error) };
  const v = lu.data;

  let groupes: string[] = [];
  if (r.source === "echelle" && r.campaignId) {
    const resultats = await lireResultats(db, r.campaignId, langue);
    const affichables = resultats?.groupes.map((g) => g.libelle) ?? [];
    groupes = v.groupes.filter((g) => affichables.includes(g));
  }
  await db
    .update(risks)
    .set({
      title: v.titre,
      description: v.description || null,
      mindsetLevel: v.niveau ?? null,
      groupLabels: groupes,
      probability: String(v.p),
      exposure: String(v.e),
      gravity: String(v.g),
      justification: v.justification || null,
      status: v.statut,
      updatedBy: u.id,
      updatedAt: new Date(),
    })
    .where(eq(risks.id, riskId));
  await journaliser(db, { actorUserId: u.id, action: "risk_updated", targetType: "risk", targetId: riskId, details: detailsJournal(v) });
  return { ok: true, valeur: undefined };
}

export async function supprimerRisque(db: Db, u: Utilisateur, riskId: string): Promise<Resultat> {
  const [r] = await db.select().from(risks).where(eq(risks.id, riskId));
  if (!r || !peutModifierRegistre(u, r.organizationId)) return { ok: false, erreur: "introuvable" };
  const registre = await lireRegistre(db, u, r.organizationId);
  if (!registre?.some((x) => x.id === riskId)) return { ok: false, erreur: "introuvable" };
  // Un comportement indésirable signalé ne quitte pas le registre : il est clôturé, avec une justification
  if (r.source === "comportement") return { ok: false, erreur: "risqueComportementObligatoire" };
  await db.delete(risks).where(eq(risks.id, riskId));
  await journaliser(db, { actorUserId: u.id, action: "risk_deleted", targetType: "risk", targetId: riskId, details: { source: r.source } });
  return { ok: true, valeur: undefined };
}

// --- Désignation du conseiller en prévention (IMA) ------------------------------------------------

export async function designerConseillerPrevention(
  db: Db,
  adminId: string,
  organizationId: string,
  referentId: string,
  valeur: boolean,
): Promise<Resultat> {
  const [r] = await db
    .update(users)
    .set({ preventionAdvisor: valeur })
    .where(and(eq(users.id, referentId), eq(users.role, "referent"), eq(users.organizationId, organizationId)))
    .returning({ id: users.id });
  if (!r) return { ok: false, erreur: "introuvable" };
  await journaliser(db, {
    actorUserId: adminId,
    action: valeur ? "prevention_advisor_granted" : "prevention_advisor_revoked",
    targetType: "user",
    targetId: referentId,
  });
  return { ok: true, valeur: undefined };
}
