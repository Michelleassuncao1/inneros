// Moteur de calcul (étape 6, règle 4 : calcul déterministe). Fonctions pures : les mêmes réponses
// donnent toujours le même score. Les scores individuels ne sont ni enregistrés ni affichés : ils
// servent uniquement à calculer les agrégats de groupe (étape 7).
//
// Règles (cahier, section 4, et manuels des questionnaires) :
// - COPSOQ III : réponses recodées de 0 à 100 selon le sens de l'item ; moyenne des items répondus
//   si au moins la moitié des items de l'échelle sont renseignés ;
// - CBI : même recodage (« toujours » = 100), item inversé selon la définition ; moyenne si le minimum
//   du manuel est atteint (3 sur 6 personnel, 4 sur 7 travail, 3 sur 6 bénéficiaires), réglable ;
// - Flourishing Scale : somme des 8 items (8 à 56), seulement si les 8 sont renseignés.
// « Je préfère ne pas répondre » (null) et les options marquées « manquant » comptent comme non répondues.
import { cleItem, cleOption, type FichierInstrument } from "../instruments/format";

// Version des règles de calcul, enregistrée avec chaque agrégat
export const VERSION_CALCUL = "calcul-1";

export type Reponses = Record<string, number | null | undefined>;
type Dimension = FichierInstrument["dimensions"][number];

type Regle = {
  calcul: "moyenne" | "somme";
  minimum: (nombreItems: number) => number; // nombre minimal d'items répondus pour calculer un score
  minimumParDimension?: Record<string, number>;
};

const auMoinsLaMoitie = (n: number) => Math.ceil(n / 2);

export const REGLES: Record<string, Regle> = {
  copsoq3: { calcul: "moyenne", minimum: auMoinsLaMoitie },
  cbi: { calcul: "moyenne", minimum: auMoinsLaMoitie, minimumParDimension: { pb: 3, wb: 4, cb: 3 } },
  flourishing: { calcul: "somme", minimum: (n) => n },
  innerostest: { calcul: "moyenne", minimum: auMoinsLaMoitie }, // questionnaire de test
};

export type Reglages = { minimumParDimension?: Record<string, number> };

function regleDe(instrument: string): Regle {
  const regle = REGLES[instrument];
  if (!regle) throw new Error(`aucune règle de calcul pour le questionnaire « ${instrument} »`);
  return regle;
}

// Valeur d'une réponse pour le calcul, ou null si l'item n'est pas répondu
function valeurItem(f: FichierInstrument, item: Dimension["items"][number], code: number | null | undefined, calcul: Regle["calcul"]) {
  if (code === null || code === undefined) return null;
  const echelle = f.echelles_reponse.find((e) => e.id === item.reponse);
  const option = echelle?.options.find((o) => o.code === code);
  if (!echelle || !option) throw new Error(`réponse ${code} inconnue pour l'item ${item.id}`);
  if (option.manquant) return null;

  const codes = echelle.options.filter((o) => !o.manquant).map((o) => o.code);
  const [min, max] = [Math.min(...codes), Math.max(...codes)];
  const oriente = item.sens === "inverse" ? max + min - code : code;
  // Moyenne : recodage de 0 à 100 ; somme : valeur brute (ex. Flourishing 1 à 7)
  return calcul === "moyenne" ? ((oriente - min) / (max - min)) * 100 : oriente;
}

// Score d'une dimension pour un répondant, ou null si trop peu d'items sont répondus
export function scorerDimension(f: FichierInstrument, d: Dimension, reponses: Reponses, reglages: Reglages = {}) {
  const regle = regleDe(f.instrument);
  const valeurs = d.items
    .map((i) => valeurItem(f, i, reponses[cleItem(f.instrument, i.id)], regle.calcul))
    .filter((v): v is number => v !== null);
  const minimum =
    reglages.minimumParDimension?.[d.id] ?? regle.minimumParDimension?.[d.id] ?? regle.minimum(d.items.length);
  if (valeurs.length < Math.max(1, minimum)) return null;
  const somme = valeurs.reduce((s, v) => s + v, 0);
  return regle.calcul === "somme" ? somme : somme / valeurs.length;
}

// Scores de toutes les échelles d'un questionnaire pour un répondant (les comportements indésirables
// n'ont pas de score : ils sont comptés, voir comptesComportements)
export function scorerReponse(f: FichierInstrument, reponses: Reponses, reglages: Reglages = {}) {
  return Object.fromEntries(
    f.dimensions.filter((d) => d.type !== "comportement").map((d) => [d.id, scorerDimension(f, d, reponses, reglages)]),
  );
}

// --- Comportements indésirables (COPSOQ français Q55 à Q62) ---------------------------------------
// Pour chaque comportement : personnes ayant répondu à la question de fréquence (base), personnes
// concernées (réponse « oui »), répartition par fréquence et par type d'auteur (plusieurs choix possibles).
// Total : personnes concernées par au moins un comportement, et par nombre de comportements.

export type CompteComportement = {
  id: string;
  base: number;
  concernes: number;
  frequences: Record<number, number>;
  auteurs: Record<number, number>;
  auteursNonPrecises: number; // personnes concernées qui ont préféré ne pas dire de la part de qui
};

export function comptesComportements(f: FichierInstrument, liste: Reponses[]) {
  const dims = f.dimensions.filter((d) => d.type === "comportement");
  const comptes: CompteComportement[] = dims.map((d) => ({ id: d.id, base: 0, concernes: 0, frequences: {}, auteurs: {}, auteursNonPrecises: 0 }));
  const cumul = { base: 0, auMoinsUn: 0, parNombre: {} as Record<number, number> };
  for (const reponses of liste) {
    let repondu = false;
    let nombre = 0;
    dims.forEach((d, j) => {
      const [frequence, auteurs] = d.items;
      const v = reponses[cleItem(f.instrument, frequence.id)];
      if (v === null || v === undefined) return;
      repondu = true;
      const c = comptes[j];
      c.base++;
      if (!auteurs.si!.codes.includes(v)) return;
      nombre++;
      c.concernes++;
      c.frequences[v] = (c.frequences[v] ?? 0) + 1;
      const codes = f.echelles_reponse.find((e) => e.id === auteurs.reponse)!.options.map((o) => o.code);
      const coches = codes.filter((code) => reponses[cleOption(f.instrument, auteurs.id, code)] === 1);
      if (!coches.length) c.auteursNonPrecises++;
      for (const code of coches) c.auteurs[code] = (c.auteurs[code] ?? 0) + 1;
    });
    if (!repondu) continue;
    cumul.base++;
    if (nombre) {
      cumul.auMoinsUn++;
      cumul.parNombre[nombre] = (cumul.parNombre[nombre] ?? 0) + 1;
    }
  }
  return { comptes, cumul };
}
