// Développement uniquement : crée une entreprise fictive et un référent de test.
// Usage : npm run dev:referent-test -- adresse@exemple.com
import { loadEnvConfig } from "@next/env";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { normaliserEmail } from "../lib/auth/limite";
import { getDb } from "../lib/db/client";
import { organizations, users } from "../lib/db/schema";

loadEnvConfig(process.cwd());

async function principal() {
  if (process.env.NODE_ENV === "production" || process.env.DATABASE_URL) {
    throw new Error("Script réservé à la base de développement (PGlite).");
  }
  const email = normaliserEmail(process.argv[2] ?? "");
  if (!z.string().email().safeParse(email).success) throw new Error("Adresse e-mail invalide.");

  const db = getDb();
  let [org] = await db.select().from(organizations).where(eq(organizations.internalCode, "ORG-TEST1"));
  org ??= (
    await db
      .insert(organizations)
      .values({
        internalCode: "ORG-TEST1",
        name: "Entreprise fictive (test)",
        country: "BE",
        locale: "fr",
        sector: "Services (test)",
        sizeBand: "50-249",
      })
      .returning()
  )[0];

  const [existant] = await db.select().from(users).where(eq(users.email, email));
  if (existant) {
    console.log(`Le compte ${email} existe déjà (${existant.role}).`);
    return;
  }
  await db.insert(users).values({
    email,
    name: "Référent de test",
    role: "referent",
    organizationId: org.id,
  });
  console.log(`Référent de test créé : ${email}, rattaché à « ${org.name} ».`);
}

principal()
  .then(() => process.exit(0))
  .catch((e: Error) => {
    console.error(`Erreur : ${e.message}`);
    process.exit(1);
  });
