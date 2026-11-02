// Limitation des requêtes par appareil (étape 10) : protège les pages publiques et la connexion contre les robots
// (codes essayés au hasard, inscriptions en masse, envois d'e-mails). Compteur en base, sans service extérieur.
// Anonymat : l'adresse réseau n'est jamais enregistrée. La clé est une empreinte HMAC (secret du serveur + jour),
// impossible à relier à une adresse et qui change chaque jour ; elle n'est jamais liée aux réponses.
import { createHmac } from "node:crypto";
import { eq, lt, sql } from "drizzle-orm";
import { rateLimits } from "../db/schema";
import type { Db } from "../db/types";

const MINUTE = 60_000;

// max : nombre de requêtes permises par fenêtre et par appareil
export const REGLES = {
  connexion: { max: 20, fenetreMs: 15 * MINUTE }, // connexion admin (en plus du blocage par adresse e-mail)
  lien: { max: 5, fenetreMs: 15 * MINUTE }, // demandes de lien de connexion (chaque demande envoie un e-mail)
  code: { max: 30, fenetreMs: 10 * MINUTE }, // codes de questionnaire refusés (un même réseau d'entreprise est partagé)
  inscription: { max: 10, fenetreMs: 60 * MINUTE }, // inscriptions et désinscriptions aux ateliers
  avis: { max: 20, fenetreMs: 60 * MINUTE }, // avis sur les ateliers
} as const;

export type Regle = keyof typeof REGLES;

export const CONSERVATION_MS = 24 * 60 * MINUTE;

// Adresse réseau de l'appareil telle que transmise par l'hébergeur (Vercel). En local : « local ».
export function adresseClient(entetes: Headers) {
  const transmise = entetes.get("x-forwarded-for")?.split(",")[0]?.trim() || entetes.get("x-real-ip")?.trim();
  return transmise || "local";
}

function secret() {
  const s = process.env.AUTH_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "production") throw new Error("AUTH_SECRET manquant");
  return "developpement-local";
}

export function cleRequete(regle: Regle, adresse: string, maintenant = new Date()) {
  const jour = maintenant.toISOString().slice(0, 10);
  return createHmac("sha256", secret()).update(`${regle}|${jour}|${adresse}`).digest("hex");
}

// Compte une requête et indique si elle reste dans la limite. Une seule instruction SQL : pas de course entre deux requêtes.
export async function compter(db: Db, regle: Regle, adresse: string, maintenant = new Date()) {
  const { max, fenetreMs } = REGLES[regle];
  const debutFenetre = sql`${new Date(maintenant.getTime() - fenetreMs).toISOString()}::timestamptz`;
  const instant = sql`${maintenant.toISOString()}::timestamptz`;
  const [ligne] = await db
    .insert(rateLimits)
    .values({ key: cleRequete(regle, adresse, maintenant), hits: 1, windowStart: maintenant })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        hits: sql`case when ${rateLimits.windowStart} < ${debutFenetre} then 1 else ${rateLimits.hits} + 1 end`,
        windowStart: sql`case when ${rateLimits.windowStart} < ${debutFenetre} then ${instant} else ${rateLimits.windowStart} end`,
      },
    })
    .returning({ hits: rateLimits.hits });
  return ligne.hits <= max;
}

// Vérifie la limite sans compter (pour les règles qui ne comptent que les échecs, comme les codes refusés).
export async function limiteAtteinte(db: Db, regle: Regle, adresse: string, maintenant = new Date()) {
  const { max, fenetreMs } = REGLES[regle];
  const [ligne] = await db
    .select({ hits: rateLimits.hits, windowStart: rateLimits.windowStart })
    .from(rateLimits)
    .where(eq(rateLimits.key, cleRequete(regle, adresse, maintenant)));
  return !!ligne && ligne.windowStart.getTime() >= maintenant.getTime() - fenetreMs && ligne.hits >= max;
}

// Tâche de nuit : suppression des compteurs de plus de 24 heures.
export async function purgerCompteurs(db: Db, maintenant = new Date()) {
  const supprimes = await db
    .delete(rateLimits)
    .where(lt(rateLimits.windowStart, new Date(maintenant.getTime() - CONSERVATION_MS)))
    .returning({ key: rateLimits.key });
  return supprimes.length;
}
