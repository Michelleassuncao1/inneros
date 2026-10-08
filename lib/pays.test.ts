// Fiche pays : numéros d'aide selon la langue, et textes présents dans les quatre langues.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { routing } from "../i18n/routing";
import { aidesPour, FICHES_PAYS, languesDuPays, PAYS } from "./pays";

const messages = Object.fromEntries(
  routing.locales.map((l) => [l, JSON.parse(readFileSync(`messages/${l}.json`, "utf8"))]),
);

describe("Fiche pays", () => {
  it("l'anglais est proposé dans tous les pays, le néerlandais en Belgique", () => {
    for (const pays of PAYS) expect(languesDuPays(pays)).toContain("en");
    expect(languesDuPays("BE")).toEqual(["fr", "nl", "en"]);
  });

  it("en Belgique, chaque communauté linguistique voit ses propres lignes d'écoute", () => {
    const numeros = (langue: string) => aidesPour("BE", langue).map((a) => a.numero);
    expect(numeros("fr")).toEqual(["112", "0800 32 123", "107", "100", "101"]);
    expect(numeros("nl")).toEqual(["112", "1813", "106", "100", "101"]);
    expect(numeros("en")).toEqual(["112", "0800 32 123", "107", "1813", "106", "100", "101"]);
  });

  it("chaque numéro d'aide et chaque cadre légal a un texte dans les quatre langues", () => {
    for (const [langue, m] of Object.entries(messages)) {
      for (const pays of PAYS) {
        expect(m.Pays[pays].legal, `${langue} ${pays}`).toBeTruthy();
        for (const aide of FICHES_PAYS[pays].aides) {
          expect(m.Pays[pays].aides[aide.cle], `${langue} ${pays} ${aide.cle}`).toBeTruthy();
        }
      }
    }
  });

  it("chaque langue proposée a son nom dans les quatre langues", () => {
    for (const m of Object.values(messages)) {
      for (const langue of routing.locales) expect(m.Libelles.locale[langue]).toBeTruthy();
    }
  });
});
