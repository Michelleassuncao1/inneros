// Étape 7 : agrégats à la clôture, masquage sous le seuil (y compris par différence), participation.
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { aggregates, campaigns, groups, users } from "../db/schema";
import { chargerQuestionnaireDeTest, creerBaseDeTest } from "../db/test-db";
import { groupesAffichables, lireResultats, participation, statistiques } from "./agregats";
import { creerCampagneDemo } from "./demo";

beforeAll(() => {
  process.env.AUTH_SECRET = randomBytes(32).toString("base64");
});

describe("Masquage", () => {
  const ids = (s: Set<string>) => [...s].sort();

  it("montre les groupes d'au moins 10 personnes quand rien n'est masqué", () => {
    const r = groupesAffichables([{ id: "a", n: 25 }, { id: "b", n: 12 }], 10);
    expect(ids(r.visibles)).toEqual(["a", "b"]);
    expect(r.totalVisible).toBe(true);
  });

  it("masque aussi le plus petit groupe visible si le groupe masqué pouvait être retrouvé par soustraction", () => {
    // total 46 - 25 - 12 = 9 : le groupe de 9 serait calculable ; on masque aussi celui de 12 (reste 21)
    const r = groupesAffichables([{ id: "a", n: 25 }, { id: "b", n: 12 }, { id: "c", n: 9 }], 10);
    expect(ids(r.visibles)).toEqual(["a"]);
    expect(r.totalVisible).toBe(true);
  });

  it("n'a rien à masquer de plus quand la part masquée atteint déjà le seuil", () => {
    const r = groupesAffichables([{ id: "a", n: 30 }, { id: "b", n: 9 }, { id: "c", n: 3 }], 10);
    expect(ids(r.visibles)).toEqual(["a"]);
  });

  it("ne montre rien, pas même le total, sous le seuil", () => {
    const r = groupesAffichables([{ id: "a", n: 9 }], 10);
    expect(r.visibles.size).toBe(0);
    expect(r.totalVisible).toBe(false);
  });
});

describe("Statistiques", () => {
  it("moyenne et écart-type d'échantillon", () => {
    const s = statistiques([50, 100]);
    expect(s.moyenne).toBe(75);
    expect(s.ecartType).toBeCloseTo(35.36, 2);
  });
});

describe("Campagne de démonstration (25, 12 et 9 réponses)", () => {
  it("calcule les résultats à la clôture sans que le groupe de 9 apparaisse nulle part", async () => {
    const { db } = await creerBaseDeTest();
    const [admin] = await db
      .insert(users)
      .values({ email: "admin@ima.test", name: "Admin", role: "admin", passwordHash: "x" })
      .returning();
    const campagneId = await creerCampagneDemo(db, {
      adminId: admin.id,
      instrumentIds: [await chargerQuestionnaireDeTest(db, ["fr"])],
      groupes: [
        { libelle: "Soins", attendus: 30, repondants: 25 },
        { libelle: "Administration", attendus: 14, repondants: 12 },
        { libelle: "Logistique", attendus: 12, repondants: 9 },
      ],
      maintenant: new Date("2026-11-10T10:00:00Z"),
    });

    const listeGroupes = await db.select().from(groups).where(eq(groups.campaignId, campagneId));
    const id = (libelle: string) => listeGroupes.find((g) => g.label === libelle)!.id;

    // Agrégats en base : jamais pour Logistique (9) ; jamais sous 10 personnes
    const lignes = await db.select().from(aggregates).where(eq(aggregates.campaignId, campagneId));
    expect(lignes.length).toBeGreaterThan(0);
    expect(lignes.some((l) => l.groupId === id("Logistique"))).toBe(false);
    expect(lignes.every((l) => l.n >= 10)).toBe(true);
    // Pour chaque échelle, la part non montrée (total - groupes) vaut 0 ou au moins 10 personnes
    for (const echelle of new Set(lignes.map((l) => `${l.instrumentId}:${l.scaleId}`))) {
      const ici = lignes.filter((l) => `${l.instrumentId}:${l.scaleId}` === echelle);
      const total = ici.find((l) => l.groupId === null);
      if (!total) continue;
      const reste = total.n - ici.filter((l) => l.groupId !== null).reduce((s, l) => s + l.n, 0);
      expect(reste === 0 || reste >= 10).toBe(true);
    }

    // Tableau de bord : Logistique n'est pas parmi les groupes affichés
    const resultats = await lireResultats(db, campagneId, "fr");
    expect(resultats!.groupes.map((g) => g.libelle)).not.toContain("Logistique");
    expect(resultats!.groupesMasques).toBeGreaterThanOrEqual(1);

    // Participation : 46 réponses sur 46 codes ; Logistique masqué, Administration aussi (soustraction)
    const p = await participation(db, campagneId);
    expect(p!.reponses).toBe(46);
    expect(p!.codes).toBe(46);
    expect(p!.groupes.find((g) => g.libelle === "Logistique")!.reponses).toBeNull();
    expect(p!.groupes.find((g) => g.libelle === "Administration")!.reponses).toBeNull();
    expect(p!.groupes.find((g) => g.libelle === "Soins")!.reponses).toBe(25);

    // Les codes ont été supprimés à la clôture, mais leur nombre est conservé
    const [campagne] = await db.select().from(campaigns).where(eq(campaigns.id, campagneId));
    expect(campagne.status).toBe("closed");
    expect(campagne.tokensIssued).toBe(46);
  });
});
