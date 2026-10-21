// Module A1 : matrice Kinney et registre des risques RPS (droits, propositions, contrôles de la base).
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { ajouterReferent } from "../admin/entreprises";
import { auditLog, instruments, reports, risks, users } from "../db/schema";
import { creerBaseDeTest } from "../db/test-db";
import { enregistrerInstrument, lireInstrument } from "../instruments/chargement";
import { creerCampagneDemo } from "../resultats/demo";
import { classeDuScore, classeRisque, expositionSuggeree, probabiliteSuggeree, scoreKinney } from "./kinney";
import { graviteSuggeree, echellesCitees } from "./gravite";
import { creerRisque, designerConseillerPrevention, importerCampagne, lireRegistre, modifierRisque, propositions, supprimerRisque } from "./registre";
import { TABLEAU_SENS } from "./sens";

beforeAll(() => {
  process.env.AUTH_SECRET = randomBytes(32).toString("base64");
});

describe("Matrice Kinney", () => {
  it("calcule P × E × G et classe selon les seuils classiques", () => {
    expect(scoreKinney(10, 6, 40)).toBe(2400);
    expect(scoreKinney(0.1, 0.5, 7)).toBe(0.4);
    expect([401, 400, 201, 200, 71, 70, 21, 20].map(classeDuScore)).toEqual([
      "tres_eleve", "eleve", "eleve", "important", "important", "possible", "possible", "acceptable",
    ]);
  });

  it("classe toujours un comportement indésirable au moins « élevé »", () => {
    expect(classeRisque(6, "comportement")).toBe("eleve");
    expect(classeRisque(6, "echelle")).toBe("acceptable");
    expect(classeRisque(1000, "comportement")).toBe("tres_eleve");
  });

  it("propose une probabilité selon le côté défavorable de l'échelle", () => {
    expect(probabiliteSuggeree(80, "haut")).toBe(10);
    expect(probabiliteSuggeree(80, "bas")).toBe(0.5);
    expect(probabiliteSuggeree(30, "bas")).toBe(6);
    expect(probabiliteSuggeree(5, "haut")).toBe(0.2);
    expect(expositionSuggeree()).toBe(6);
    expect([0, 1, 2, 3].map((i) => expositionSuggeree(i))).toEqual([6, 3, 2, 1]);
  });

  it("propose une gravité selon le type de risque, un cran plus haut si le rapport validé cite l'échelle", () => {
    expect(graviteSuggeree("copsoq3", "charge", false, false)).toBe(7);
    expect(graviteSuggeree("copsoq3", "charge", false, true)).toBe(15);
    expect(graviteSuggeree("copsoq3", "stress", false, false)).toBe(15);
    expect(graviteSuggeree("copsoq3", "stress", false, true)).toBe(40);
    expect(graviteSuggeree("copsoq3", "harcelement", true, false)).toBe(40);
    const cites = echellesCitees({ cartographie: [{ constats: [{ sources: ["stress, G1", "copsoq3:charge"] }] }] });
    expect(["stress", "charge", "g1"].every((x) => cites.has(x))).toBe(true);
  });

  it("connaît le côté défavorable de chaque échelle des questionnaires chargés", () => {
    for (const fichier of ["copsoq3/copsoq3-be-2023-12-13.fr.json", "copsoq3/copsoq3-fr-2018-09-14.fr.json", "flourishing/flourishing-diener-2009.fr.json"]) {
      const r = lireInstrument(JSON.parse(readFileSync(`instruments/${fichier}`, "utf8")));
      if (!r.ok) throw new Error(fichier);
      for (const d of r.fichier.dimensions.filter((x) => x.type !== "comportement"))
        expect(TABLEAU_SENS[r.fichier.instrument]?.[d.id], `${fichier} ${d.id}`).toBeDefined();
    }
  });
});

describe("Registre des risques", () => {
  async function preparer() {
    const { db } = await creerBaseDeTest();
    const [admin] = await db
      .insert(users)
      .values({ email: "admin@ima.test", name: "Admin", role: "admin", passwordHash: "x" })
      .returning();
    const lu = lireInstrument(JSON.parse(readFileSync("instruments/copsoq3/copsoq3-fr-2018-09-14.fr.json", "utf8")));
    if (!lu.ok) throw new Error("copsoq");
    await enregistrerInstrument(db, lu.fichier);
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
    const [lien] = await db.select().from(users).where(eq(users.role, "referent"));
    const orgId = lien.organizationId!;
    const r = await ajouterReferent(db, admin.id, orgId, { name: "Conseillère", email: "cp@entreprise.test" });
    if (!r.ok) throw new Error(r.erreur);
    const [conseiller] = await db.select().from(users).where(eq(users.email, "cp@entreprise.test"));
    return { db, admin, copsoq, campagneId, orgId, conseiller };
  }
  const relire = async (db: Awaited<ReturnType<typeof creerBaseDeTest>>["db"], id: string) =>
    (await db.select().from(users).where(eq(users.id, id)))[0];

  it("propose les échelles et les comportements signalés d'une campagne clôturée, et les enregistre", async () => {
    const { db, admin, campagneId, orgId } = await preparer();
    const liste = await propositions(db, admin, orgId, "fr");
    expect(liste.filter((p) => p.source === "echelle")).toHaveLength(24);
    const comportements = liste.filter((p) => p.source === "comportement");
    expect(comportements.length).toBeGreaterThan(0);
    expect(liste[0].obligatoire).toBe(true); // comportements en tête
    expect(comportements.every((p) => p.groupes.length === 0)).toBe(true);

    const charge = liste.find((p) => p.scaleId === "charge")!;
    const cree = await creerRisque(
      db, admin, orgId,
      { titre: charge.nom, p: charge.p, e: charge.e, g: 15, groupes: ["Atelier", "Groupe inventé"] },
      { campaignId: campagneId, instrumentId: charge.instrumentId, scaleId: "charge" },
    );
    expect(cree.ok).toBe(true);
    const [ligne] = await db.select().from(risks);
    expect(ligne.groupLabels).toEqual(["Atelier"]); // seulement les groupes affichables
    expect(ligne.source).toBe("echelle");
    // Pas deux fois la même échelle
    const encore = await creerRisque(db, admin, orgId, { titre: "x", p: 1, e: 1, g: 1 }, { campaignId: campagneId, instrumentId: charge.instrumentId, scaleId: "charge" });
    expect(encore).toEqual({ ok: false, erreur: "risqueDejaAuRegistre" });
    expect((await propositions(db, admin, orgId, "fr")).find((p) => p.scaleId === "charge")!.dejaAuRegistre).toBe(true);
    // Journal : valeurs seulement, jamais les textes
    const [j] = await db.select().from(auditLog).where(eq(auditLog.action, "risk_created"));
    expect(j.details).toEqual({ p: charge.p, e: charge.e, g: 15, score: scoreKinney(charge.p, charge.e, 15), statut: "ouvert", source: "echelle" });
  });

  it("inscrit une campagne entière avec les valeurs pré-remplies (niveau, groupes défavorables, P, E, G)", async () => {
    const { db, admin, campagneId, orgId } = await preparer();
    const liste = await propositions(db, admin, orgId, "fr");
    expect(liste.every((p) => [100, 40, 15, 7, 3, 1].includes(p.g))).toBe(true);
    // Les groupes proposés sont toujours parmi les groupes affichables
    expect(liste.every((p) => p.groupesSuggeres.every((g) => p.groupes.includes(g)))).toBe(true);
    const r = await importerCampagne(db, admin, orgId, campagneId);
    expect(r).toEqual({ ok: true, valeur: { nombre: liste.length } });
    const registre = (await lireRegistre(db, admin, orgId))!;
    expect(registre).toHaveLength(liste.length);
    const charge = registre.find((x) => x.scaleId === "charge")!;
    const prop = liste.find((p) => p.scaleId === "charge")!;
    expect([charge.p, charge.e, charge.g, charge.mindsetLevel]).toEqual([prop.p, prop.e, prop.g, "travail"]);
    expect(charge.groupLabels).toEqual(prop.groupesSuggeres);
    // Une seconde fois : rien de plus
    expect(await importerCampagne(db, admin, orgId, campagneId)).toEqual({ ok: true, valeur: { nombre: 0 } });
  });

  it("refuse les valeurs hors grille et les coordonnées dans les textes", async () => {
    const { db, admin, orgId } = await preparer();
    expect(await creerRisque(db, admin, orgId, { titre: "Risque", p: 4, e: 1, g: 1 })).toEqual({ ok: false, erreur: "saisieInvalide" });
    expect(await creerRisque(db, admin, orgId, { titre: "Risque", description: "voir jean@exemple.be", p: 1, e: 1, g: 1 })).toEqual({
      ok: false,
      erreur: "risqueCoordonnees",
    });
    expect(await creerRisque(db, admin, orgId, { titre: "Risque", justification: "appeler le 0471 23 45 67", p: 1, e: 1, g: 1 })).toEqual({
      ok: false,
      erreur: "risqueCoordonnees",
    });
    // La base refuse aussi une valeur hors grille
    await expect(
      db.insert(risks).values({ organizationId: orgId, source: "manuel", title: "x", probability: "4", exposure: "1", gravity: "1", updatedBy: admin.id }),
    ).rejects.toThrow();
  });

  it("ouvre le registre au seul conseiller en prévention désigné, et après validation du rapport", async () => {
    const { db, admin, campagneId, orgId, conseiller } = await preparer();
    // Non désigné : ni lecture ni écriture (la base refuse aussi)
    expect(await lireRegistre(db, conseiller, orgId)).toBeNull();
    expect((await creerRisque(db, conseiller, orgId, { titre: "Risque", p: 1, e: 1, g: 1 })).ok).toBe(false);
    await expect(
      db.insert(risks).values({ organizationId: orgId, source: "manuel", title: "x", probability: "1", exposure: "1", gravity: "1", updatedBy: conseiller.id }),
    ).rejects.toThrow();

    expect((await designerConseillerPrevention(db, admin.id, orgId, conseiller.id, true)).ok).toBe(true);
    const cp = await relire(db, conseiller.id);
    // Rapport pas encore validé : pas de propositions issues de la campagne, mais ajout manuel possible
    expect(await propositions(db, cp, orgId, "fr")).toEqual([]);
    const manuel = await creerRisque(db, cp, orgId, { titre: "Réorganisation annoncée", p: 6, e: 6, g: 15, niveau: "organisation" });
    expect(manuel.ok).toBe(true);
    // Risque issu de la campagne, créé par IMA : invisible pour le conseiller tant que le rapport n'est pas validé
    const p = (await propositions(db, admin, orgId, "fr")).find((x) => x.scaleId === "stress")!;
    await creerRisque(db, admin, orgId, { titre: p.nom, p: p.p, e: p.e, g: 15 }, { campaignId: campagneId, instrumentId: p.instrumentId, scaleId: "stress" });
    expect((await lireRegistre(db, cp, orgId))!.map((r) => r.title)).toEqual(["Réorganisation annoncée"]);
    expect((await lireRegistre(db, admin, orgId))!).toHaveLength(2);

    // Rapport validé par IMA : le conseiller voit alors tout le registre et les propositions
    await db.update(users).set({ aiLiteracyAt: "2026-10-01" }).where(eq(users.id, admin.id));
    await db.insert(reports).values({
      campaignId: campagneId, status: "validated", finalText: "Rapport fictif.", validatedBy: admin.id, validatedAt: new Date(),
      checkSourcesVerified: true, checkNoSmallGroup: true, checkLanguageRule: true, checkLimitsMentioned: true,
    });
    expect((await lireRegistre(db, cp, orgId))!).toHaveLength(2);
    expect((await propositions(db, cp, orgId, "fr")).length).toBeGreaterThan(0);
    // Désigné pour une autre entreprise : rien
    expect(await lireRegistre(db, cp, admin.id)).toBeNull();
  });

  it("garde les comportements signalés : modification possible, suppression refusée", async () => {
    const { db, admin, campagneId, orgId } = await preparer();
    const p = (await propositions(db, admin, orgId, "fr")).find((x) => x.source === "comportement")!;
    const cree = await creerRisque(db, admin, orgId, { titre: p.nom, p: p.p, e: p.e, g: 40 }, { campaignId: campagneId, instrumentId: p.instrumentId, scaleId: p.scaleId });
    if (!cree.ok) throw new Error(cree.erreur);
    expect(await supprimerRisque(db, admin, cree.valeur.id)).toEqual({ ok: false, erreur: "risqueComportementObligatoire" });
    expect((await modifierRisque(db, admin, cree.valeur.id, { titre: p.nom, p: 0.1, e: 0.5, g: 1, statut: "traite" })).ok).toBe(true);
    const [r] = (await lireRegistre(db, admin, orgId))!;
    expect(r.score).toBe(0.1);
    expect(r.classe).toBe("eleve"); // plancher des comportements indésirables
    expect(r.status).toBe("traite");
  });
});
