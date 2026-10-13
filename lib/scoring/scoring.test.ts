// Étape 6 : les 5 cas de référence validés par Michelle (calculables à la main).
//
// | Cas | Données                                                         | Attendu      |
// |-----|-----------------------------------------------------------------|--------------|
// | 1   | COPSOQ QD : toujours, souvent, parfois                          | 75           |
// | 2   | COPSOQ CT : toujours, parfois, —, jamais, CT5 (inversé) rarement | 56,25        |
// | 3   | COPSOQ QL : pas de superviseur ×2, dans une grande mesure       | pas de score |
// | 4   | CBI travail : 4, 3, 2, 1, 0, —, WB7 (inversé) toujours           | 41,67        |
// | 5   | Flourishing : 7 6 5 7 6 5 7 6 → 49 ; une réponse manquante       | 49 / aucun   |
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { cleItem, schemaFichierInstrument, type FichierInstrument } from "../instruments/format";
import { scorerDimension, scorerReponse } from "./index";

const lire = (chemin: string) => schemaFichierInstrument.parse(JSON.parse(readFileSync(chemin, "utf8")));
const copsoq = lire("instruments/copsoq3/copsoq3-be-2023-12-13.fr.json");
const flourishing = lire("instruments/flourishing/flourishing-diener-2009.fr.json");

// CBI : structure du manuel (échelle de travail), avec des textes fictifs en attendant les traductions
const cbiDeTest: FichierInstrument = schemaFichierInstrument.parse({
  format: 2,
  instrument: "cbi",
  version: "test",
  langue: "fr",
  titre: "ITEM DE TEST — CBI",
  source: "Structure du Copenhagen Burnout Inventory (Borritz & Kristensen, 2004), textes fictifs",
  licence: "test",
  test: true,
  echelles_reponse: [
    { id: "frequence", options: [4, 3, 2, 1, 0].map((code) => ({ code, libelle: `ITEM DE TEST — fréquence ${code}` })) },
    { id: "degre", options: [4, 3, 2, 1, 0].map((code) => ({ code, libelle: `ITEM DE TEST — degré ${code}` })) },
  ],
  dimensions: [
    {
      id: "wb",
      nom: "ITEM DE TEST — épuisement lié au travail",
      items: [1, 2, 3, 4, 5, 6, 7].map((n) => ({
        id: `wb${n}`,
        texte: `ITEM DE TEST — question ${n}`,
        reponse: n <= 3 ? "degre" : "frequence",
        sens: n === 7 ? "inverse" : "direct",
      })),
    },
  ],
});

const reponses = (f: FichierInstrument, valeurs: Record<string, number | null>) =>
  Object.fromEntries(Object.entries(valeurs).map(([item, v]) => [cleItem(f.instrument, item), v]));
const dimension = (f: FichierInstrument, id: string) => f.dimensions.find((d) => d.id === id)!;

describe("Moteur de calcul — cas de référence", () => {
  it("cas 1 : COPSOQ, exigences quantitatives = 75", () => {
    const r = reponses(copsoq, { qd1: 4, qd2: 3, qd3: 2 });
    expect(scorerDimension(copsoq, dimension(copsoq, "qd"), r)).toBe(75);
  });

  it("cas 2 : COPSOQ, temps de travail avec un item inversé et une non-réponse = 56,25", () => {
    const r = reponses(copsoq, { ct1: 4, ct2: 2, ct3: null, ct4: 0, ct5: 1 });
    expect(scorerDimension(copsoq, dimension(copsoq, "ct"), r)).toBe(56.25);
  });

  it("cas 3 : COPSOQ, « pas de superviseur » compte comme manquant → pas de score", () => {
    const r = reponses(copsoq, { qlx1: 9, ql3: 9, ql4: 3 });
    expect(scorerDimension(copsoq, dimension(copsoq, "ql"), r)).toBeNull();
  });

  it("cas 4 : CBI, épuisement lié au travail avec WB7 inversé = 41,67", () => {
    const r = reponses(cbiDeTest, { wb1: 4, wb2: 3, wb3: 2, wb4: 1, wb5: 0, wb6: null, wb7: 4 });
    expect(scorerDimension(cbiDeTest, dimension(cbiDeTest, "wb"), r)).toBeCloseTo(41.667, 3);
  });

  it("cas 5 : Flourishing, somme = 49, et aucun score s'il manque une réponse", () => {
    const valeurs = [7, 6, 5, 7, 6, 5, 7, 6];
    const complet = reponses(flourishing, Object.fromEntries(valeurs.map((v, i) => [`fs${i + 1}`, v])));
    expect(scorerDimension(flourishing, dimension(flourishing, "fs"), complet)).toBe(49);
    const incomplet = { ...complet, [cleItem("flourishing", "fs8")]: null };
    expect(scorerDimension(flourishing, dimension(flourishing, "fs"), incomplet)).toBeNull();
  });
});

describe("Moteur de calcul — règles", () => {
  it("CBI : minimum de réponses du manuel (4 sur 7 pour le travail), réglable", () => {
    const trois = reponses(cbiDeTest, { wb1: 4, wb2: 4, wb3: 4, wb4: null, wb5: null, wb6: null, wb7: null });
    expect(scorerDimension(cbiDeTest, dimension(cbiDeTest, "wb"), trois)).toBeNull();
    expect(scorerDimension(cbiDeTest, dimension(cbiDeTest, "wb"), trois, { minimumParDimension: { wb: 3 } })).toBe(100);
  });

  it("COPSOQ : une échelle de 2 items a un score avec 1 réponse sur 2, pas avec 0", () => {
    const d = dimension(copsoq, "mw");
    expect(scorerDimension(copsoq, d, reponses(copsoq, { mw1: 3, mw2: null }))).toBe(75);
    expect(scorerDimension(copsoq, d, reponses(copsoq, { mw1: null, mw2: null }))).toBeNull();
  });

  it("donne toujours le même résultat pour les mêmes réponses, toutes dimensions comprises", () => {
    const r = reponses(copsoq, Object.fromEntries(copsoq.dimensions.flatMap((d) => d.items.map((i, k) => [i.id, k % 5]))));
    const premier = scorerReponse(copsoq, r);
    expect(scorerReponse(copsoq, r)).toEqual(premier);
    expect(Object.keys(premier)).toHaveLength(26);
  });

  it("refuse un code de réponse inconnu plutôt que de calculer un score faux", () => {
    expect(() => scorerDimension(copsoq, dimension(copsoq, "qd"), reponses(copsoq, { qd1: 7, qd2: 0, qd3: 0 }))).toThrow();
  });
});
