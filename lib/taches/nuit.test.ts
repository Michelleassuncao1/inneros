// Tests des tâches de nuit et de l'alerte de l'espace IMA (étape 10).
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cronRuns } from "../db/schema";
import { creerBaseDeTest } from "../db/test-db";
import type { Db } from "../db/types";
import { type Etape, etatTachesNuit, executerTachesNuit, purgerCarnet } from "./nuit";

const T0 = new Date("2026-11-09T03:00:00Z");
const heures = (n: number) => new Date(T0.getTime() + n * 3_600_000);

let db: Db;

beforeEach(async () => {
  ({ db } = await creerBaseDeTest());
});

describe("tâches de nuit", () => {
  it("toutes les vraies étapes passent sur une base vide et sont notées au carnet", async () => {
    const r = await executerTachesNuit(db, T0);
    expect(r.map((e) => e.etape)).toEqual([
      "suppressions", "ateliers", "compteurs", "propositions", "rappelsPlan", "rappelsSensibilisation", "rappelsAteliers", "erreurs", "carnet",
    ]);
    expect(r.every((e) => e.ok)).toBe(true);
    const [passage] = await db.select().from(cronRuns);
    expect(passage.finishedAt).not.toBeNull();
    expect(passage.steps).toEqual(r);
  });

  it("une étape en échec n'empêche pas les suivantes, et rien d'autre que le nom n'est journalisé", async () => {
    const journal = vi.spyOn(console, "error").mockImplementation(() => {});
    const etapes: Etape[] = [
      { etape: "rappelsPlan", lancer: async () => { throw new Error("Brevo refuse claire@exemple.be"); } },
      { etape: "compteurs", lancer: async () => 4 },
    ];
    const r = await executerTachesNuit(db, T0, etapes);
    expect(r).toEqual([
      { etape: "rappelsPlan", ok: false, nombre: 0 },
      { etape: "compteurs", ok: true, nombre: 4 },
    ]);
    expect(journal.mock.calls.flat().join(" ")).not.toContain("exemple.be");
    journal.mockRestore();
  });
});

describe("alerte de l'espace IMA", () => {
  const ok: Etape[] = [{ etape: "compteurs", lancer: async () => 0 }];
  const ko: Etape[] = [{ etape: "rappelsAteliers", lancer: async () => { throw new Error("panne"); } }];

  it("alerte si jamais lancé", async () => {
    expect(await etatTachesNuit(db, T0)).toMatchObject({ dernierPassage: null, enRetard: true, etapesEchouees: [] });
  });

  it("pas d'alerte après un passage réussi, alerte après 36 heures", async () => {
    await executerTachesNuit(db, T0, ok);
    expect(await etatTachesNuit(db, heures(30))).toMatchObject({ enRetard: false, etapesEchouees: [] });
    expect((await etatTachesNuit(db, heures(37))).enRetard).toBe(true);
  });

  it("signale l'étape échouée au dernier passage", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    await executerTachesNuit(db, T0, ok);
    await executerTachesNuit(db, heures(24), ko);
    const etat = await etatTachesNuit(db, heures(25));
    expect(etat.etapesEchouees).toEqual(["rappelsAteliers"]);
    expect(etat.derniereReussite).toEqual(T0);
    expect(etat.enRetard).toBe(false);
    vi.restoreAllMocks();
  });

  it("le carnet garde 90 jours", async () => {
    await executerTachesNuit(db, new Date("2026-07-01T03:00:00Z"), ok);
    await executerTachesNuit(db, T0, ok);
    expect(await purgerCarnet(db, T0)).toBe(1);
    expect(await db.select().from(cronRuns)).toHaveLength(1);
  });
});
