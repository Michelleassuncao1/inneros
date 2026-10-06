// À n'importer que côté serveur (pages serveur, actions, routes API).
import { mkdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzleNodePg } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import * as schema from "./schema";

// DATABASE_URL vide → PGlite (développement, données dans .data/pglite).
// DATABASE_URL postgres://… → PostgreSQL managé OVH (production).
export const PGLITE_DIR = ".data/pglite";

function creerClient() {
  const url = process.env.DATABASE_URL;
  if (url && /^postgres(ql)?:\/\//.test(url)) {
    return drizzleNodePg(url, { schema });
  }
  mkdirSync(".data", { recursive: true });
  return drizzlePglite(new PGlite(PGLITE_DIR), { schema });
}

// Une seule connexion par processus, y compris lors des rechargements en développement
const globalPourDb = globalThis as unknown as {
  innerosDb?: ReturnType<typeof creerClient>;
};

export const db = globalPourDb.innerosDb ?? creerClient();

if (process.env.NODE_ENV !== "production") {
  globalPourDb.innerosDb = db;
}
