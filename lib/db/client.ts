// À n'importer que côté serveur (pages serveur, actions, routes API, scripts).
import { mkdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzleNodePg } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import * as schema from "./schema";
import type { Db } from "./types";

// DATABASE_URL vide → PGlite (développement, données dans .data/pglite, ou PGLITE_DIR pour une base de test).
// DATABASE_URL postgres://… → PostgreSQL managé OVH (production).
// Attention : PGlite n'accepte qu'un seul programme à la fois. Arrêter le serveur
// de développement avant de lancer un script qui ouvre la base (admin:create…).
export const PGLITE_DIR = process.env.PGLITE_DIR || ".data/pglite";

function creerClient(): Db {
  const url = process.env.DATABASE_URL;
  if (url && /^postgres(ql)?:\/\//.test(url)) {
    // Production : connexion chiffrée (TLS) obligatoire vers la base OVH
    if (process.env.NODE_ENV === "production" && !/[?&]sslmode=(require|verify-ca|verify-full)\b/.test(url)) {
      throw new Error("DATABASE_URL doit imposer une connexion chiffrée (sslmode=require ou verify-full).");
    }
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

// Fermeture propre en fin de script (évite un arrêt brutal pendant que PGlite écrit encore)
export async function fermerDb() {
  const client = (globalPourDb.innerosDb as unknown as { $client?: { close?: () => Promise<void>; end?: () => Promise<void> } } | undefined)?.$client;
  globalPourDb.innerosDb = undefined;
  if (client?.close) await client.close();
  else if (client?.end) await client.end();
}
