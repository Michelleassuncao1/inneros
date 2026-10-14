// Étape 9 : suppression programmée des réponses brutes, conservation des agrégats et du rapport,
// acceptation réservée au référent signataire, journal sans données de répondants.
import { randomBytes } from "node:crypto";
import { count, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { aggregates, answers, auditLog, campaignReferents, campaigns, reports, responses, users } from "../db/schema";
import { chargerQuestionnaireDeTest, creerBaseDeTest } from "../db/test-db";
import type { Db } from "../db/types";
import { creerCampagneDemo } from "../resultats/demo";
import { moisAvant, purgerDonnees } from "./conservation";

const MAINTENANT = new Date("2027-12-01T12:00:00Z");
const GROUPES = [
  { libelle: "Soins", attendus: 30, repondants: 12 },
  { libelle: "Administration", attendus: 14, repondants: 10 },
];

beforeAll(() => {
  process.env.AUTH_SECRET = randomBytes(32).toString("base64");
});

async function base() {
  const { db } = await creerBaseDeTest();
  const [admin] = await db
    .insert(users)
    .values({ email: "admin@ima.test", name: "Admin", role: "admin", passwordHash: "x" })
    .returning();
  const instrumentId = await chargerQuestionnaireDeTest(db, ["fr"]);
  const demo = (options: { cloture?: Date; accepteIlYa?: number; graine: number }) =>
    creerCampagneDemo(db, {
      adminId: admin.id,
      instrumentIds: [instrumentId],
      groupes: GROUPES,
      maintenant: options.cloture ?? MAINTENANT,
      graine: options.graine,
      rapportAccepteIlYaMois: options.accepteIlYa,
    });
  return { db, admin, demo };
}

const nombre = async (db: Db, table: typeof responses | typeof aggregates | typeof reports, campaignId: string) =>
  (await db.select({ n: count() }).from(table).where(eq(table.campaignId, campaignId)))[0].n;

describe("Dates", () => {
  it("compte les mois en respectant les fins de mois", () => {
    expect(moisAvant(new Date("2027-03-31T12:00:00Z"), 1).toISOString().slice(0, 10)).toBe("2027-02-28");
    expect(moisAvant(new Date("2027-12-01T12:00:00Z"), 12).toISOString().slice(0, 10)).toBe("2026-12-01");
  });
});

describe("Suppression des réponses brutes", () => {
  it("supprime 12 mois après l'acceptation, garde agrégats et rapport, et le journalise", async () => {
    const { db, demo } = await base();
    const ancienne = await demo({ accepteIlYa: 13, graine: 1 }); // rapport accepté il y a 13 mois
    const recente = await demo({ accepteIlYa: 11, graine: 2 }); // il y a 11 mois : pas encore
    const agregatsAvant = await nombre(db, aggregates, ancienne);

    // Simulation : rien n'est supprimé
    const simulation = await purgerDonnees(db, { maintenant: MAINTENANT, simulation: true });
    expect(simulation.campagnes).toEqual([{ campaignId: ancienne, reponses: 22, motif: "acceptation" }]);
    expect(await nombre(db, responses, ancienne)).toBe(22);

    await purgerDonnees(db, { maintenant: MAINTENANT });
    expect(await nombre(db, responses, ancienne)).toBe(0);
    expect(await db.select({ n: count() }).from(answers)).toEqual([{ n: 22 * 8 }]); // seuls restent ceux de « recente »
    expect(await nombre(db, aggregates, ancienne)).toBe(agregatsAvant);
    expect(await nombre(db, reports, ancienne)).toBe(1);
    const [campagne] = await db.select().from(campaigns).where(eq(campaigns.id, ancienne));
    expect(campagne.rawDeletedAt).not.toBeNull();
    expect(await nombre(db, responses, recente)).toBe(22);

    const [entree] = await db.select().from(auditLog).where(eq(auditLog.action, "raw_responses_deleted"));
    expect(entree.targetId).toBe(ancienne);
    expect(entree.details).toEqual({ reponses: 22, motif: "acceptation" });

    // Une seconde purge ne trouve plus rien
    expect((await purgerDonnees(db, { maintenant: MAINTENANT })).campagnes).toEqual([]);
  });

  it("supprime par sécurité 18 mois après la clôture si le rapport n'est jamais accepté", async () => {
    const { db, demo } = await base();
    const abandonnee = await demo({ cloture: moisAvant(MAINTENANT, 19), graine: 3 });
    const recente = await demo({ cloture: moisAvant(MAINTENANT, 17), graine: 4 });
    const r = await purgerDonnees(db, { maintenant: MAINTENANT });
    expect(r.campagnes).toEqual([{ campaignId: abandonnee, reponses: 22, motif: "cloture" }]);
    expect(await nombre(db, responses, abandonnee)).toBe(0);
    expect(await nombre(db, responses, recente)).toBe(22);
  });

  it("supprime le journal d'audit de plus de 24 mois", async () => {
    const { db } = await base();
    await db.insert(auditLog).values([
      { action: "ancienne", at: moisAvant(MAINTENANT, 25) },
      { action: "recente", at: moisAvant(MAINTENANT, 23) },
    ]);
    const r = await purgerDonnees(db, { maintenant: MAINTENANT });
    expect(r.journal).toBe(1);
    const actions = (await db.select().from(auditLog)).map((e) => e.action);
    expect(actions).not.toContain("ancienne");
    expect(actions).toEqual(expect.arrayContaining(["recente", "audit_log_purged"]));
  });
});

describe("Acceptation du rapport par l'entreprise", () => {
  it("n'est possible que pour le référent signataire, et après la validation IMA", async () => {
    const { db, admin, demo } = await base();
    const id = await demo({ graine: 5 });
    const [{ userId: signataire }] = await db.select().from(campaignReferents).where(eq(campaignReferents.campaignId, id));
    const valide = {
      campaignId: id,
      status: "validated" as const,
      finalText: "Texte",
      checkSourcesVerified: true,
      checkNoSmallGroup: true,
      checkLanguageRule: true,
      checkLimitsMentioned: true,
      validatedBy: admin.id,
      validatedAt: MAINTENANT,
    };
    // Aucun signataire désigné : refusé
    await expect(db.insert(reports).values({ ...valide, acceptedBy: signataire, acceptedAt: MAINTENANT })).rejects.toThrow();
    await db.update(campaigns).set({ signatoryReferentId: signataire }).where(eq(campaigns.id, id));
    // Rapport non validé par IMA : refusé
    await expect(
      db.insert(reports).values({ campaignId: id, status: "draft", acceptedBy: signataire, acceptedAt: MAINTENANT }),
    ).rejects.toThrow();
    // Un administrateur à la place du signataire : refusé
    await expect(db.insert(reports).values({ ...valide, acceptedBy: admin.id, acceptedAt: MAINTENANT })).rejects.toThrow();
    // Signataire, après validation IMA : accepté
    await db.insert(reports).values({ ...valide, acceptedBy: signataire, acceptedAt: MAINTENANT });
  });

  it("le signataire doit être un référent de la campagne", async () => {
    const { db, admin, demo } = await base();
    const id = await demo({ graine: 6 });
    await expect(db.update(campaigns).set({ signatoryReferentId: admin.id }).where(eq(campaigns.id, id))).rejects.toThrow();
  });
});

describe("Journal d'audit", () => {
  it("ne contient aucune donnée de répondant (ni code, ni réponse)", async () => {
    const { db, demo } = await base();
    await demo({ accepteIlYa: 13, graine: 7 });
    await purgerDonnees(db, { maintenant: MAINTENANT });
    // Identifiants techniques (UUID) et dates retirés : ils peuvent ressembler par hasard au format des codes
    const texte = JSON.stringify(await db.select().from(auditLog))
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "")
      .replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z/g, "");
    expect(texte).not.toMatch(/[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{2}/); // format des codes
    expect(texte).not.toMatch(/innerostest_t\d/); // clés des réponses
  });
});
