import { defineConfig } from "drizzle-kit";

// Les migrations générées dans drizzle/ servent à la fois pour PGlite (développement)
// et pour PostgreSQL OVH (production).
export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
});
