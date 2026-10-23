// Exports du plan de prévention (module A3, partie 2) : données communes au PDF et à l'Excel, et fichier
// d'échange avec PluriPrev (format « inneros.plan-prevention » 1.0, décrit dans docs/echange/format-pluriprev.md).
// Le fichier d'échange ne contient ni nom de personne, ni nom d'entreprise (code interne seulement), ni réponse,
// ni « questions pour le praticien » (internes à IMA).
import { eq } from "drizzle-orm";
import { z } from "zod";
import { organizations, preventionPlans, risks, users } from "../db/schema";
import type { Db } from "../db/types";
import { CLASSES, scoreKinney, type ClasseRisque } from "../risques/kinney";
import { enrichir } from "../risques/registre";
import { EFFORTS, lireContenuPlan, NIVEAUX_PREVENTION, type ContenuPlan } from "./contenu";
import { finTrimestre, lireAvancement, STATUTS_ACTION, type StatutAction } from "./suivi";

// --- Données communes -------------------------------------------------------------------------

export async function donneesPlan(db: Db, planId: string) {
  const [ligne] = await db
    .select({ plan: preventionPlans, org: organizations })
    .from(preventionPlans)
    .innerJoin(organizations, eq(preventionPlans.organizationId, organizations.id))
    .where(eq(preventionPlans.id, planId));
  if (!ligne) return null;
  const contenu = lireContenuPlan(ligne.plan.content);
  if (!contenu) return null;
  const registre = (await db.select().from(risks).where(eq(risks.organizationId, ligne.plan.organizationId))).map(enrichir);
  const avancement = await lireAvancement(db, planId);
  const nom = async (id: string | null) => (id ? ((await db.select({ name: users.name }).from(users).where(eq(users.id, id)))[0]?.name ?? null) : null);
  return {
    plan: ligne.plan,
    org: ligne.org,
    contenu,
    registre,
    avancement,
    validePar: await nom(ligne.plan.validatedBy),
    adoptePar: await nom(ligne.plan.adoptedBy),
  };
}
export type DonneesPlan = NonNullable<Awaited<ReturnType<typeof donneesPlan>>>;

// Priorité au sens de PluriPrev (low / medium / high / immediate), à partir de la classe Kinney
export const PRIORITE_PLURIPREV: Record<ClasseRisque, "low" | "medium" | "high" | "immediate"> = {
  tres_eleve: "immediate",
  eleve: "high",
  important: "medium",
  possible: "low",
  acceptable: "low",
};

// Statut d'action au sens de PluriPrev (preventive_action.status)
export const STATUT_PLURIPREV: Record<StatutAction, "proposed" | "accepted" | "closed" | "reopened" | "cancelled"> = {
  a_faire: "proposed",
  en_cours: "accepted",
  realisee: "closed",
  reportee: "reopened",
  abandonnee: "cancelled",
};

// --- Format d'échange PluriPrev ---------------------------------------------------------------

export const FORMAT_ECHANGE = { format: "inneros.plan-prevention", version: "1.0" } as const;

const texte = (max: number) => z.string().max(max);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const schemaEchange = z
  .object({
    format: z.literal(FORMAT_ECHANGE.format),
    version: z.literal(FORMAT_ECHANGE.version),
    genere_le: z.string(),
    source: z.object({ application: z.literal("InnerOS"), editeur: z.literal("Institut Mindset en Action") }).strict(),
    organisation: z
      .object({
        code_interne: texte(40),
        pays: z.enum(["BE", "FR", "BR", "PT"]),
        secteur: texte(200),
        tranche_effectif: z.enum(["lt50", "50-249", "250-999", "1000+"]),
      })
      .strict(),
    plan: z
      .object({
        id: z.string().uuid(),
        domaine: z.literal("psychosocial"),
        annee_debut: z.number().int(),
        annee_fin: z.number().int(),
        annee_plan_action: z.number().int(),
        langue: z.enum(["fr", "nl", "en", "pt-BR"]),
        valide_le: date,
        redige_avec_ia: z.boolean(),
        adoption: z.object({ adopte_le: date, organe_consulte: texte(40), avis_le: date.nullable() }).strict().nullable(),
        rappel_risques: texte(3000),
        objectifs: z.array(z.object({ niveau_mindset: texte(20), objectif: texte(800), risques: z.array(z.string().uuid()) }).strict()),
        mesures: z.array(z.object({ niveau_prevention: z.enum(NIVEAUX_PREVENTION), mesure: texte(800), risques: z.array(z.string().uuid()) }).strict()),
        moyens: z.array(texte(800)),
        roles: z.array(z.object({ fonction: texte(120), role: texte(800) }).strict()),
        calendrier: z.array(z.object({ annee: z.number().int(), etapes: z.array(texte(500)) }).strict()),
        evaluation: z.array(texte(800)),
        cadre_legal: texte(2000),
      })
      .strict(),
    risques: z.array(
      z
        .object({
          id: z.string().uuid(),
          domaine: z.literal("psychosocial"),
          origine: z.enum(["echelle", "comportement", "manuel"]),
          intitule: texte(200),
          description: texte(2000),
          niveau_mindset: texte(20).nullable(),
          groupes: z.array(texte(80)),
          methode: z.object({ code: z.literal("KINNEY"), composantes: z.object({ P: z.number(), E: z.number(), G: z.number() }).strict() }).strict(),
          score: z.number(),
          classe: z.enum(CLASSES),
          priorite: z.enum(["low", "medium", "high", "immediate"]),
          justification: texte(2000),
          statut: z.enum(["ouvert", "traite", "clos"]),
        })
        .strict(),
    ),
    actions: z.array(
      z
        .object({
          id: texte(40),
          cle_dedoublonnage: texte(120), // « inneros:<plan>:<action> » : réimporter le même fichier ne crée pas de doublon
          titre: texte(300),
          description: texte(1500),
          risques: z.array(z.string().uuid()),
          niveau_prevention: z.enum(NIVEAUX_PREVENTION),
          responsable_fonction: texte(120),
          annee: z.number().int(),
          trimestre: z.number().int().min(1).max(4),
          echeance: date,
          effort: z.enum(EFFORTS),
          budget: texte(200),
          indicateur: texte(500),
          priorite: z.enum(["low", "medium", "high", "immediate"]),
          statut: z.enum(STATUTS_ACTION),
          statut_pluriprev: z.enum(["proposed", "accepted", "closed", "reopened", "cancelled"]),
          realisee_le: date.nullable(),
          commentaire: texte(500).nullable(),
        })
        .strict(),
    ),
  })
  .strict();

export type Echange = z.infer<typeof schemaEchange>;

const RANG = ["low", "medium", "high", "immediate"] as const;

export function construireEchange(d: DonneesPlan, maintenant = new Date()): Echange {
  const { plan, org, contenu, registre, avancement } = d;
  const ids = new Set(registre.map((r) => r.id));
  const refs = (l: string[]) => l.filter((id) => ids.has(id));
  const risquesExport = registre.map((r) => ({
    id: r.id,
    domaine: "psychosocial" as const,
    origine: r.source,
    intitule: r.title,
    description: r.description ?? "",
    niveau_mindset: r.mindsetLevel,
    groupes: r.groupLabels,
    methode: { code: "KINNEY" as const, composantes: { P: r.p, E: r.e, G: r.g } },
    score: scoreKinney(r.p, r.e, r.g),
    classe: r.classe,
    priorite: PRIORITE_PLURIPREV[r.classe],
    justification: r.justification ?? "",
    statut: r.status,
  }));
  const priorite = new Map(risquesExport.map((r) => [r.id, r.priorite]));
  const echange: Echange = {
    ...FORMAT_ECHANGE,
    genere_le: maintenant.toISOString(),
    source: { application: "InnerOS", editeur: "Institut Mindset en Action" },
    organisation: {
      code_interne: org.internalCode,
      pays: org.country,
      secteur: org.sector,
      tranche_effectif: org.sizeBand as Echange["organisation"]["tranche_effectif"],
    },
    plan: {
      id: plan.id,
      domaine: "psychosocial",
      annee_debut: plan.startYear,
      annee_fin: plan.startYear + 4,
      annee_plan_action: plan.actionYear,
      langue: plan.language,
      valide_le: (plan.validatedAt ?? maintenant).toISOString().slice(0, 10),
      redige_avec_ia: !!plan.aiModel,
      adoption: plan.adoptedAt
        ? { adopte_le: plan.adoptedAt, organe_consulte: plan.consultationBody ?? "", avis_le: plan.consultationDate }
        : null,
      rappel_risques: contenu.rappel_risques,
      objectifs: contenu.objectifs.map((o) => ({ niveau_mindset: o.niveau, objectif: o.objectif, risques: refs(o.risques) })),
      mesures: contenu.mesures.map((m) => ({ niveau_prevention: m.niveau_prevention, mesure: m.mesure, risques: refs(m.risques) })),
      moyens: contenu.moyens,
      roles: contenu.roles,
      calendrier: contenu.calendrier.map((c) => ({ annee: plan.startYear + c.annee - 1, etapes: c.etapes })),
      evaluation: contenu.evaluation,
      cadre_legal: contenu.cadre_legal,
    },
    risques: risquesExport,
    actions: contenu.actions.map((a) => {
      const suivi = avancement.get(a.id);
      const statut = (suivi?.status ?? "a_faire") as StatutAction;
      const vises = refs(a.risques);
      // Priorité de l'action : la plus haute des risques visés (« low » sans risque lié)
      const p = vises.reduce<(typeof RANG)[number]>((m, id) => {
        const r = priorite.get(id) ?? "low";
        return RANG.indexOf(r) > RANG.indexOf(m) ? r : m;
      }, "low");
      return {
        id: a.id,
        cle_dedoublonnage: `inneros:${plan.id}:${a.id}`,
        titre: a.titre,
        description: a.description,
        risques: vises,
        niveau_prevention: a.niveau_prevention,
        responsable_fonction: a.responsable,
        annee: plan.actionYear,
        trimestre: a.trimestre,
        echeance: finTrimestre(plan.actionYear, a.trimestre),
        effort: a.effort,
        budget: a.budget,
        indicateur: a.indicateur,
        priorite: p,
        statut,
        statut_pluriprev: STATUT_PLURIPREV[statut],
        realisee_le: suivi?.doneOn ?? null,
        commentaire: suivi?.comment ?? null,
      };
    }),
  };
  // Contrôle final : le fichier respecte exactement le format publié
  return schemaEchange.parse(echange);
}

export type { ContenuPlan };
