// Suivi des erreurs (étape 10) : les erreurs du serveur (instrumentation.ts) et du navigateur (/api/erreurs)
// sont regroupées par source, page et type, avec un compteur, et affichées dans l'espace IMA (onglet « Erreurs »).
// Aucune donnée personnelle : ni message d'erreur, ni adresse réseau, ni identifiant ou code dans la page.
import { and, count, desc, eq, gte, isNull, lt, sql } from "drizzle-orm";
import { routing } from "../../i18n/routing";
import { errorEvents } from "../db/schema";
import type { Db } from "../db/types";

const JOUR = 86_400_000;
export const CONSERVATION_ERREURS_JOURS = 90;
export const AFFICHAGE_ERREURS_JOURS = 30;
const LIGNES_MAXIMUM = 500; // au-delà, seules les erreurs déjà connues sont comptées (protection contre l'envoi en masse)

export type SourceErreur = "serveur" | "navigateur";

// Page sans identifiant : la langue devient [locale], les identifiants et codes deviennent [id].
export function nettoyerRoute(chemin: string) {
  const segments = (chemin.split(/[?#]/)[0] ?? "").split("/").filter(Boolean);
  const propres = segments.map((s, i) => {
    if (i === 0 && (routing.locales as readonly string[]).includes(s)) return "[locale]";
    if (/^\[[a-zA-Z.]+\]$/.test(s)) return s; // déjà un modèle de route (erreurs du serveur)
    if (/\d/.test(s) || s.length > 30 || !/^[a-z-]+$/.test(s)) return "[id]";
    return s;
  });
  return `/${propres.join("/")}`.slice(0, 200);
}

export function typeErreur(nom: unknown) {
  return typeof nom === "string" && /^[A-Za-z][A-Za-z0-9_]{0,59}$/.test(nom) ? nom : "Error";
}

export async function enregistrerErreur(
  db: Db,
  e: { source: SourceErreur; route: string; type?: unknown; digest?: unknown },
  maintenant = new Date(),
) {
  const route = nettoyerRoute(e.route);
  const kind = typeErreur(e.type);
  const digest = typeof e.digest === "string" && /^[A-Za-z0-9@:_-]{1,64}$/.test(e.digest) ? e.digest : null;
  const fingerprint = `${e.source}|${route}|${kind}`;
  const [{ n }] = await db.select({ n: count() }).from(errorEvents);
  if (n >= LIGNES_MAXIMUM) {
    await db
      .update(errorEvents)
      .set({ occurrences: sql`${errorEvents.occurrences} + 1`, lastAt: maintenant, resolvedAt: null })
      .where(eq(errorEvents.fingerprint, fingerprint));
    return;
  }
  await db
    .insert(errorEvents)
    .values({ fingerprint, source: e.source, route, kind, digest, firstAt: maintenant, lastAt: maintenant })
    .onConflictDoUpdate({
      target: errorEvents.fingerprint,
      // Une erreur « traitée » qui revient redevient nouvelle
      set: { occurrences: sql`${errorEvents.occurrences} + 1`, lastAt: maintenant, digest, resolvedAt: null },
    });
}

export async function erreursRecentes(db: Db, maintenant = new Date()) {
  return db
    .select()
    .from(errorEvents)
    .where(gte(errorEvents.lastAt, new Date(maintenant.getTime() - AFFICHAGE_ERREURS_JOURS * JOUR)))
    .orderBy(desc(errorEvents.lastAt))
    .limit(200);
}

export async function nombreErreursNonTraitees(db: Db) {
  const [{ n }] = await db.select({ n: count() }).from(errorEvents).where(isNull(errorEvents.resolvedAt));
  return n;
}

export async function marquerErreurTraitee(db: Db, id: string, maintenant = new Date()) {
  await db
    .update(errorEvents)
    .set({ resolvedAt: maintenant })
    .where(and(eq(errorEvents.id, id), isNull(errorEvents.resolvedAt)));
}

// Tâche de nuit : erreurs sans nouvelle occurrence depuis 90 jours.
export async function purgerErreurs(db: Db, maintenant = new Date()) {
  const supprimees = await db
    .delete(errorEvents)
    .where(lt(errorEvents.lastAt, new Date(maintenant.getTime() - CONSERVATION_ERREURS_JOURS * JOUR)))
    .returning({ id: errorEvents.id });
  return supprimees.length;
}
