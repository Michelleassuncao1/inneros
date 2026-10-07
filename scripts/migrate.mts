// Applique les migrations de drizzle/ à la base : PGlite en développement, PostgreSQL OVH en production.
// Lancement : npm run db:migrate
import nextEnv from "@next/env";
import { mkdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzleNodePg } from "drizzle-orm/node-postgres";
import { migrate as migrateNodePg } from "drizzle-orm/node-postgres/migrator";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";

nextEnv.loadEnvConfig(process.cwd());

const migrationsFolder = "drizzle";
const url = process.env.DATABASE_URL;

if (url && /^postgres(ql)?:\/\//.test(url)) {
  const db = drizzleNodePg(url);
  await migrateNodePg(db, { migrationsFolder });
  await db.$client.end();
  console.log("Migrations appliquées sur PostgreSQL.");
} else {
  mkdirSync(".data", { recursive: true });
  const dossier = process.env.PGLITE_DIR || ".data/pglite";
  const client = new PGlite(dossier);
  await migratePglite(drizzlePglite(client), { migrationsFolder });
  const { rows } = await client.query<{ table_name: string }>(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name",
  );
  await client.close();
  console.log(`Migrations appliquées sur PGlite (${dossier}).`);
  console.log(`Tables : ${rows.map((r) => r.table_name).join(", ")}`);
}
