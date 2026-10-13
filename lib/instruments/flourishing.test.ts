// Flourishing Scale (étape 5B) : 8 items, réponses de 1 à 7, même structure en fr/nl/en.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { lireInstrument } from "./chargement";
import { signature, type FichierInstrument } from "./format";

const lire = (langue: string): FichierInstrument => {
  const r = lireInstrument(JSON.parse(readFileSync(`instruments/flourishing/flourishing-diener-2009.${langue}.json`, "utf8")));
  if (!r.ok) throw new Error(r.erreurs.join(", "));
  return r.fichier;
};

describe("Flourishing Scale", () => {
  it("a 8 items notés de 1 à 7, avec la même structure dans les trois langues", () => {
    const [fr, nl, en] = ["fr", "nl", "en"].map(lire);
    expect(signature(nl)).toBe(signature(fr));
    expect(signature(en)).toBe(signature(fr));
    expect(fr.dimensions[0].items).toHaveLength(8);
    expect(fr.echelles_reponse[0].options.map((o) => o.code)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(fr.pays).toBeUndefined(); // proposée dans tous les pays
  });
});
