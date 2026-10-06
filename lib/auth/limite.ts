// Limitation des tentatives : 5 échecs en 15 minutes bloquent l'adresse pendant 15 minutes.
// La clé est une empreinte de l'adresse : le compteur ne contient aucune adresse e-mail.
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { loginAttempts } from "../db/schema";
import type { Db } from "../db/types";

export const ECHECS_MAXIMUM = 5;
export const FENETRE_MS = 15 * 60 * 1000;

export function normaliserEmail(email: string) {
  return email.trim().toLowerCase();
}

export function cleLimite(type: "admin" | "lien", email: string) {
  return createHash("sha256").update(`${type}:${normaliserEmail(email)}`).digest("hex");
}

export async function estBloque(db: Db, cle: string, maintenant = new Date()) {
  const [ligne] = await db.select().from(loginAttempts).where(eq(loginAttempts.key, cle));
  return !!ligne?.lockedUntil && ligne.lockedUntil > maintenant;
}

export async function enregistrerEchec(db: Db, cle: string, maintenant = new Date()) {
  const [ligne] = await db.select().from(loginAttempts).where(eq(loginAttempts.key, cle));
  const nouvelleFenetre =
    !ligne || ligne.windowStart.getTime() < maintenant.getTime() - FENETRE_MS;
  const echecs = nouvelleFenetre ? 1 : ligne.failures + 1;
  const valeurs = {
    failures: echecs,
    windowStart: nouvelleFenetre ? maintenant : ligne.windowStart,
    lockedUntil:
      echecs >= ECHECS_MAXIMUM ? new Date(maintenant.getTime() + FENETRE_MS) : null,
  };
  await db
    .insert(loginAttempts)
    .values({ key: cle, ...valeurs })
    .onConflictDoUpdate({ target: loginAttempts.key, set: valeurs });
}

export async function effacerEchecs(db: Db, cle: string) {
  await db.delete(loginAttempts).where(eq(loginAttempts.key, cle));
}
