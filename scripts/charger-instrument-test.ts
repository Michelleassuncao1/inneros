// Charge le questionnaire de test du kit (instruments/exemple-format.json), items « ITEM DE TEST ».
// Les questionnaires officiels seront chargés à l'étape 5, sans modifier un mot des items.
// Usage : npm run instruments:test (serveur de développement arrêté)
import { readFileSync } from "node:fs";
import { loadEnvConfig } from "@next/env";
import { and, eq } from "drizzle-orm";
import { getDb } from "../lib/db/client";
import { instruments } from "../lib/db/schema";

loadEnvConfig(process.cwd());

async function principal() {
  const fichier = JSON.parse(readFileSync("instruments/exemple-format.json", "utf8"));
  const db = getDb();
  const [existant] = await db
    .select({ id: instruments.id })
    .from(instruments)
    .where(and(eq(instruments.code, fichier.instrument), eq(instruments.version, fichier.version)));
  if (existant) {
    console.log(`Questionnaire de test déjà chargé (${fichier.instrument} ${fichier.version}).`);
    return;
  }
  await db.insert(instruments).values({
    code: fichier.instrument,
    version: fichier.version,
    source: fichier.source,
    license: fichier.licence,
    isTest: true,
    definitions: { [fichier.langue]: fichier },
  });
  console.log(`Questionnaire de test chargé : ${fichier.instrument} ${fichier.version}.`);
}

principal()
  .then(() => process.exit(0))
  .catch((e: Error) => {
    console.error(`Erreur : ${e.message}`);
    process.exit(1);
  });
