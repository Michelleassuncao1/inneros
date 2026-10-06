// Tests des garde-fous de la base (règles 1, 2, 3 et 6 de CLAUDE.md).
// Chaque test part d'une base PGlite neuve, en mémoire, créée avec les vraies migrations.
import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import * as schema from "./schema";

let client: PGlite;
let db: PgliteDatabase<typeof schema>;

beforeEach(async () => {
  client = new PGlite();
  db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "drizzle" });
});

// Vérifie qu'une écriture est refusée par la base, avec le motif attendu
async function refuse(operation: Promise<unknown>, motif: string) {
  try {
    await operation;
  } catch (e) {
    const err = e as Error & { cause?: Error };
    expect(`${err.message} ${err.cause?.message ?? ""}`).toContain(motif);
    return;
  }
  throw new Error(`L'écriture aurait dû être refusée (${motif})`);
}

async function creerCampagne(seuil = 10) {
  const [org] = await db
    .insert(schema.organizations)
    .values({
      internalCode: "ORG-TEST",
      name: "Entreprise de test",
      country: "BE",
      locale: "fr",
      sector: "Services",
      sizeBand: "50-249",
    })
    .returning();
  const [campagne] = await db
    .insert(schema.campaigns)
    .values({
      organizationId: org.id,
      mandateType: "n1",
      mandateReference: "MANDAT-TEST",
      groupMinSize: seuil,
      startDate: "2026-11-01",
      endDate: "2026-11-30",
      locales: ["fr", "pt-BR"],
    })
    .returning();
  return campagne;
}

async function creerInstrument() {
  const [instrument] = await db
    .insert(schema.instruments)
    .values({
      code: "exemple",
      version: "test-0.1",
      source: "Source de test",
      license: "Test",
      isTest: true,
      definitions: { fr: {} },
    })
    .returning();
  return instrument;
}

async function colonnes(table: string) {
  const { rows } = await client.query<{ column_name: string }>(
    "SELECT column_name FROM information_schema.columns WHERE table_name = $1 ORDER BY column_name",
    [table],
  );
  return rows.map((r) => r.column_name);
}

describe("Anonymat et découplage jeton / réponse (règles 1 et 2)", () => {
  it("la table responses ne contient que campagne, groupe, date du jour et versions", async () => {
    expect(await colonnes("responses")).toEqual([
      "campaign_id",
      "group_id",
      "id",
      "instrument_versions",
      "response_date",
    ]);
  });

  it("la table tokens ne contient qu'empreinte, statut, expiration et campagne", async () => {
    expect(await colonnes("tokens")).toEqual([
      "campaign_id",
      "expires_on",
      "id",
      "status",
      "token_hash",
    ]);
  });

  it("aucune clé ne relie les jetons aux réponses ou aux réponses aux questions", async () => {
    const { rows } = await client.query<{ source: string; cible: string }>(`
      SELECT tc.table_name AS source, ccu.table_name AS cible
      FROM information_schema.table_constraints tc
      JOIN information_schema.constraint_column_usage ccu
        ON tc.constraint_name = ccu.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND (tc.table_name IN ('tokens', 'responses', 'answers')
             OR ccu.table_name IN ('tokens', 'responses', 'answers'))`);
    const liens = rows.map((r) => `${r.source}→${r.cible}`);
    expect(liens).not.toContain("tokens→responses");
    expect(liens).not.toContain("responses→tokens");
    expect(liens.filter((l) => l.includes("tokens")).sort()).toEqual([
      "tokens→campaigns",
    ]);
    expect(liens.some((l) => l.includes("users"))).toBe(false);
  });

  it("la date de réponse est la date du jour, sans heure", async () => {
    const campagne = await creerCampagne();
    const [groupe] = await db
      .insert(schema.groups)
      .values({ campaignId: campagne.id, label: "Service A", expectedSize: 12 })
      .returning();
    const [reponse] = await db
      .insert(schema.responses)
      .values({
        campaignId: campagne.id,
        groupId: groupe.id,
        instrumentVersions: { exemple: "test-0.1" },
      })
      .returning();
    expect(reponse.responseDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("une réponse ne peut pas choisir un groupe d'une autre campagne", async () => {
    const campagne = await creerCampagne();
    const [autreCampagne] = await db
      .insert(schema.campaigns)
      .values({
        organizationId: campagne.organizationId,
        mandateType: "flash",
        mandateReference: "AUTRE",
        startDate: "2026-11-01",
        endDate: "2026-11-30",
        locales: ["fr"],
      })
      .returning();
    const [groupeAutre] = await db
      .insert(schema.groups)
      .values({ campaignId: autreCampagne.id, label: "Service B", expectedSize: 15 })
      .returning();
    await refuse(
      db.insert(schema.responses).values({
        campaignId: campagne.id,
        groupId: groupeAutre.id,
        instrumentVersions: {},
      }),
      "responses_groupe_de_la_campagne",
    );
  });

  it("aucun texte libre : une phrase est refusée comme identifiant de question", async () => {
    const campagne = await creerCampagne();
    const [groupe] = await db
      .insert(schema.groups)
      .values({ campaignId: campagne.id, label: "Service A", expectedSize: 12 })
      .returning();
    const [reponse] = await db
      .insert(schema.responses)
      .values({ campaignId: campagne.id, groupId: groupe.id, instrumentVersions: {} })
      .returning();
    await refuse(
      db.insert(schema.answers).values({
        responseId: reponse.id,
        itemId: "Je m'appelle Paul, service compta",
        value: 3,
      }),
      "answers_item_code",
    );
    await refuse(
      db.insert(schema.answers).values({ responseId: reponse.id, itemId: "ex1", value: 11 }),
      "answers_valeur",
    );
    // « Je préfère ne pas répondre » = valeur vide, acceptée
    await db
      .insert(schema.answers)
      .values({ responseId: reponse.id, itemId: "ex1", value: null });
  });
});

describe("Seuil de 10 (règle 3)", () => {
  it("une campagne ne peut pas avoir un seuil inférieur à 10", async () => {
    await refuse(creerCampagne(8), "campaigns_seuil_minimum");
  });

  it("un groupe de 8 personnes est refusé", async () => {
    const campagne = await creerCampagne();
    await refuse(
      db.insert(schema.groups).values({ campaignId: campagne.id, label: "Petit", expectedSize: 8 }),
      "inférieur au seuil de la campagne (10)",
    );
  });

  it("un groupe de 12 est refusé si la campagne a choisi un seuil de 15", async () => {
    const campagne = await creerCampagne(15);
    await refuse(
      db.insert(schema.groups).values({ campaignId: campagne.id, label: "Moyen", expectedSize: 12 }),
      "inférieur au seuil de la campagne",
    );
  });

  it("relever le seuil au-dessus d'un groupe existant est refusé", async () => {
    const campagne = await creerCampagne();
    await db
      .insert(schema.groups)
      .values({ campaignId: campagne.id, label: "Service A", expectedSize: 12 });
    await refuse(
      db
        .update(schema.campaigns)
        .set({ groupMinSize: 20 })
        .where(eq(schema.campaigns.id, campagne.id)),
      "supérieur à l'effectif prévu",
    );
  });

  it("un résultat collectif sur 9 personnes est refusé, sur 10 il est accepté", async () => {
    const campagne = await creerCampagne();
    const instrument = await creerInstrument();
    const agregat = {
      campaignId: campagne.id,
      instrumentId: instrument.id,
      scaleId: "ex_exigences",
      mean: "50.00",
      sd: "10.00",
      scoringVersion: "test",
    };
    await refuse(db.insert(schema.aggregates).values({ ...agregat, n: 9 }), "sous le seuil de la campagne (10)");
    await db.insert(schema.aggregates).values({ ...agregat, n: 10 });
  });

  it("avec un seuil de 15, un résultat sur 12 personnes est refusé", async () => {
    const campagne = await creerCampagne(15);
    const instrument = await creerInstrument();
    await refuse(
      db.insert(schema.aggregates).values({
        campaignId: campagne.id,
        instrumentId: instrument.id,
        scaleId: "ex_exigences",
        n: 12,
        mean: "50.00",
        sd: "10.00",
        scoringVersion: "test",
      }),
      "sous le seuil de la campagne",
    );
  });
});

describe("Validation humaine des rapports (règle 6)", () => {
  async function creerAdmin(email = "admin@ima.test") {
    const [admin] = await db
      .insert(schema.users)
      .values({ email, name: "Praticienne IMA", role: "admin", passwordHash: "x" })
      .returning();
    return admin;
  }

  it("un rapport ne peut pas être validé si la liste de contrôle est incomplète", async () => {
    const campagne = await creerCampagne();
    const admin = await creerAdmin();
    await refuse(
      db.insert(schema.reports).values({
        campaignId: campagne.id,
        status: "validated",
        finalText: "Texte du rapport",
        validatedBy: admin.id,
        validatedAt: new Date(),
        checkSourcesVerified: true,
        checkNoSmallGroup: true,
        checkLanguageRule: true,
        checkLimitsMentioned: false,
      }),
      "reports_validation_complete",
    );
  });

  it("un rapport complet, validé par un administrateur, est accepté", async () => {
    const campagne = await creerCampagne();
    const admin = await creerAdmin();
    await db.insert(schema.reports).values({
      campaignId: campagne.id,
      status: "validated",
      finalText: "Texte du rapport",
      validatedBy: admin.id,
      validatedAt: new Date(),
      checkSourcesVerified: true,
      checkNoSmallGroup: true,
      checkLanguageRule: true,
      checkLimitsMentioned: true,
    });
  });

  it("un référent ne peut pas valider un rapport", async () => {
    const campagne = await creerCampagne();
    const [referent] = await db
      .insert(schema.users)
      .values({
        email: "rh@client.test",
        name: "Référente RH",
        role: "referent",
        organizationId: campagne.organizationId,
      })
      .returning();
    await refuse(
      db.insert(schema.reports).values({
        campaignId: campagne.id,
        status: "draft",
        validatedBy: referent.id,
      }),
      "Seul un administrateur IMA",
    );
  });

  it("un refus de brouillon doit être motivé", async () => {
    const campagne = await creerCampagne();
    await refuse(
      db.insert(schema.reports).values({ campaignId: campagne.id, status: "rejected" }),
      "reports_refus_motive",
    );
  });
});
