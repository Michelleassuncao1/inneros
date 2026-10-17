// Ce qui part vers l'IA (règle 5, cahier section 5) : uniquement les résultats de groupes déjà
// enregistrés (donc ≥ seuil), le contexte du mandat et le code interne de l'entreprise.
// Jamais une réponse individuelle, un nom de personne ou le nom de l'entreprise.
// Le contenu est vérifié avant chaque envoi : toute anomalie bloque l'envoi.
import { asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { aggregates, behaviourCounts, campaigns, groups, instruments, organizations } from "../db/schema";
import type { Db } from "../db/types";
import { definitionPour } from "../instruments/chargement";
import type { FichierInstrument } from "../instruments/format";

const texte = (max: number) => z.string().max(max);

// Format exact du message : tout champ non prévu est refusé (.strict)
export const schemaChargeUtile = z
  .object({
    mandat: z
      .object({
        code_interne: texte(40),
        question_diagnostique: texte(2000),
        perimetre: texte(2000),
        secteur: texte(200),
        pays: z.enum(["BE", "FR", "BR", "PT"]),
        langue: z.enum(["fr", "nl", "en", "pt-BR"]),
        critere_regroupement: texte(40),
        seuil: z.number().int().min(10),
      })
      .strict(),
    groupes: z.array(z.object({ id: texte(10), libelle: texte(80), effectif: z.number().int() }).strict()),
    resultats: z.array(
      z
        .object({
          questionnaire: texte(40),
          echelle: texte(20),
          nom: texte(200),
          niveau_mindset: texte(20).nullable(),
          groupe: texte(10), // « ensemble » ou identifiant de groupe (G1, G2…)
          n: z.number().int(),
          moyenne: z.number(),
          ecart_type: z.number(),
          valeurs: z.enum(["0-100", "8-56"]),
          repere: z.literal("sans_reference_nationale"),
        })
        .strict(),
    ),
    // Comportements indésirables : pour toute la campagne seulement, jamais par groupe
    comportements: z.array(
      z
        .object({
          questionnaire: texte(40),
          comportement: texte(20),
          nom: texte(200),
          base: z.number().int(), // répondants à la question
          concernes: z.number().int(),
          frequences: z.array(z.object({ libelle: texte(200), n: z.number().int() }).strict()),
          auteurs: z.array(z.object({ libelle: texte(200), n: z.number().int() }).strict()),
          auteurs_non_precises: z.number().int(),
        })
        .strict(),
    ),
    comportements_cumul: z.array(
      z.object({ questionnaire: texte(40), base: z.number().int(), au_moins_un: z.number().int() }).strict(),
    ),
    sources: z.array(texte(2000)),
    limites_connues: z.array(texte(500)),
  })
  .strict();

export type ChargeUtile = z.infer<typeof schemaChargeUtile>;

const normaliser = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

// Vérification bloquante avant envoi
export function verifierChargeUtile(charge: unknown, garde: { nomEntreprise: string; seuil: number }) {
  const erreurs: string[] = [];
  const lecture = schemaChargeUtile.safeParse(charge);
  if (!lecture.success) return ["format du message non conforme"];
  const c = lecture.data;
  if (c.resultats.some((r) => r.n < Math.max(10, garde.seuil))) erreurs.push("résultat sous le seuil");
  if (c.groupes.some((g) => g.effectif < Math.max(10, garde.seuil))) erreurs.push("groupe sous le seuil");
  if ([...c.comportements, ...c.comportements_cumul].some((r) => r.base < Math.max(10, garde.seuil))) erreurs.push("comportements sous le seuil");
  const nom = normaliser(garde.nomEntreprise);
  if (nom.length >= 3 && normaliser(JSON.stringify(c)).includes(nom)) erreurs.push("le nom de l'entreprise apparaît dans le message");
  return erreurs;
}

// Construction du message à partir de la base
export async function construireChargeUtile(db: Db, campaignId: string, langue: ChargeUtile["mandat"]["langue"]) {
  const [ligne] = await db
    .select({ campagne: campaigns, entreprise: organizations })
    .from(campaigns)
    .innerJoin(organizations, eq(campaigns.organizationId, organizations.id))
    .where(eq(campaigns.id, campaignId));
  if (!ligne) throw new Error("campagne introuvable");
  const { campagne, entreprise } = ligne;

  const lignes = await db.select().from(aggregates).where(eq(aggregates.campaignId, campaignId));
  const comptages = await db.select().from(behaviourCounts).where(eq(behaviourCounts.campaignId, campaignId));
  const listeGroupes = await db.select().from(groups).where(eq(groups.campaignId, campaignId)).orderBy(asc(groups.label));
  const visibles = listeGroupes.filter((g) => lignes.some((l) => l.groupId === g.id));
  const idGroupe = new Map(visibles.map((g, i) => [g.id, `G${i + 1}`]));

  const liste = lignes.length
    ? await db.select().from(instruments).where(inArray(instruments.id, [...new Set(lignes.map((l) => l.instrumentId))]))
    : [];
  const definitions = new Map<string, FichierInstrument>();
  for (const i of liste) {
    const d =
      definitionPour(i.definitions, langue) ??
      Object.keys((i.definitions ?? {}) as object).map((lg) => definitionPour(i.definitions, lg)).find(Boolean);
    if (d) definitions.set(i.id, d);
  }

  // Comportements indésirables (toute la campagne)
  const comportements: ChargeUtile["comportements"] = [];
  const comportementsCumul: ChargeUtile["comportements_cumul"] = [];
  for (const [instrumentId, def] of definitions) {
    const siennes = comptages.filter((c) => c.instrumentId === instrumentId);
    const valeur = (b: string, cat: string) => siennes.find((c) => c.behaviourId === b && c.category === cat)?.count ?? 0;
    const options = (e: string) => def.echelles_reponse.find((x) => x.id === e)?.options ?? [];
    for (const d of def.dimensions.filter((x) => x.type === "comportement")) {
      const base = siennes.find((c) => c.behaviourId === d.id)?.base;
      if (base === undefined) continue;
      const [frequence, auteurs] = d.items;
      comportements.push({
        questionnaire: def.instrument,
        comportement: d.id,
        nom: d.nom,
        base,
        concernes: valeur(d.id, "concernes"),
        frequences: options(frequence.reponse)
          .filter((o) => auteurs.si!.codes.includes(o.code))
          .map((o) => ({ libelle: o.libelle, n: valeur(d.id, `frequence_${o.code}`) })),
        auteurs: options(auteurs.reponse).map((o) => ({ libelle: o.libelle, n: valeur(d.id, `auteur_${o.code}`) })),
        auteurs_non_precises: valeur(d.id, "auteur_np"),
      });
    }
    const cumul = siennes.find((c) => c.behaviourId === "cumul" && c.category === "concernes");
    if (cumul) comportementsCumul.push({ questionnaire: def.instrument, base: cumul.base, au_moins_un: cumul.count });
  }

  const resultats: ChargeUtile["resultats"] = lignes.map((l) => {
    const def = definitions.get(l.instrumentId)!;
    const dim = def.dimensions.find((d) => d.id === l.scaleId);
    return {
      questionnaire: def.instrument,
      echelle: l.scaleId,
      nom: dim?.nom ?? l.scaleId,
      niveau_mindset: dim?.niveau_mindset ?? null,
      groupe: l.groupId ? idGroupe.get(l.groupId)! : "ensemble",
      n: l.n,
      moyenne: Number(l.mean),
      ecart_type: Number(l.sd),
      valeurs: def.instrument === "flourishing" ? "8-56" : "0-100",
      repere: "sans_reference_nationale",
    };
  });

  const masques = listeGroupes.length - visibles.length;
  const limites = [
    "Aucune valeur de référence nationale n'est fournie : les scores ne peuvent pas être qualifiés de favorables ou défavorables par comparaison.",
    "Données déclaratives, recueillies à un moment donné.",
  ];
  if (campagne.tokensIssued) {
    const total = lignes.filter((l) => l.groupId === null).reduce((m, l) => Math.max(m, l.n), 0);
    limites.push(`Participation : ${total} répondants exploitables pour ${campagne.tokensIssued} codes distribués.`);
  }
  if (masques) limites.push(`${masques} groupe(s) non présenté(s) : moins de ${campagne.groupMinSize} réponses, ou masqué(s) pour protéger l'anonymat.`);

  const charge: ChargeUtile = {
    mandat: {
      code_interne: entreprise.internalCode,
      question_diagnostique: campagne.diagnosticQuestion ?? "",
      perimetre: campagne.perimeter ?? "",
      secteur: entreprise.sector,
      pays: entreprise.country,
      langue,
      critere_regroupement: campagne.groupingCriterion,
      seuil: campagne.groupMinSize,
    },
    groupes: visibles.map((g) => ({
      id: idGroupe.get(g.id)!,
      libelle: g.label,
      effectif: Math.max(...lignes.filter((l) => l.groupId === g.id).map((l) => l.n)),
    })),
    resultats,
    comportements,
    comportements_cumul: comportementsCumul,
    sources: [...definitions.values()].map((d) => `${d.titre} — ${d.source}`),
    limites_connues: limites,
  };
  return { charge, nomEntreprise: entreprise.name, seuil: campagne.groupMinSize, aiActive: campagne.aiDraftingEnabled };
}
