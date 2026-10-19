// Contenu d'un plan de prévention RPS (module A2) : le même format pour le brouillon de l'IA, la rédaction
// à la main et le plan validé. Défini par le prompt système prompts/plan-prevention.system.md.
// Les risques sont désignés par leur identifiant du registre (côté IA : R1, R2…, convertis à l'enregistrement).
import { z } from "zod";
import { NIVEAUX_MINDSET } from "../rapport/contenu";
import type { Risque } from "../risques/registre";

export const NIVEAUX_PREVENTION = ["primaire", "secondaire", "tertiaire"] as const;

const texte = (max: number) => z.string().max(max);
const refs = z.array(texte(40));

export const schemaContenuPlan = z.object({
  // Plan global de prévention (5 ans)
  rappel_risques: texte(3000),
  objectifs: z.array(z.object({ niveau: z.enum(NIVEAUX_MINDSET), objectif: texte(800), risques: refs })),
  mesures: z.array(z.object({ niveau_prevention: z.enum(NIVEAUX_PREVENTION), mesure: texte(800), risques: refs })),
  moyens: z.array(texte(800)),
  roles: z.array(z.object({ fonction: texte(120), role: texte(800) })),
  calendrier: z.array(z.object({ annee: z.number().int().min(1).max(5), etapes: z.array(texte(500)) })),
  evaluation: z.array(texte(800)),
  cadre_legal: texte(2000),
  // Plan d'action de la première année
  actions: z.array(
    z.object({
      id: texte(40),
      titre: texte(300),
      description: texte(1500),
      risques: refs,
      niveau_prevention: z.enum(NIVEAUX_PREVENTION),
      responsable: texte(120), // une fonction, jamais un nom (décision du 19/10/2026)
      trimestre: z.number().int().min(1).max(4),
      budget: texte(200),
      indicateur: texte(500),
    }),
  ),
  questions_pour_le_praticien: z.array(texte(800)),
});

export type ContenuPlan = z.infer<typeof schemaContenuPlan>;
export type ActionPlan = ContenuPlan["actions"][number];

export const planVide = (): ContenuPlan => ({
  rappel_risques: "",
  objectifs: [],
  mesures: [],
  moyens: [],
  roles: [],
  calendrier: [1, 2, 3, 4, 5].map((annee) => ({ annee, etapes: [] })),
  evaluation: [],
  cadre_legal: "",
  actions: [],
  questions_pour_le_praticien: [],
});

export function lireContenuPlan(brut: unknown): ContenuPlan | null {
  const r = schemaContenuPlan.safeParse(brut);
  return r.success ? r.data : null;
}

// Risques qui doivent recevoir au moins une action : classe « très élevé » ou « élevé », et tout comportement
// indésirable signalé ; un risque « très élevé » doit avoir une action au premier trimestre.
export function risquesNonCouverts(contenu: ContenuPlan, risques: Pick<Risque, "id" | "title" | "classe" | "source" | "status">[]) {
  return risques
    .filter((r) => r.status !== "clos" && (r.classe === "tres_eleve" || r.classe === "eleve" || r.source === "comportement"))
    .filter((r) => {
      const actions = contenu.actions.filter((a) => a.risques.includes(r.id));
      if (!actions.length) return true;
      return r.classe === "tres_eleve" && !actions.some((a) => a.trimestre === 1);
    });
}
