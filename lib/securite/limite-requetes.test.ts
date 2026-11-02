// Tests de la limitation des requêtes (étape 10).
import { beforeEach, describe, expect, it } from "vitest";
import { rateLimits } from "../db/schema";
import { creerBaseDeTest } from "../db/test-db";
import type { Db } from "../db/types";
import { adresseClient, cleRequete, compter, limiteAtteinte, purgerCompteurs, REGLES } from "./limite-requetes";

const T0 = new Date("2026-11-02T09:00:00Z");
const minutes = (n: number) => new Date(T0.getTime() + n * 60 * 1000);

let db: Db;

beforeEach(async () => {
  ({ db } = await creerBaseDeTest());
});

describe("limitation des requêtes", () => {
  it("accepte jusqu'au maximum puis refuse, et recommence après la fenêtre", async () => {
    const { max } = REGLES.lien;
    for (let i = 0; i < max; i++) expect(await compter(db, "lien", "203.0.113.5", minutes(1))).toBe(true);
    expect(await compter(db, "lien", "203.0.113.5", minutes(2))).toBe(false);
    expect(await compter(db, "lien", "203.0.113.6", minutes(2))).toBe(true); // autre appareil
    expect(await compter(db, "inscription", "203.0.113.5", minutes(2))).toBe(true); // autre règle
    expect(await compter(db, "lien", "203.0.113.5", minutes(17))).toBe(true);
  });

  it("limiteAtteinte ne compte pas", async () => {
    for (let i = 0; i < REGLES.code.max - 1; i++) await compter(db, "code", "198.51.100.1", T0);
    expect(await limiteAtteinte(db, "code", "198.51.100.1", T0)).toBe(false);
    expect(await limiteAtteinte(db, "code", "198.51.100.1", T0)).toBe(false);
    await compter(db, "code", "198.51.100.1", T0);
    expect(await limiteAtteinte(db, "code", "198.51.100.1", minutes(1))).toBe(true);
    expect(await limiteAtteinte(db, "code", "198.51.100.1", minutes(11))).toBe(false);
  });

  it("n'enregistre jamais l'adresse, et la clé change chaque jour", async () => {
    await compter(db, "avis", "192.0.2.44", T0);
    const lignes = await db.select().from(rateLimits);
    expect(JSON.stringify(lignes)).not.toContain("192.0.2.44");
    expect(cleRequete("avis", "192.0.2.44", T0)).not.toBe(cleRequete("avis", "192.0.2.44", minutes(24 * 60)));
  });

  it("la tâche de nuit supprime les compteurs de plus de 24 heures", async () => {
    await compter(db, "avis", "192.0.2.1", T0);
    await compter(db, "avis", "192.0.2.2", minutes(23 * 60));
    expect(await purgerCompteurs(db, minutes(25 * 60))).toBe(1);
    expect(await db.select().from(rateLimits)).toHaveLength(1);
  });

  it("lit l'adresse transmise par l'hébergeur", () => {
    expect(adresseClient(new Headers({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" }))).toBe("203.0.113.9");
    expect(adresseClient(new Headers({ "x-real-ip": "203.0.113.8" }))).toBe("203.0.113.8");
    expect(adresseClient(new Headers())).toBe("local");
  });
});
