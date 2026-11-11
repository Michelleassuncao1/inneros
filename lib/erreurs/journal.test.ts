// Tests du suivi des erreurs (étape 10) : regroupement, aucune donnée personnelle, conservation.
import { beforeEach, describe, expect, it } from "vitest";
import { errorEvents } from "../db/schema";
import { creerBaseDeTest } from "../db/test-db";
import type { Db } from "../db/types";
import {
  enregistrerErreur,
  erreursRecentes,
  marquerErreurTraitee,
  nettoyerRoute,
  nombreErreursNonTraitees,
  purgerErreurs,
  typeErreur,
} from "./journal";

const T0 = new Date("2026-11-11T10:00:00Z");
const jours = (n: number) => new Date(T0.getTime() + n * 86_400_000);

let db: Db;

beforeEach(async () => {
  ({ db } = await creerBaseDeTest());
});

describe("nettoyage des informations reçues", () => {
  it("retire la langue, les identifiants, les codes et tout ce qui suit ? ou #", () => {
    expect(nettoyerRoute("/fr/admin/entreprises/3f2a9c1e-5b7d-4e8a-9c0b-1d2e3f4a5b6c/plan")).toBe("/[locale]/admin/entreprises/[id]/plan");
    expect(nettoyerRoute("/pt-BR/q#K7QF3MZPX2")).toBe("/[locale]/q");
    expect(nettoyerRoute("/fr/ateliers/inscription?email=claire@exemple.be")).toBe("/[locale]/ateliers/inscription");
    expect(nettoyerRoute("/fr/espace/Claire.Dupont")).toBe("/[locale]/espace/[id]");
    expect(nettoyerRoute("/[locale]/admin/campagnes/[id]")).toBe("/[locale]/admin/campagnes/[id]");
  });

  it("n'accepte qu'un nom de type d'erreur, jamais un message", () => {
    expect(typeErreur("TypeError")).toBe("TypeError");
    expect(typeErreur("Impossible de joindre claire@exemple.be")).toBe("Error");
    expect(typeErreur(undefined)).toBe("Error");
  });
});

describe("journal des erreurs", () => {
  it("regroupe les erreurs identiques et compte les occurrences", async () => {
    await enregistrerErreur(db, { source: "serveur", route: "/[locale]/admin", type: "TypeError", digest: "123456" }, T0);
    await enregistrerErreur(db, { source: "serveur", route: "/[locale]/admin", type: "TypeError", digest: "789" }, jours(1));
    await enregistrerErreur(db, { source: "navigateur", route: "/fr/q#CODE", type: "Error" }, jours(1));
    const lignes = await erreursRecentes(db, jours(1));
    expect(lignes).toHaveLength(2);
    const serveur = lignes.find((l) => l.source === "serveur")!;
    expect(serveur).toMatchObject({ occurrences: 2, digest: "789", firstAt: T0, lastAt: jours(1) });
    expect(JSON.stringify(lignes)).not.toContain("CODE");
  });

  it("une erreur traitée qui revient redevient nouvelle", async () => {
    await enregistrerErreur(db, { source: "serveur", route: "/[locale]/admin", type: "Error" }, T0);
    const [e] = await db.select().from(errorEvents);
    await marquerErreurTraitee(db, e.id, T0);
    expect(await nombreErreursNonTraitees(db)).toBe(0);
    await enregistrerErreur(db, { source: "serveur", route: "/[locale]/admin", type: "Error" }, jours(2));
    expect(await nombreErreursNonTraitees(db)).toBe(1);
  });

  it("l'onglet montre 30 jours, la tâche de nuit efface après 90 jours", async () => {
    await enregistrerErreur(db, { source: "serveur", route: "/[locale]/a", type: "Error" }, T0);
    await enregistrerErreur(db, { source: "serveur", route: "/[locale]/b", type: "Error" }, jours(60));
    expect(await erreursRecentes(db, jours(61))).toHaveLength(1);
    expect(await purgerErreurs(db, jours(91))).toBe(1);
    expect(await db.select().from(errorEvents)).toHaveLength(1);
  });
});
