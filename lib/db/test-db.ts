// Base PGlite neuve, en mémoire, créée avec les vraies migrations : réservée aux tests.
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { enregistrerInstrument, lireInstrument } from "../instruments/chargement";
import * as schema from "./schema";
import type { Db } from "./types";

export async function creerBaseDeTest() {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "drizzle" });
  return { client, db };
}

// Charge le questionnaire de test (items fictifs) dans les langues demandées et renvoie son identifiant
export async function chargerQuestionnaireDeTest(db: Db, langues: string[] = ["fr"]) {
  for (const langue of langues) {
    const r = lireInstrument(JSON.parse(readFileSync(`instruments/test/innerostest-0.2.${langue}.json`, "utf8")));
    if (!r.ok) throw new Error(r.erreurs.join(", "));
    const e = await enregistrerInstrument(db, r.fichier);
    if (!e.ok) throw new Error(e.erreur);
  }
  const [instrument] = await db
    .select()
    .from(schema.instruments)
    .where(and(eq(schema.instruments.code, "innerostest"), eq(schema.instruments.version, "test-0.2")));
  return instrument.id;
}
