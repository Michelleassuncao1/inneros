// À n'importer que côté serveur (pages serveur, actions, routes API, scripts).
import { mkdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzleNodePg } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import * as schema from "./schema";
import type { Db } from "./types";

// DATABASE_URL vide → PGlite (développement, données dans .data/pglite).
// DATABASE_URL postgres://… → PostgreSQL managé OVH (production).
// Attention : PGlite n'accepte qu'un seul programme à la fois. Arrêter le serveur
// de développement avant de lancer un script qui ouvre la base (admin:create…).
export const PGLITE_DIR = ".data/pglite";

function creerClient(): Db {
  const url = process.env.DATABASE_URL;
  if (url && /^postgres(ql)?:\/\//.test(url)) {
    return drizzleNodePg(url, { schema });
  }
  mkdirSync(".data", { recursive: true });
  return drizzlePglite(new PGlite(PGLITE_DIR), { schema });
}

// Ouverture à la première utilisation, une seule connexion par processus,
// y compris lors des rechargements en développement
const globalPourDb = globalThis as unknown as { innerosDb?: Db };

export function getDb(): Db {
  globalPourDb.innerosDb ??= creerClient();
  return globalPourDb.innerosDb;
}
