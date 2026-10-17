// Contenu d'un rapport InnerOS (étape 8) : le même format pour le brouillon de l'IA, la rédaction
// à la main et le texte validé. Défini par le prompt système prompts/redaction-rapport.system.md.
import { z } from "zod";

export const NIVEAUX_MINDSET = ["travail", "roles", "interactions", "management", "organisation", "environnement"] as const;
export const NATURES = ["donnee", "perception_rapportee", "hypothese", "conclusion_etayee"] as const;
export const CONFIANCES = ["eleve", "intermediaire", "limite"] as const;
export const ACTEURS = ["CPAP", "medecin_travail", "SESMT", "direction", "RH", "CPPT", "referent_harcelement", "CSE"] as const;
export const LANGUES_RAPPORT = ["fr", "nl", "en", "pt-BR"] as const;

const texte = (max: number) => z.string().max(max);

export const schemaContenuRapport = z.object({
  synthese: texte(3000),
  cartographie: z.array(
    z.object({
      niveau: z.enum(NIVEAUX_MINDSET),
      constats: z.array(
        z.object({
          texte: texte(1500),
          nature: z.enum(NATURES),
          confiance: z.enum(CONFIANCES),
          sources: z.array(texte(200)),
        }),
      ),
    }),
  ),
  priorites_proposees: z.array(
    z.object({
      priorite: texte(800),
      justification: texte(1500),
      acteurs: z.array(z.enum(ACTEURS)),
    }),
  ),
  orientations: z.array(texte(800)),
  limites: z.array(texte(800)),
  questions_pour_le_praticien: z.array(texte(800)),
});

export type ContenuRapport = z.infer<typeof schemaContenuRapport>;

export const contenuVide = (): ContenuRapport => ({
  synthese: "",
  cartographie: NIVEAUX_MINDSET.map((niveau) => ({ niveau, constats: [] })),
  priorites_proposees: [],
  orientations: [],
  limites: [],
  questions_pour_le_praticien: [],
});

// Lecture sûre d'un contenu enregistré (texte JSON)
export function lireContenu(brut: string | null | undefined): ContenuRapport | null {
  if (!brut) return null;
  try {
    const r = schemaContenuRapport.safeParse(JSON.parse(brut));
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}
