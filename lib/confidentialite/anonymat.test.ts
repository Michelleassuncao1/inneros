// Audit d'anonymat (14/10/2026) : aucune métadonnée de la base ne relie un code à une réponse.
import { randomBytes } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { ajouterGroupe, choisirQuestionnaires, choisirReferents, creerCampagne } from "../admin/campagnes";
import { cloturerCampagne, ouvrirCampagne } from "../admin/cycle";
import { ajouterReferent, creerEntreprise } from "../admin/entreprises";
import { genererJetons } from "../admin/jetons";
import { answers, groups, responses, tokens, users } from "../db/schema";
import { chargerQuestionnaireDeTest, creerBaseDeTest } from "../db/test-db";
import type { Db } from "../db/types";
import { enregistrerReponses } from "../passation";

const MAINTENANT = new Date("2026-11-10T10:00:00Z");
const REPONSES = {
  innerostest_t1: 4, innerostest_t2: 3, innerostest_t3: 0, innerostest_t4: null,
  innerostest_t5: 2, innerostest_t6: 7, innerostest_t7: 1, innerostest_t8: 4,
};

beforeAll(() => {
  process.env.AUTH_SECRET = randomBytes(32).toString("base64");
});

async function campagneOuverte(nombreCodes: number) {
  const { db } = await creerBaseDeTest();
  const [admin] = await db.insert(users).values({ email: "admin@ima.test", name: "Admin", role: "admin", passwordHash: "x" }).returning();
  const org = await creerEntreprise(db, admin.id, { name: "Entreprise", country: "BE", locale: "fr", sector: "Services", sizeBand: "50-249" });
  if (!org.ok) throw new Error(org.erreur);
  const c = await creerCampagne(db, admin.id, org.valeur.id, {
    mandateType: "n1", mandateReference: "M-1", diagnosticQuestion: "", perimeter: "", groupMinSize: 10,
    startDate: "2026-11-01", endDate: "2026-11-30", locales: ["fr"], groupingCriterion: "service",
  });
  if (!c.ok) throw new Error(c.erreur);
  await ajouterGroupe(db, admin.id, c.valeur.id, { label: "Production", expectedSize: 12 });
  const [groupe] = await db.select().from(groups);
  await choisirQuestionnaires(db, admin.id, c.valeur.id, [await chargerQuestionnaireDeTest(db, ["fr"])]);
  await ajouterReferent(db, admin.id, org.valeur.id, { name: "RH", email: "rh@client.test" });
  const [referent] = await db.select().from(users).where(eq(users.email, "rh@client.test"));
  await choisirReferents(db, admin.id, c.valeur.id, [referent.id]);
  const j = await genererJetons(db, admin.id, c.valeur.id, nombreCodes);
  if (!j.ok) throw new Error(j.erreur);
  const o = await ouvrirCampagne(db, admin.id, c.valeur.id, { mandateValidatedOn: "2026-10-15", confirmation: "oui" }, MAINTENANT);
  if (!o.ok) throw new Error(o.erreur);
  return { db, adminId: admin.id, campagneId: c.valeur.id, groupeId: groupe.id, codes: j.valeur.codes };
}

// Numéros de transaction (colonne cachée xmin) renvoyés par une requête
const numeros = async (db: Db, requete: ReturnType<typeof sql.raw>) =>
  ((await db.execute(requete)) as unknown as { rows: { x: string }[] }).rows.map((r) => r.x);
const xmin = (db: Db, table: "tokens" | "responses" | "answers") => numeros(db, sql.raw(`select xmin::text as x from ${table}`));

describe("Anonymat dans la base", () => {
  it("pendant la collecte, un code utilisé et une réponse n'ont jamais le même numéro de transaction", async () => {
    const { db, groupeId, codes } = await campagneOuverte(3);
    for (const code of codes.slice(0, 2)) {
      expect(await enregistrerReponses(db, { code, groupe: groupeId, reponses: REPONSES }, MAINTENANT)).toEqual({ ok: true });
    }
    const codesUtilises = new Set(await numeros(db, sql.raw("select xmin::text as x from tokens where status = 'consumed'")));
    for (const x of [...(await xmin(db, "responses")), ...(await xmin(db, "answers"))]) expect(codesUtilises.has(x)).toBe(false);
  });

  it("un envoi refusé ne consomme pas le code", async () => {
    const { db, groupeId, codes } = await campagneOuverte(1);
    const incomplet = { innerostest_t1: 4 };
    expect(await enregistrerReponses(db, { code: codes[0], groupe: groupeId, reponses: incomplet }, MAINTENANT)).toEqual({
      ok: false,
      raison: "reponses",
    });
    const [jeton] = await db.select().from(tokens);
    expect(jeton.status).toBe("active");
    expect(await db.select().from(responses)).toHaveLength(0);
  });

  it("à la clôture, les réponses sont réécrites : un seul numéro de transaction, de nouveaux identifiants, rien de perdu", async () => {
    const { db, adminId, campagneId, groupeId, codes } = await campagneOuverte(12);
    for (const code of codes.slice(0, 11)) await enregistrerReponses(db, { code, groupe: groupeId, reponses: REPONSES }, MAINTENANT);
    const avant = (await db.select({ id: responses.id }).from(responses)).map((r) => r.id);
    const itemsAvant = (await db.select().from(answers)).length;

    expect((await cloturerCampagne(db, adminId, campagneId, MAINTENANT)).ok).toBe(true);

    const apres = (await db.select({ id: responses.id }).from(responses)).map((r) => r.id);
    expect(apres).toHaveLength(11);
    expect(apres.some((id) => avant.includes(id))).toBe(false); // nouveaux identifiants
    expect(new Set(await xmin(db, "responses")).size).toBe(1); // même transaction pour toutes
    expect(new Set(await xmin(db, "answers")).size).toBe(1);
    expect(await db.select().from(answers)).toHaveLength(itemsAvant);
    expect(await db.select().from(tokens)).toHaveLength(0); // codes supprimés
  });
});
