// Applique les migrations de drizzle/ à la base : PGlite en développement, PostgreSQL OVH en production.
// Lancement : npm run db:migrate
// En production, DATABASE_MIGRATION_URL (propriétaire des tables) est utilisé s'il existe, sinon DATABASE_URL.
import nextEnv from "@next/env";
import { mkdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzleNodePg } from "drizzle-orm/node-postgres";
import { migrate as migrateNodePg } from "drizzle-orm/node-postgres/migrator";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { estUrlPostgres, poolPostgres } from "../lib/db/postgres.ts";

nextEnv.loadEnvConfig(process.cwd());

const migrationsFolder = "drizzle";
const url = process.env.DATABASE_MIGRATION_URL || process.env.DATABASE_URL;

if (estUrlPostgres(url)) {
  const pool = poolPostgres(url, { max: 1 });
  await migrateNodePg(drizzleNodePg({ client: pool }), { migrationsFolder });
  await pool.end();
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
