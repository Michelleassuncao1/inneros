// Format des questionnaires (version 2). Un fichier JSON par questionnaire, par version et par langue.
// Règle 9 : les textes viennent uniquement des fichiers officiels fournis par IMA, jamais d'ailleurs.
// Les identifiants (questionnaire, dimensions, items, échelles de réponse) sont identiques dans toutes
// les langues : c'est ce qui permet de comparer et d'additionner les réponses.
import { z } from "zod";
import { PAYS } from "../pays";

const identifiant = z.string().regex(/^[a-z0-9]{1,20}$/, "identifiant : minuscules et chiffres uniquement");

export const schemaFichierInstrument = z.object({
  format: z.literal(2),
  instrument: identifiant, // copsoq3, cbi, flourishing…
  version: z.string().min(1).max(40),
  langue: z.enum(["fr", "nl", "en", "pt-BR"]),
  titre: z.string().min(1).max(200),
  source: z.string().min(1).max(2000), // citation complète, reprise dans le questionnaire et le rapport
  licence: z.string().min(1).max(1000),
  test: z.boolean().default(false), // items fictifs « ITEM DE TEST »
  // Version nationale : proposée seulement aux entreprises de ces pays (absent = tous les pays)
  pays: z.array(z.enum(PAYS)).min(1).optional(),
  echelles_reponse: z
    .array(
      z.object({
        id: identifiant,
        options: z
          .array(
            z.object({
              code: z.number().int().min(0).max(10),
              libelle: z.string().min(1).max(200),
              // Réponse comptée comme manquante dans les scores (ex. COPSOQ « je n'ai pas de supérieur »)
              manquant: z.literal(true).optional(),
            }),
          )
          .min(2),
      }),
    )
    .min(1),
  dimensions: z
    .array(
      z.object({
        id: identifiant,
        nom: z.string().min(1).max(200),
        consigne: z.string().max(1000).optional(), // phrase d'introduction affichée avant les items
        niveau_mindset: z
          .enum(["travail", "roles", "interactions", "management", "organisation", "environnement", "sante"])
          .optional(),
        // « comportement » : comportements indésirables (COPSOQ français Q55 à Q62). Pas de score :
        // résultats en nombre de personnes concernées, pour toute la campagne seulement (décision du 17/10/2026)
        type: z.literal("comportement").optional(),
        items: z
          .array(
            z.object({
              id: identifiant,
              texte: z.string().min(1).max(500),
              reponse: identifiant, // identifiant de l'échelle de réponse
              sens: z.enum(["direct", "inverse"]),
              // Question posée seulement si la réponse à une autre question de la même dimension est l'un de ces codes
              si: z.object({ item: identifiant, codes: z.array(z.number().int().min(0).max(10)).min(1) }).optional(),
              // Plusieurs réponses possibles : une case à cocher par option, enregistrée 1 (cochée) ou 0
              multiple: z.literal(true).optional(),
            }),
          )
          .min(1),
      }),
    )
    .min(1),
});

export type FichierInstrument = z.infer<typeof schemaFichierInstrument>;

// Clé enregistrée en base pour une réponse : « <questionnaire>_<item> » (ex. copsoq3_qd1)
export function cleItem(instrument: string, item: string) {
  return `${instrument}_${item}`;
}

// Clé enregistrée pour une case d'une question à choix multiple (ex. copsoq3_q56_1)
export function cleOption(instrument: string, item: string, code: number) {
  return `${instrument}_${item}_${code}`;
}

// Contrôles qui vont au-delà de la forme du fichier
export function verifierInstrument(f: FichierInstrument): string[] {
  const erreurs: string[] = [];
  const echelles = new Set(f.echelles_reponse.map((e) => e.id));
  const vus = new Set<string>();
  for (const d of f.dimensions) {
    // Règle 9 : les items d'engagement au travail (WE) du COPSOQ sont exclus
    if (f.instrument === "copsoq3" && d.id.startsWith("we")) erreurs.push(`dimension ${d.id} : engagement au travail (WE) exclu`);
    for (const i of d.items) {
      if (f.instrument === "copsoq3" && i.id.startsWith("we")) erreurs.push(`item ${i.id} : engagement au travail (WE) exclu`);
      if (!echelles.has(i.reponse)) erreurs.push(`item ${i.id} : échelle de réponse « ${i.reponse} » inconnue`);
      if (vus.has(i.id)) erreurs.push(`item ${i.id} : identifiant en double`);
      vus.add(i.id);
      if (i.si) {
        const parent = d.items.find((x) => x.id === i.si!.item);
        if (!parent || d.items.indexOf(parent) > d.items.indexOf(i)) erreurs.push(`item ${i.id} : la condition doit porter sur une question précédente de la même dimension`);
        else if (parent.multiple) erreurs.push(`item ${i.id} : la condition ne peut pas porter sur une question à choix multiple`);
      }
      if (i.multiple && d.type !== "comportement") erreurs.push(`item ${i.id} : choix multiple réservé aux comportements indésirables`);
    }
    if (d.type === "comportement") {
      // Une question de fréquence, puis « de la part de qui ? » posée seulement si la personne est concernée
      const [frequence, auteurs, ...reste] = d.items;
      if (reste.length || !auteurs || frequence.multiple || frequence.si || !auteurs.multiple || auteurs.si?.item !== frequence.id)
        erreurs.push(`dimension ${d.id} : un comportement compte une question de fréquence suivie d'une question « de la part de qui ? »`);
    }
  }
  for (const e of f.echelles_reponse) {
    const codes = e.options.map((o) => o.code);
    if (new Set(codes).size !== codes.length) erreurs.push(`échelle ${e.id} : codes de réponse en double`);
  }
  return erreurs;
}

// Une nouvelle langue doit avoir exactement la même structure que les langues déjà chargées
export function signature(f: FichierInstrument) {
  return JSON.stringify({
    pays: f.pays ?? null,
    echelles: f.echelles_reponse.map((e) => [e.id, e.options.map((o) => (o.manquant ? [o.code, "manquant"] : o.code))]),
    dimensions: f.dimensions.map((d) => [
      d.id,
      d.type ?? "echelle",
      d.items.map((i) => [i.id, i.reponse, i.sens, i.si ?? null, i.multiple ?? false]),
    ]),
  });
}
