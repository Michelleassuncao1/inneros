// Tests de l'étape 4B : langues par pays, jetons, ouverture et clôture des campagnes.
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { campaigns, tokens, users } from "../db/schema";
import { chargerQuestionnaireDeTest, creerBaseDeTest } from "../db/test-db";
import type { Db } from "../db/types";
import { ajouterGroupe, choisirQuestionnaires, choisirReferents, creerCampagne } from "./campagnes";
import { cloturerCampagne, ouvrirCampagne, prolongerCampagne } from "./cycle";
import { ajouterReferent, creerEntreprise } from "./entreprises";
import {
  codesValides,
  compterJetons,
  empreinteJeton,
  genererJetons,
  normaliserCode,
  revoquerJetonsNonUtilises,
} from "./jetons";

let db: Db;
let adminId: string;
let orgId: string;

const campagne = {
  mandateType: "n1",
  mandateReference: "MANDAT-1",
  diagnosticQuestion: "",
  perimeter: "",
  groupMinSize: 10,
  startDate: "2026-11-01",
  endDate: "2026-11-30",
  locales: ["fr"],
  groupingCriterion: "service",
};
const ouverture = { mandateValidatedOn: "2026-10-01", confirmation: "oui" };
const MAINTENANT = new Date("2026-10-08T10:00:00Z");

beforeAll(() => {
  process.env.AUTH_SECRET = randomBytes(32).toString("base64");
});

beforeEach(async () => {
  ({ db } = await creerBaseDeTest());
  const [admin] = await db
    .insert(users)
    .values({ email: "admin@ima.test", name: "Admin", role: "admin", passwordHash: "x" })
    .returning();
  adminId = admin.id;
  const r = await creerEntreprise(db, adminId, {
    name: "Entreprise",
    country: "BE",
    locale: "fr",
    sector: "Services",
    sizeBand: "50-249",
  });
  if (!r.ok) throw new Error(r.erreur);
  orgId = r.valeur.id;
});

async function nouvelleCampagne() {
  const r = await creerCampagne(db, adminId, orgId, campagne);
  if (!r.ok) throw new Error(r.erreur);
  return r.valeur.id;
}

// Campagne prête à ouvrir : un groupe, un questionnaire, un référent ayant accès au rapport
async function campagnePrete() {
  const id = await nouvelleCampagne();
  await ajouterGroupe(db, adminId, id, { label: "Production", expectedSize: 12 });
  await choisirQuestionnaires(db, adminId, id, [await chargerQuestionnaireDeTest(db)]);
  await ajouterReferent(db, adminId, orgId, { name: "RH", email: "rh@client.test" });
  const [referent] = await db.select().from(users).where(eq(users.email, "rh@client.test"));
  await choisirReferents(db, adminId, id, [referent.id]);
  return id;
}

describe("Langues par pays", () => {
  it("une entreprise belge propose le français, le néerlandais et l'anglais", async () => {
    expect((await creerCampagne(db, adminId, orgId, { ...campagne, locales: ["fr", "nl", "en"] })).ok).toBe(true);
  });

  it("une entreprise belge ne propose pas le portugais du Brésil", async () => {
    expect(await creerCampagne(db, adminId, orgId, { ...campagne, locales: ["fr", "pt-BR"] })).toEqual({
      ok: false,
      erreur: "langueNonDisponible",
    });
  });
});

describe("Jetons (F5)", () => {
  it("génère des codes uniques, lisibles, dont seule l'empreinte est stockée", async () => {
    const id = await nouvelleCampagne();
    const r = await genererJetons(db, adminId, id, 50);
    if (!r.ok) throw new Error(r.erreur);
    const { codes } = r.valeur;
    expect(codes).toHaveLength(50);
    expect(new Set(codes).size).toBe(50);
    expect(codes[0]).toMatch(/^[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{2}$/);

    const stockes = await db.select().from(tokens);
    expect(stockes).toHaveLength(50);
    const tout = JSON.stringify(stockes);
    for (const code of codes) expect(tout).not.toContain(normaliserCode(code));
    expect(stockes[0].expiresOn).toBe("2026-11-30");
  });

  it("l'empreinte ignore les tirets, espaces et minuscules saisis", () => {
    expect(empreinteJeton("k7qf 3mzp x2")).toBe(empreinteJeton("K7QF-3MZP-X2"));
  });

  it("refuse un nombre de jetons invalide", async () => {
    const id = await nouvelleCampagne();
    expect(await genererJetons(db, adminId, id, 0)).toEqual({ ok: false, erreur: "nombreJetonsInvalide" });
    expect(await genererJetons(db, adminId, id, 6000)).toEqual({ ok: false, erreur: "nombreJetonsInvalide" });
  });

  it("révoque les jetons non utilisés, sans toucher aux jetons utilisés", async () => {
    const id = await nouvelleCampagne();
    const r = await genererJetons(db, adminId, id, 5);
    if (!r.ok) throw new Error(r.erreur);
    await db.update(tokens).set({ status: "consumed" }).where(eq(tokens.tokenHash, empreinteJeton(r.valeur.codes[0])));
    const rev = await revoquerJetonsNonUtilises(db, adminId, id);
    expect(rev).toEqual({ ok: true, valeur: { nombre: 4 } });
    expect(await compterJetons(db, id)).toEqual({ actifs: 0, utilises: 1, revoques: 4 });
  });

  it("le PDF n'accepte que des codes actifs de la campagne", async () => {
    const id = await nouvelleCampagne();
    const autre = await nouvelleCampagne();
    const r = await genererJetons(db, adminId, id, 3);
    const r2 = await genererJetons(db, adminId, autre, 1);
    if (!r.ok || !r2.ok) throw new Error("génération");
    expect(await codesValides(db, id, r.valeur.codes)).toBe(true);
    expect(await codesValides(db, id, [...r.valeur.codes, r2.valeur.codes[0]])).toBe(false);
    expect(await codesValides(db, id, ["AAAA-BBBB-CC"])).toBe(false);
    await revoquerJetonsNonUtilises(db, adminId, id);
    expect(await codesValides(db, id, r.valeur.codes)).toBe(false);
  });
});

describe("Ouverture et clôture", () => {
  it("refuse d'ouvrir sans confirmation, sans date, ou avec une date future", async () => {
    const id = await campagnePrete();
    const incomplete = { ok: false, erreur: "ouvertureIncomplete" };
    expect(await ouvrirCampagne(db, adminId, id, { mandateValidatedOn: "2026-10-01" }, MAINTENANT)).toEqual(incomplete);
    expect(await ouvrirCampagne(db, adminId, id, { confirmation: "oui" }, MAINTENANT)).toEqual(incomplete);
    expect(
      await ouvrirCampagne(db, adminId, id, { ...ouverture, mandateValidatedOn: "2026-12-01" }, MAINTENANT),
    ).toEqual({ ok: false, erreur: "dateMandatFuture" });
  });

  it("refuse d'ouvrir sans groupe, sans questionnaire ou sans référent", async () => {
    const id = await nouvelleCampagne();
    expect(await ouvrirCampagne(db, adminId, id, ouverture, MAINTENANT)).toEqual({
      ok: false,
      erreur: "ouvertureSansGroupe",
    });
    await ajouterGroupe(db, adminId, id, { label: "Production", expectedSize: 12 });
    expect(await ouvrirCampagne(db, adminId, id, ouverture, MAINTENANT)).toEqual({
      ok: false,
      erreur: "ouvertureSansQuestionnaire",
    });
  });

  it("ouvre une campagne prête, puis la clôture en supprimant tous les jetons", async () => {
    const id = await campagnePrete();
    await genererJetons(db, adminId, id, 20);
    expect((await ouvrirCampagne(db, adminId, id, ouverture, MAINTENANT)).ok).toBe(true);
    const [ouverte] = await db.select().from(campaigns).where(eq(campaigns.id, id));
    expect(ouverte).toMatchObject({ status: "open", mandateValidatedOn: "2026-10-01" });

    expect(await cloturerCampagne(db, adminId, id, MAINTENANT)).toEqual({ ok: true, valeur: { jetonsSupprimes: 20 } });
    expect(await db.select().from(tokens)).toHaveLength(0);
    const [close] = await db.select().from(campaigns).where(eq(campaigns.id, id));
    expect(close.status).toBe("closed");
    // Plus aucun jeton ne peut être généré pour une campagne clôturée
    expect(await genererJetons(db, adminId, id, 5)).toEqual({ ok: false, erreur: "campagneCloturee" });
  });

  it("prolonge une campagne ouverte et ses jetons non utilisés", async () => {
    const id = await campagnePrete();
    const r = await genererJetons(db, adminId, id, 3);
    if (!r.ok) throw new Error(r.erreur);
    await db.update(tokens).set({ status: "consumed" }).where(eq(tokens.tokenHash, empreinteJeton(r.valeur.codes[0])));
    expect(await prolongerCampagne(db, adminId, id, { endDate: "2026-12-15" })).toEqual({
      ok: false,
      erreur: "campagneNonOuverte",
    });
    await ouvrirCampagne(db, adminId, id, ouverture, MAINTENANT);
    expect(await prolongerCampagne(db, adminId, id, { endDate: "2026-11-20" })).toEqual({
      ok: false,
      erreur: "prolongationTropCourte",
    });
    expect(await prolongerCampagne(db, adminId, id, { endDate: "2026-12-15" })).toEqual({
      ok: true,
      valeur: { ancienneFin: "2026-11-30", nouvelleFin: "2026-12-15" },
    });
    const [c] = await db.select().from(campaigns).where(eq(campaigns.id, id));
    expect(c.endDate).toBe("2026-12-15");
    const expirations = (await db.select().from(tokens)).map((t) => `${t.status}:${t.expiresOn}`).sort();
    expect(expirations).toEqual(["active:2026-12-15", "active:2026-12-15", "consumed:2026-11-30"]);
  });

  it("refuse d'ouvrir si un questionnaire manque dans une langue de la campagne", async () => {
    const id = await campagnePrete();
    await db.update(campaigns).set({ locales: ["fr", "nl"] }).where(eq(campaigns.id, id));
    expect(await ouvrirCampagne(db, adminId, id, ouverture, MAINTENANT)).toEqual({
      ok: false,
      erreur: "questionnaireIncomplet",
    });
  });

  it("refuse de clôturer une campagne qui n'est pas ouverte", async () => {
    const id = await nouvelleCampagne();
    expect(await cloturerCampagne(db, adminId, id)).toEqual({ ok: false, erreur: "campagneNonOuverte" });
  });
});
