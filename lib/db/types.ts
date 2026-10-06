import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type * as schema from "./schema";

// Type commun aux bases PGlite (développement, tests) et PostgreSQL (production)
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;
