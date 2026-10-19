// Matrice de risques Kinney (module A1, décision de Michelle du 19/10/2026) : Risque = P × E × G.
// Calcul déterministe (règle 4) : l'IA ne calcule ni ne choisit jamais une valeur.
// Grille et seuils classiques de la méthode Fine-Kinney ; exemples de gravité adaptés aux RPS
// (messages « Risques.gravites »), proposés par Claude et à valider par IMA.

export const PROBABILITES = [10, 6, 3, 1, 0.5, 0.2, 0.1] as const;
export const EXPOSITIONS = [10, 6, 3, 2, 1, 0.5] as const;
export const GRAVITES = [100, 40, 15, 7, 3, 1] as const;

export const CLASSES = ["tres_eleve", "eleve", "important", "possible", "acceptable"] as const;
export type ClasseRisque = (typeof CLASSES)[number];

export const SOURCES = ["echelle", "comportement", "manuel"] as const;
export type SourceRisque = (typeof SOURCES)[number];

// Clé d'une valeur pour les messages (« 0.5 » → « 0_5 »)
export const cleValeur = (v: number) => String(v).replace(".", "_");

export function scoreKinney(p: number, e: number, g: number) {
  // Arrondi au dixième : évite les écarts de virgule flottante (0,1 × 0,5 × 7)
  return Math.round(p * e * g * 10) / 10;
}

export function classeDuScore(score: number): ClasseRisque {
  if (score > 400) return "tres_eleve";
  if (score > 200) return "eleve";
  if (score > 70) return "important";
  if (score > 20) return "possible";
  return "acceptable";
}

// Un comportement indésirable signalé (harcèlement, violence…) est toujours au moins « élevé »,
// quel que soit son score : chaque situation appelle une action (obligation légale de prévention).
export function classeRisque(score: number, source: SourceRisque): ClasseRisque {
  const classe = classeDuScore(score);
  if (source !== "comportement") return classe;
  return CLASSES.indexOf(classe) > CLASSES.indexOf("eleve") ? "eleve" : classe;
}

// Probabilité proposée à partir de la moyenne d'une échelle (0 à 100), lue du côté défavorable.
// Convention IMA à valider : il n'existe pas de référence nationale (simple aide, le praticien décide).
export function probabiliteSuggeree(moyenne: number, defavorable: "haut" | "bas"): (typeof PROBABILITES)[number] {
  const u = defavorable === "haut" ? moyenne : 100 - moyenne;
  if (u >= 75) return 10;
  if (u >= 60) return 6;
  if (u >= 45) return 3;
  if (u >= 30) return 1;
  if (u >= 15) return 0.5;
  return 0.2;
}

// Exposition proposée : conditions de travail = quotidienne ; comportements indésirables = fréquence
// la plus élevée signalée (codes du COPSOQ français : 0 quotidien, 1 hebdomadaire, 2 mensuel, 3 quelquefois)
export function expositionSuggeree(frequenceLaPlusHaute?: number): (typeof EXPOSITIONS)[number] {
  if (frequenceLaPlusHaute === undefined) return 6;
  return ([6, 3, 2, 1] as const)[frequenceLaPlusHaute] ?? 1;
}
