// COPSOQ III, version française (questionnaire et guide de cotation du 14/09/2018) : fichier conforme,
// 54 items des 24 échelles du guide + 4 comportements indésirables (Q55 à Q62), version réservée à la France.
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { aggregates, behaviourCounts, instruments, users } from "../db/schema";
import { creerBaseDeTest } from "../db/test-db";
import { construireChargeUtile, verifierChargeUtile } from "../rapport/charge-utile";
import { lireResultats } from "../resultats/agregats";
import { creerCampagneDemo } from "../resultats/demo";
import { comptesComportements, scorerReponse } from "../scoring";
import { enregistrerInstrument, lireInstrument, questionnaireAutorise } from "./chargement";
import { cleItem, type FichierInstrument } from "./format";
import { consignesAAfficher, ITEMS_PAR_PAGE, regrouperEnPages } from "./pages";
import { itemRepondu, itemVisible, reponsesCoherentes, reponsesCompletes } from "./reponses";

beforeAll(() => {
  process.env.AUTH_SECRET = randomBytes(32).toString("base64");
});

const lire = (): FichierInstrument => {
  const r = lireInstrument(JSON.parse(readFileSync("instruments/copsoq3/copsoq3-fr-2018-09-14.fr.json", "utf8")));
  if (!r.ok) throw new Error(r.erreurs.join(", "));
  return r.fichier;
};
const q2 = (n: number) => `q${String(n).padStart(2, "0")}`;

// Questions dont le questionnaire affiche les codes 0 → 4
const CODES_INVERSES = ["q03", "q08", "q09", "q14", "q21", "q23", "q24", "q31", "q37", "q41", "q46", "q48", "q50", "q51", "q52", "q53"];
// Échelles lues « plus haut = plus de ce que dit le nom » (le guide les oriente dans l'autre sens)
const LECTURE_NOM = ["emotion", "conflitval", "insecur", "stress", "epuise"];

describe("COPSOQ III — version française : fichier", () => {
  it("reprend les questions 1 à 62, chacune une seule fois", () => {
    const f = lire();
    const ids = f.dimensions.flatMap((d) => d.items.map((i) => i.id));
    expect([...ids].sort()).toEqual(Array.from({ length: 62 }, (_, i) => q2(i + 1)));
    expect(f.dimensions.filter((d) => d.type !== "comportement")).toHaveLength(24);
    expect(f.dimensions.filter((d) => d.type === "comportement").map((d) => d.id)).toEqual(["sexuel", "menaces", "violence", "harcelement"]);
  });

  it("suit la cotation du questionnaire, sauf l'orientation des cinq échelles lues selon leur nom", () => {
    for (const d of lire().dimensions.filter((x) => x.type !== "comportement")) {
      for (const i of d.items) {
        const attendu = CODES_INVERSES.includes(i.id) !== LECTURE_NOM.includes(d.id) ? "inverse" : "direct";
        expect(`${i.id}:${i.sens}`).toBe(`${i.id}:${attendu}`);
      }
    }
  });

  it("donne 100 au score le plus élevé de chaque échelle, et la satisfaction sur 4 niveaux", () => {
    const f = lire();
    const max = Object.fromEntries(
      f.dimensions
        .filter((d) => d.type !== "comportement")
        .flatMap((d) =>
          d.items.map((i) => {
            const codes = f.echelles_reponse.find((e) => e.id === i.reponse)!.options.map((o) => o.code);
            return [cleItem("copsoq3", i.id), i.sens === "direct" ? Math.max(...codes) : Math.min(...codes)];
          }),
        ),
    );
    const scores = scorerReponse(f, max);
    expect(Object.keys(scores)).toHaveLength(24); // pas de score pour les comportements
    expect(Object.values(scores).every((s) => s === 100)).toBe(true);
    expect(scorerReponse(f, { copsoq3_q49: 2 }).satisf).toBeCloseTo(66.67, 1);
  });

  it("présente les pages sans couper une dimension, avec la définition du harcèlement avant Q61", () => {
    const f = lire();
    const pages = regrouperEnPages(f.dimensions);
    for (const page of pages) expect(page.reduce((s, d) => s + d.items.length, 0)).toBeLessThanOrEqual(ITEMS_PAR_PAGE);
    const consignes = pages.flatMap((p) => consignesAAfficher(p).filter(Boolean));
    expect(consignes[0]).toBe("Ces questions portent sur votre état au cours des 4 dernières semaines.");
    expect(consignes[1]).toMatch(/^Le harcèlement moral veut dire/);
    expect(consignes).toHaveLength(2);
    expect(pages.at(-1)!.map((d) => d.id)).toEqual(["harcelement"]);
  });

  it("n'est proposée qu'aux entreprises françaises", () => {
    const definitions = { fr: lire() };
    expect(questionnaireAutorise(definitions, "FR")).toBe(true);
    expect(questionnaireAutorise(definitions, "BE")).toBe(false);
  });
});

describe("Comportements indésirables : questions « si oui » et choix multiple", () => {
  const f = lire();
  const sexuel = f.dimensions.find((d) => d.id === "sexuel")!;
  const [q55, q56] = sexuel.items;

  it("ne pose « de la part de qui ? » qu'après un « oui »", () => {
    expect(itemVisible(f, sexuel, q56, {})).toBe(false);
    expect(itemVisible(f, sexuel, q56, { copsoq3_q55: 4 })).toBe(false); // Non
    expect(itemVisible(f, sexuel, q56, { copsoq3_q55: null })).toBe(false); // préfère ne pas répondre
    expect(itemVisible(f, sexuel, q56, { copsoq3_q55: 3 })).toBe(true); // Oui, quelquefois
    expect(itemVisible(f, sexuel, q55, {})).toBe(true);
  });

  it("considère un choix multiple répondu dès qu'une case est cochée, ou « je préfère ne pas répondre »", () => {
    expect(itemRepondu(f, q56, {})).toBe(false);
    expect(itemRepondu(f, q56, { copsoq3_q56_0: 0, copsoq3_q56_1: 0, copsoq3_q56_2: 0, copsoq3_q56_3: 0 })).toBe(false);
    expect(itemRepondu(f, q56, { copsoq3_q56_1: 1 })).toBe(true);
    expect(itemRepondu(f, q56, { copsoq3_q56_0: null, copsoq3_q56_1: null, copsoq3_q56_2: null, copsoq3_q56_3: null })).toBe(true);
  });

  it("envoie toutes les clés : vides si la question n'est pas posée, 0 pour les cases non cochées", () => {
    const oui = reponsesCompletes(f, { copsoq3_q55: 1, copsoq3_q56_1: 1, copsoq3_q56_3: 1 });
    expect([oui.copsoq3_q56_0, oui.copsoq3_q56_1, oui.copsoq3_q56_2, oui.copsoq3_q56_3]).toEqual([0, 1, 0, 1]);
    // Réponse changée en « Non » après avoir coché : les cases sont effacées
    const non = reponsesCompletes(f, { copsoq3_q55: 4, copsoq3_q56_1: 1 });
    expect([non.copsoq3_q56_0, non.copsoq3_q56_1]).toEqual([null, null]);
    expect(Object.keys(oui)).toHaveLength(54 + 4 * (1 + 4));
  });

  it("refuse une réponse à une question non posée, ou des cases à moitié vides", () => {
    expect(reponsesCoherentes(f, { copsoq3_q55: 4, copsoq3_q56_0: 1 })).toBe(false);
    expect(reponsesCoherentes(f, { copsoq3_q55: 0, copsoq3_q56_0: 1, copsoq3_q56_1: null })).toBe(false);
    expect(reponsesCoherentes(f, reponsesCompletes(f, { copsoq3_q55: 0, copsoq3_q56_2: 1 }))).toBe(true);
  });

  it("compte les personnes concernées, les fréquences, les auteurs et le cumul", () => {
    const { comptes, cumul } = comptesComportements(f, [
      { copsoq3_q55: 3, copsoq3_q56_0: 1, copsoq3_q56_1: 1, copsoq3_q57: 0, copsoq3_q58_3: 1 },
      { copsoq3_q55: 4, copsoq3_q57: 3, copsoq3_q58_0: null, copsoq3_q58_1: null, copsoq3_q58_2: null, copsoq3_q58_3: null },
      { copsoq3_q55: 4, copsoq3_q57: 4 },
      { copsoq3_q55: null },
      {},
    ]);
    const sexuel = comptes.find((c) => c.id === "sexuel")!;
    expect(sexuel).toMatchObject({ base: 3, concernes: 1, frequences: { 3: 1 }, auteurs: { 0: 1, 1: 1 }, auteursNonPrecises: 0 });
    const menaces = comptes.find((c) => c.id === "menaces")!;
    expect(menaces).toMatchObject({ base: 3, concernes: 2, frequences: { 0: 1, 3: 1 }, auteurs: { 3: 1 }, auteursNonPrecises: 1 });
    expect(cumul).toEqual({ base: 3, auMoinsUn: 2, parNombre: { 2: 1, 1: 1 } });
  });
});

describe("Comportements indésirables : campagne complète", () => {
  it("compte à la clôture pour toute la campagne seulement, jamais par groupe ni sous le seuil", async () => {
    const { db } = await creerBaseDeTest();
    const [admin] = await db
      .insert(users)
      .values({ email: "admin@ima.test", name: "Admin", role: "admin", passwordHash: "x" })
      .returning();
    expect((await enregistrerInstrument(db, lire())).ok).toBe(true);
    const [copsoq] = await db.select().from(instruments).where(eq(instruments.version, "fr-2018-09-14"));
    const campagneId = await creerCampagneDemo(db, {
      adminId: admin.id,
      instrumentIds: [copsoq.id],
      pays: "FR",
      graine: 7,
      groupes: [
        { libelle: "Atelier", attendus: 30, repondants: 25 },
        { libelle: "Bureau", attendus: 14, repondants: 12 },
      ],
      maintenant: new Date("2026-11-10T10:00:00Z"),
    });

    const lignes = await db.select().from(behaviourCounts).where(eq(behaviourCounts.campaignId, campagneId));
    expect(lignes.length).toBeGreaterThan(0);
    expect(lignes.every((l) => l.base >= 10 && l.base <= 37)).toBe(true);
    expect(new Set(lignes.map((l) => l.behaviourId))).toEqual(new Set(["sexuel", "menaces", "violence", "harcelement", "cumul"]));
    // Pas de score enregistré pour les comportements
    const scores = await db.select().from(aggregates).where(eq(aggregates.campaignId, campagneId));
    expect(scores.some((s) => ["sexuel", "menaces", "violence", "harcelement"].includes(s.scaleId))).toBe(false);

    // Lecture : libellés du questionnaire ; total des fréquences = personnes concernées
    const resultats = await lireResultats(db, campagneId, "fr");
    const c = resultats!.questionnaires[0].comportements!;
    expect(c.liste.map((x) => x.nom)).toEqual(["Attentions sexuelles non désirées", "Menaces de violence", "Violence physique", "Harcèlement"]);
    for (const x of c.liste) expect(x.frequences.reduce((s, f) => s + f.n, 0)).toBe(x.concernes);
    expect(c.liste[0].auteurs.map((a) => a.libelle)).toEqual(["Collègues", "Manager/supérieur", "Subordonné(e)", "Client/Personne extérieure"]);
    expect(c.cumul!.base).toBeGreaterThanOrEqual(10);

    // Message pour l'IA : comportements pour toute la campagne, conforme et vérifié
    const { charge, nomEntreprise, seuil } = await construireChargeUtile(db, campagneId, "fr");
    expect(charge.comportements).toHaveLength(4);
    expect(charge.comportements_cumul).toHaveLength(1);
    expect(verifierChargeUtile(charge, { nomEntreprise, seuil })).toEqual([]);
    expect(verifierChargeUtile({ ...charge, comportements: [{ ...charge.comportements[0], base: 9 }] }, { nomEntreprise, seuil })).toContain(
      "comportements sous le seuil",
    );

    // La base refuse un comptage sous le seuil
    await expect(
      db.insert(behaviourCounts).values({
        campaignId: campagneId, instrumentId: copsoq.id, behaviourId: "sexuel", category: "auteur_9", count: 1, base: 9, scoringVersion: "x",
      }),
    ).rejects.toThrow();
  });
});
