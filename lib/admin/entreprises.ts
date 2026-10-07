// Fiches entreprises (F3) et référents. Toute entrée est validée par Zod avant d'atteindre la base.
import { randomInt } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { journaliser } from "../audit";
import { normaliserEmail } from "../auth/limite";
import { campaigns, organizations, users } from "../db/schema";
import type { Db } from "../db/types";

export const PAYS = ["BE", "FR", "BR", "PT"] as const;
export const LANGUES = ["fr", "pt-BR"] as const;
export const TRANCHES = ["lt50", "50-249", "250-999", "1000+"] as const;

export type Resultat<T = undefined> = { ok: true; valeur: T } | { ok: false; erreur: string };

export const schemaEntreprise = z.object({
  name: z.string().trim().min(2).max(120),
  country: z.enum(PAYS),
  locale: z.enum(LANGUES),
  sector: z.string().trim().min(2).max(120),
  sizeBand: z.enum(TRANCHES),
});

export const schemaReferent = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
});

// Code interne sans caractères ambigus (0/O, 1/I/L), transmis à l'IA à la place du nom (règle 5)
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
function codeInterne() {
  return `ORG-${Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("")}`;
}

export async function creerEntreprise(
  db: Db,
  adminId: string,
  saisie: unknown,
): Promise<Resultat<{ id: string }>> {
  const donnees = schemaEntreprise.safeParse(saisie);
  if (!donnees.success) return { ok: false, erreur: "saisieInvalide" };

  for (let essai = 0; essai < 5; essai++) {
    const code = codeInterne();
    const [existant] = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.internalCode, code));
    if (existant) continue;
    const [org] = await db
      .insert(organizations)
      .values({ ...donnees.data, internalCode: code })
      .returning({ id: organizations.id });
    await journaliser(db, {
      actorUserId: adminId,
      action: "organization_created",
      targetType: "organization",
      targetId: org.id,
    });
    return { ok: true, valeur: org };
  }
  return { ok: false, erreur: "inattendue" };
}

export async function modifierEntreprise(
  db: Db,
  adminId: string,
  id: string,
  saisie: unknown,
): Promise<Resultat> {
  const donnees = schemaEntreprise.safeParse(saisie);
  if (!donnees.success) return { ok: false, erreur: "saisieInvalide" };
  const [org] = await db.select().from(organizations).where(eq(organizations.id, id));
  if (!org) return { ok: false, erreur: "introuvable" };

  // Le pays fixe le contenu (aides, législation) de toutes les campagnes : il ne change plus ensuite
  if (donnees.data.country !== org.country) {
    const [campagne] = await db
      .select({ id: campaigns.id })
      .from(campaigns)
      .where(eq(campaigns.organizationId, id))
      .limit(1);
    if (campagne) return { ok: false, erreur: "paysVerrouille" };
  }

  await db.update(organizations).set(donnees.data).where(eq(organizations.id, id));
  await journaliser(db, {
    actorUserId: adminId,
    action: "organization_updated",
    targetType: "organization",
    targetId: id,
  });
  return { ok: true, valeur: undefined };
}

export async function ajouterReferent(
  db: Db,
  adminId: string,
  organizationId: string,
  saisie: unknown,
): Promise<Resultat> {
  const donnees = schemaReferent.safeParse(saisie);
  if (!donnees.success) return { ok: false, erreur: "saisieInvalide" };
  const email = normaliserEmail(donnees.data.email);

  const [existant] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (existant) return { ok: false, erreur: "emailDejaUtilise" };

  const [referent] = await db
    .insert(users)
    .values({ name: donnees.data.name, email, role: "referent", organizationId })
    .returning({ id: users.id });
  await journaliser(db, {
    actorUserId: adminId,
    action: "referent_created",
    targetType: "user",
    targetId: referent.id,
  });
  return { ok: true, valeur: undefined };
}

// Désactiver un référent lui retire tout accès, immédiatement (droits relus à chaque page)
export async function changerEtatReferent(
  db: Db,
  adminId: string,
  referentId: string,
  actif: boolean,
): Promise<Resultat> {
  const [referent] = await db
    .update(users)
    .set({ disabledAt: actif ? null : new Date() })
    .where(and(eq(users.id, referentId), eq(users.role, "referent")))
    .returning({ id: users.id });
  if (!referent) return { ok: false, erreur: "introuvable" };
  await journaliser(db, {
    actorUserId: adminId,
    action: actif ? "referent_enabled" : "referent_disabled",
    targetType: "user",
    targetId: referentId,
  });
  return { ok: true, valeur: undefined };
}
