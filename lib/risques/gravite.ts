// Gravité Kinney proposée pour un risque issu du diagnostic (décision de Michelle du 21/10/2026 : tout est
// pré-rempli, le praticien ou le conseiller en prévention corrige s'il n'est pas d'accord).
// Convention IMA à valider (docs/relecture/risques-relecture.html) :
// - comportements indésirables signalés : 40 (atteinte durable possible) ;
// - indicateurs de santé et de bien-être, exigences émotionnelles, insécurité, conflit travail-vie privée,
//   conflits de valeurs : 15 ;
// - autres facteurs de l'organisation du travail : 7 ;
// - un cran de plus (7 → 15 → 40) si le rapport validé cite l'échelle dans les sources de ses constats.
import { GRAVITES } from "./kinney";

type Gravite = (typeof GRAVITES)[number];

const QUINZE: Record<string, string[]> = {
  copsoq3: [
    // version belge / internationale
    "ed", "he", "ji", "wf", "co", "js", "gh",
    // version française
    "emotion", "insecur", "concil", "conflitval", "stress", "epuise", "santegen", "satisf", "engage",
  ],
  cbi: ["pb", "wb", "cb"],
  flourishing: ["fs"],
};

export function graviteSuggeree(instrument: string, echelle: string, comportement: boolean, citeDansRapport: boolean): Gravite {
  const base: Gravite = comportement ? 40 : QUINZE[instrument]?.includes(echelle) ? 15 : 7;
  if (!citeDansRapport || base === 40) return base;
  return base === 15 ? 40 : 15;
}

// Échelles citées par le rapport validé (identifiants dans les sources des constats)
export function echellesCitees(rapport: { cartographie: { constats: { sources: string[] }[] }[] } | null) {
  const cites = new Set<string>();
  if (!rapport) return cites;
  for (const b of rapport.cartographie) for (const k of b.constats) for (const s of k.sources) for (const mot of s.toLowerCase().split(/[^a-z0-9]+/)) cites.add(mot);
  return cites;
}
