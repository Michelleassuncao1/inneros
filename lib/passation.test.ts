// Tests de la passation (étape 5A) : format des questionnaires, ouverture par code, envoi anonyme.
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ajouterGroupe, choisirQuestionnaires, choisirReferents, creerCampagne } from "./admin/campagnes";
import { cloturerCampagne, ouvrirCampagne } from "./admin/cycle";
import { ajouterReferent, creerEntreprise } from "./admin/entreprises";
import { genererJetons, revoquerJetonsNonUtilises } from "./admin/jetons";
import { answers, campaigns, groups, responses, tokens, users } from "./db/schema";
import { chargerQuestionnaireDeTest, creerBaseDeTest } from "./db/test-db";
import type { Db } from "./db/types";
import { lireInstrument } from "./instruments/chargement";
import { enregistrerReponses, ouvrirQuestionnaire } from "./passation";

const MAINTENANT = new Date("2026-11-10T10:00:00Z");
let db: Db;
let campagneId: string;
let groupeId: string;
let codes: string[];

const reponsesCompletes = (): Record<string, number | null> => ({
  innerostest_t1: 4,
  innerostest_t2: 3,
  innerostest_t3: 0,
  innerostest_t4: null, // « je préfère ne pas répondre »
  innerostest_t5: 2,
  innerostest_t6: 7,
  innerostest_t7: 1,
  innerostest_t8: 4,
});

beforeAll(() => {
  process.env.AUTH_SECRET = randomBytes(32).toString("base64");
});

beforeEach(async () => {
  ({ db } = await creerBaseDeTest());
  const [admin] = await db
    .insert(users)
    .values({ email: "admin@ima.test", name: "Admin", role: "admin", passwordHash: "x" })
    .returning();
  const org = await creerEntreprise(db, admin.id, {
    name: "Entreprise",
    country: "BE",
    locale: "fr",
    sector: "Services",
    sizeBand: "50-249",
  });
  if (!org.ok) throw new Error(org.erreur);
  const c = await creerCampagne(db, admin.id, org.valeur.id, {
    mandateType: "n1",
    mandateReference: "M-1",
    diagnosticQuestion: "",
    perimeter: "",
    groupMinSize: 10,
    startDate: "2026-11-01",
    endDate: "2026-11-30",
    locales: ["fr", "nl"],
    groupingCriterion: "service",
  });
  if (!c.ok) throw new Error(c.erreur);
  campagneId = c.valeur.id;
  await ajouterGroupe(db, admin.id, campagneId, { label: "Production", expectedSize: 12 });
  [{ id: groupeId }] = await db.select({ id: groups.id }).from(groups);
  await choisirQuestionnaires(db, admin.id, campagneId, [await chargerQuestionnaireDeTest(db, ["fr", "nl"])]);
  await ajouterReferent(db, admin.id, org.valeur.id, { name: "RH", email: "rh@client.test" });
  const [referent] = await db.select().from(users).where(eq(users.email, "rh@client.test"));
  await choisirReferents(db, admin.id, campagneId, [referent.id]);
  const j = await genererJetons(db, admin.id, campagneId, 3);
  if (!j.ok) throw new Error(j.erreur);
  codes = j.valeur.codes;
  const o = await ouvrirCampagne(db, admin.id, campagneId, { mandateValidatedOn: "2026-10-15", confirmation: "oui" }, MAINTENANT);
  if (!o.ok) throw new Error(o.erreur);
});

describe("Format des questionnaires", () => {
  const base = () => JSON.parse(readFileSync("instruments/test/innerostest-0.2.fr.json", "utf8"));

  it("accepte le questionnaire de test", () => {
    expect(lireInstrument(base()).ok).toBe(true);
  });

  it("refuse les items d'engagement au travail (WE) du COPSOQ", () => {
    const f = { ...base(), instrument: "copsoq3" };
    f.dimensions[0].items[0].id = "we1";
    const r = lireInstrument(f);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erreurs.join()).toContain("engagement au travail");
  });

  it("refuse un item renvoyant à une échelle de réponse inconnue", () => {
    const f = base();
    f.dimensions[0].items[0].reponse = "inconnue";
    expect(lireInstrument(f).ok).toBe(false);
  });
});

describe("Ouverture du questionnaire par code", () => {
  it("donne accès au questionnaire dans une langue de la campagne", async () => {
    const r = await ouvrirQuestionnaire(db, codes[0], "nl", MAINTENANT);
    expect(r.etat).toBe("ok");
    if (r.etat !== "ok") return;
    expect(r.langue).toBe("nl");
    expect(r.groupes).toEqual([{ id: groupeId, label: "Production" }]);
    expect(r.questionnaires[0].titre).toContain("Testvragenlijst");
    expect(r.aides.map((a) => a.numero)).toContain("1813");
  });

  it("bascule sur une langue de la campagne si la langue demandée n'en fait pas partie", async () => {
    const r = await ouvrirQuestionnaire(db, codes[0], "en", MAINTENANT);
    expect(r.etat === "ok" && r.langue).toBe("fr");
  });

  it("accepte le code saisi en minuscules et avec des espaces", async () => {
    const r = await ouvrirQuestionnaire(db, ` ${codes[0].toLowerCase().replace(/-/g, " ")} `, "fr", MAINTENANT);
    expect(r.etat).toBe("ok");
  });

  it("refuse un code inconnu ou révoqué avec le même message", async () => {
    expect((await ouvrirQuestionnaire(db, "AAAA-BBBB-CC", "fr", MAINTENANT)).etat).toBe("invalide");
    const [admin] = await db.select().from(users).where(eq(users.role, "admin"));
    await revoquerJetonsNonUtilises(db, admin.id, campagneId);
    expect((await ouvrirQuestionnaire(db, codes[0], "fr", MAINTENANT)).etat).toBe("invalide");
  });

  it("indique une campagne pas encore ouverte, ou un code expiré", async () => {
    await db.update(campaigns).set({ status: "draft" }).where(eq(campaigns.id, campagneId));
    expect((await ouvrirQuestionnaire(db, codes[0], "fr", MAINTENANT)).etat).toBe("pasOuverte");
    await db.update(campaigns).set({ status: "open" }).where(eq(campaigns.id, campagneId));
    expect((await ouvrirQuestionnaire(db, codes[0], "fr", new Date("2026-12-05T10:00:00Z"))).etat).toBe("expire");
  });
});

describe("Envoi des réponses (anonymat)", () => {
  it("enregistre la réponse, consomme le jeton, et ne garde que la date du jour", async () => {
    const r = await enregistrerReponses(db, { code: codes[0], groupe: groupeId, reponses: reponsesCompletes() }, MAINTENANT);
    expect(r).toEqual({ ok: true });

    const [reponse] = await db.select().from(responses);
    expect(Object.keys(reponse).sort()).toEqual(["campaignId", "groupId", "id", "instrumentVersions", "responseDate"]);
    expect(reponse.responseDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(reponse.instrumentVersions).toEqual({ innerostest: "test-0.2" });

    const lignes = await db.select().from(answers).where(eq(answers.responseId, reponse.id));
    expect(lignes).toHaveLength(8);
    expect(lignes.find((l) => l.itemId === "innerostest_t4")?.value).toBeNull();

    const statuts = (await db.select().from(tokens)).map((t) => t.status).sort();
    expect(statuts).toEqual(["active", "active", "consumed"]);
  });

  it("un jeton ne sert qu'une fois", async () => {
    await enregistrerReponses(db, { code: codes[0], groupe: groupeId, reponses: reponsesCompletes() }, MAINTENANT);
    expect(await enregistrerReponses(db, { code: codes[0], groupe: groupeId, reponses: reponsesCompletes() }, MAINTENANT)).toEqual({
      ok: false,
      raison: "utilise",
    });
    expect((await ouvrirQuestionnaire(db, codes[0], "fr", MAINTENANT)).etat).toBe("utilise");
    expect(await db.select().from(responses)).toHaveLength(1);
  });

  it("deux envois simultanés avec le même jeton : un seul est enregistré", async () => {
    const envoi = () => enregistrerReponses(db, { code: codes[1], groupe: groupeId, reponses: reponsesCompletes() }, MAINTENANT);
    const resultats = await Promise.all([envoi(), envoi()]);
    expect(resultats.filter((r) => r.ok)).toHaveLength(1);
    expect(await db.select().from(responses)).toHaveLength(1);
  });

  it("refuse une réponse hors échelle, un item manquant ou un item étranger, sans consommer le jeton", async () => {
    const horsEchelle = { ...reponsesCompletes(), innerostest_t6: 9 };
    const manquant = { ...reponsesCompletes() } as Record<string, number | null>;
    delete manquant.innerostest_t8;
    const etranger = { ...reponsesCompletes(), autre_x1: 2 };
    for (const reponses of [horsEchelle, manquant, etranger]) {
      expect(await enregistrerReponses(db, { code: codes[0], groupe: groupeId, reponses }, MAINTENANT)).toEqual({
        ok: false,
        raison: "reponses",
      });
    }
    expect((await ouvrirQuestionnaire(db, codes[0], "fr", MAINTENANT)).etat).toBe("ok");
    expect(await db.select().from(responses)).toHaveLength(0);
  });

  it("refuse un groupe qui n'appartient pas à la campagne", async () => {
    const r = await enregistrerReponses(
      db,
      { code: codes[0], groupe: "00000000-0000-4000-8000-000000000000", reponses: reponsesCompletes() },
      MAINTENANT,
    );
    expect(r).toEqual({ ok: false, raison: "groupe" });
  });

  it("refuse tout envoi après la clôture (les jetons sont supprimés)", async () => {
    const [admin] = await db.select().from(users).where(eq(users.role, "admin"));
    await cloturerCampagne(db, admin.id, campagneId, MAINTENANT);
    expect(await enregistrerReponses(db, { code: codes[0], groupe: groupeId, reponses: reponsesCompletes() }, MAINTENANT)).toEqual({
      ok: false,
      raison: "invalide",
    });
  });
});
