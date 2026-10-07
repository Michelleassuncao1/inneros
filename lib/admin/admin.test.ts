// Tests de l'étape 4A : entreprises, référents, campagnes, groupes, questionnaires.
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { campaignInstruments, campaigns, instruments, loginLinks, organizations, users } from "../db/schema";
import { creerBaseDeTest } from "../db/test-db";
import type { Db } from "../db/types";
import {
  ajouterGroupe,
  choisirQuestionnaires,
  creerCampagne,
  modifierCampagne,
  supprimerGroupe,
} from "./campagnes";
import {
  ajouterReferent,
  changerEtatReferent,
  creerEntreprise,
  modifierEntreprise,
  modifierReferent,
  supprimerReferent,
} from "./entreprises";

let db: Db;
let adminId: string;

const entreprise = {
  name: "Entreprise de test",
  country: "BE",
  locale: "fr",
  sector: "Services",
  sizeBand: "50-249",
};

const campagne = {
  mandateType: "n1",
  mandateReference: "MANDAT-2026-01",
  diagnosticQuestion: "",
  perimeter: "",
  groupMinSize: 10,
  startDate: "2026-11-01",
  endDate: "2026-11-30",
  locales: ["fr"],
};

beforeEach(async () => {
  ({ db } = await creerBaseDeTest());
  const [admin] = await db
    .insert(users)
    .values({ email: "admin@ima.test", name: "Admin", role: "admin", passwordHash: "x" })
    .returning();
  adminId = admin.id;
});

async function nouvelleEntreprise() {
  const r = await creerEntreprise(db, adminId, entreprise);
  if (!r.ok) throw new Error(r.erreur);
  return r.valeur.id;
}

async function nouvelleCampagne(saisie: Partial<typeof campagne> = {}) {
  const orgId = await nouvelleEntreprise();
  const r = await creerCampagne(db, adminId, orgId, { ...campagne, ...saisie });
  if (!r.ok) throw new Error(r.erreur);
  return r.valeur.id;
}

describe("Entreprises et référents (F3)", () => {
  it("crée une entreprise avec un code interne ORG-XXXX", async () => {
    const id = await nouvelleEntreprise();
    const [org] = await db.select().from(organizations).where(eq(organizations.id, id));
    expect(org.internalCode).toMatch(/^ORG-[2-9A-HJKMNP-Z]{4}$/);
  });

  it("refuse un pays inconnu", async () => {
    const r = await creerEntreprise(db, adminId, { ...entreprise, country: "US" });
    expect(r).toEqual({ ok: false, erreur: "saisieInvalide" });
  });

  it("refuse de changer le pays une fois une campagne créée", async () => {
    const orgId = await nouvelleEntreprise();
    expect((await modifierEntreprise(db, adminId, orgId, { ...entreprise, country: "FR" })).ok).toBe(true);
    await creerCampagne(db, adminId, orgId, campagne);
    expect(await modifierEntreprise(db, adminId, orgId, { ...entreprise, country: "BR" })).toEqual({
      ok: false,
      erreur: "paysVerrouille",
    });
  });

  it("ajoute un référent, refuse une adresse déjà utilisée, puis le désactive", async () => {
    const orgId = await nouvelleEntreprise();
    expect((await ajouterReferent(db, adminId, orgId, { name: "RH", email: "RH@Client.test" })).ok).toBe(true);
    expect(await ajouterReferent(db, adminId, orgId, { name: "RH bis", email: "rh@client.test" })).toEqual({
      ok: false,
      erreur: "emailDejaUtilise",
    });
    const [referent] = await db.select().from(users).where(eq(users.email, "rh@client.test"));
    await changerEtatReferent(db, adminId, referent.id, false);
    const [apres] = await db.select().from(users).where(eq(users.id, referent.id));
    expect(apres.disabledAt).not.toBeNull();
  });

  it("corrige le nom et l'e-mail d'un référent et annule ses liens non utilisés", async () => {
    const orgId = await nouvelleEntreprise();
    await ajouterReferent(db, adminId, orgId, { name: "Mauvais nom", email: "erreur@client.test" });
    const [referent] = await db.select().from(users).where(eq(users.email, "erreur@client.test"));
    await db.insert(loginLinks).values({ tokenHash: "h1", userId: referent.id, expiresAt: new Date(Date.now() + 60_000) });

    const r = await modifierReferent(db, adminId, referent.id, { name: "Bon Nom", email: " Bon@Client.test " });
    expect(r.ok).toBe(true);
    const [apres] = await db.select().from(users).where(eq(users.id, referent.id));
    expect(apres).toMatchObject({ name: "Bon Nom", email: "bon@client.test" });
    expect(await db.select().from(loginLinks)).toHaveLength(0);
  });

  it("garde les liens si seul le nom change", async () => {
    const orgId = await nouvelleEntreprise();
    await ajouterReferent(db, adminId, orgId, { name: "Nom", email: "rh@client.test" });
    const [referent] = await db.select().from(users).where(eq(users.email, "rh@client.test"));
    await db.insert(loginLinks).values({ tokenHash: "h1", userId: referent.id, expiresAt: new Date(Date.now() + 60_000) });
    await modifierReferent(db, adminId, referent.id, { name: "Nom corrigé", email: "rh@client.test" });
    expect(await db.select().from(loginLinks)).toHaveLength(1);
  });

  it("refuse de corriger vers une adresse déjà utilisée, ou de modifier un administrateur", async () => {
    const orgId = await nouvelleEntreprise();
    await ajouterReferent(db, adminId, orgId, { name: "RH", email: "rh@client.test" });
    const [referent] = await db.select().from(users).where(eq(users.email, "rh@client.test"));
    expect(await modifierReferent(db, adminId, referent.id, { name: "RH", email: "admin@ima.test" })).toEqual({
      ok: false,
      erreur: "emailDejaUtilise",
    });
    expect(await modifierReferent(db, adminId, adminId, { name: "Xavier", email: "x@ima.test" })).toEqual({
      ok: false,
      erreur: "introuvable",
    });
  });

  it("supprime un référent et ses liens, sans jamais supprimer un administrateur", async () => {
    const orgId = await nouvelleEntreprise();
    await ajouterReferent(db, adminId, orgId, { name: "RH", email: "rh@client.test" });
    const [referent] = await db.select().from(users).where(eq(users.email, "rh@client.test"));
    await db.insert(loginLinks).values({ tokenHash: "h1", userId: referent.id, expiresAt: new Date(Date.now() + 60_000) });

    expect((await supprimerReferent(db, adminId, referent.id)).ok).toBe(true);
    expect(await db.select().from(users).where(eq(users.id, referent.id))).toHaveLength(0);
    expect(await db.select().from(loginLinks)).toHaveLength(0);
    expect(await supprimerReferent(db, adminId, adminId)).toEqual({ ok: false, erreur: "introuvable" });
  });

  it("ne désactive jamais un administrateur par ce biais", async () => {
    expect(await changerEtatReferent(db, adminId, adminId, false)).toEqual({ ok: false, erreur: "introuvable" });
  });
});

describe("Campagnes et groupes (F4)", () => {
  it("refuse un seuil inférieur à 10", async () => {
    const orgId = await nouvelleEntreprise();
    expect(await creerCampagne(db, adminId, orgId, { ...campagne, groupMinSize: 8 })).toEqual({
      ok: false,
      erreur: "seuilTropBas",
    });
  });

  it("refuse une date de fin avant la date de début", async () => {
    const orgId = await nouvelleEntreprise();
    const r = await creerCampagne(db, adminId, orgId, { ...campagne, endDate: "2026-10-01" });
    expect(r).toEqual({ ok: false, erreur: "datesIncoherentes" });
  });

  it("refuse un groupe de 8 personnes, accepte un groupe de 12", async () => {
    const id = await nouvelleCampagne();
    expect(await ajouterGroupe(db, adminId, id, { label: "Comptabilité", expectedSize: 8 })).toEqual({
      ok: false,
      erreur: "groupeSousLeSeuil",
    });
    expect((await ajouterGroupe(db, adminId, id, { label: "Production", expectedSize: 12 })).ok).toBe(true);
  });

  it("refuse deux groupes portant le même libellé", async () => {
    const id = await nouvelleCampagne();
    await ajouterGroupe(db, adminId, id, { label: "Production", expectedSize: 12 });
    expect(await ajouterGroupe(db, adminId, id, { label: "Production", expectedSize: 15 })).toEqual({
      ok: false,
      erreur: "groupeEnDouble",
    });
  });

  it("refuse de relever le seuil au-dessus d'un groupe existant", async () => {
    const id = await nouvelleCampagne();
    await ajouterGroupe(db, adminId, id, { label: "Production", expectedSize: 12 });
    expect(await modifierCampagne(db, adminId, id, { ...campagne, groupMinSize: 15 })).toEqual({
      ok: false,
      erreur: "seuilAuDessusDunGroupe",
    });
  });

  it("une campagne ouverte ne peut plus changer de groupes ni de questionnaires", async () => {
    const id = await nouvelleCampagne();
    await db
      .update(campaigns)
      .set({ status: "open", mandateValidatedOn: "2026-10-15" })
      .where(eq(campaigns.id, id));
    const verrou = { ok: false, erreur: "campagneVerrouillee" };
    expect(await ajouterGroupe(db, adminId, id, { label: "Production", expectedSize: 12 })).toEqual(verrou);
    expect(await choisirQuestionnaires(db, adminId, id, [])).toEqual(verrou);
    expect(await supprimerGroupe(db, adminId, id, "00000000-0000-0000-0000-000000000000")).toEqual(verrou);
  });

  it("la base refuse d'ouvrir une campagne sans date de mandat validé", async () => {
    const id = await nouvelleCampagne();
    await expect(db.update(campaigns).set({ status: "open" }).where(eq(campaigns.id, id))).rejects.toThrow();
  });

  it("n'accepte que des questionnaires enregistrés", async () => {
    const id = await nouvelleCampagne();
    const [instrument] = await db
      .insert(instruments)
      .values({ code: "exemple", version: "test", source: "s", license: "l", isTest: true, definitions: {} })
      .returning();
    expect((await choisirQuestionnaires(db, adminId, id, [instrument.id])).ok).toBe(true);
    expect(await db.select().from(campaignInstruments)).toHaveLength(1);
    expect(
      await choisirQuestionnaires(db, adminId, id, ["11111111-1111-4111-8111-111111111111"]),
    ).toEqual({ ok: false, erreur: "saisieInvalide" });
  });
});
