// Crée une campagne de démonstration clôturée, avec des réponses fictives (étape 7).
// Groupes : Soins (25 réponses), Administration (12) et Logistique (9, sous le seuil : jamais affiché).
// Questionnaires : COPSOQ III belge et Flourishing s'ils sont enregistrés, sinon le questionnaire de test.
// Réservé au développement (PGlite) : refusé si DATABASE_URL désigne une base PostgreSQL.
// Usage : npm run demo:campagne   (serveur de développement arrêté)
import { loadEnvConfig } from "@next/env";
import { and, eq, inArray } from "drizzle-orm";

loadEnvConfig(process.cwd());

async function principal() {
  if (process.env.DATABASE_URL) throw new Error("Refusé : DATABASE_URL est défini (base PostgreSQL). La démonstration est réservée au développement.");
  const { getDb } = await import("../lib/db/client");
  const { instruments, users } = await import("../lib/db/schema");
  const { chargerQuestionnaireDeTest } = await import("../lib/db/test-db");
  const { creerCampagneDemo } = await import("../lib/resultats/demo");
  const db = getDb();

  const [admin] = await db.select().from(users).where(and(eq(users.role, "admin")));
  if (!admin) throw new Error("Aucun administrateur : créez-en un avec npm run admin:create.");

  const reels = await db
    .select({ id: instruments.id, code: instruments.code })
    .from(instruments)
    .where(
      and(
        inArray(instruments.code, ["copsoq3", "flourishing"]),
        inArray(instruments.version, ["be-2023-12-13", "diener-2009"]),
      ),
    );
  const instrumentIds = reels.length ? reels.map((r) => r.id) : [await chargerQuestionnaireDeTest(db, ["fr"])];

  const id = await creerCampagneDemo(db, {
    adminId: admin.id,
    instrumentIds,
    groupes: [
      { libelle: "Soins", attendus: 30, repondants: 25 },
      { libelle: "Administration", attendus: 14, repondants: 12 },
      { libelle: "Logistique", attendus: 12, repondants: 9 },
    ],
  });
  console.log(`Campagne de démonstration créée et clôturée : /fr/admin/campagnes/${id}/resultats`);
  console.log(`Questionnaires : ${reels.length ? reels.map((r) => r.code).join(", ") : "questionnaire de test"}`);
}

principal().then(
  () => process.exit(0),
  (e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  },
);
