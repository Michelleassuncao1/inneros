// Jetons à usage unique (F5). Règle 2 : seule une empreinte est stockée ; les codes n'existent
// qu'au moment de leur création et ne peuvent jamais être réaffichés. Aucun lien avec une réponse.
import { createHmac, randomInt } from "node:crypto";
import { and, count, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { journaliser } from "../audit";
import { campaigns, tokens } from "../db/schema";
import type { Db } from "../db/types";
import type { Resultat } from "./entreprises";

// Sans caractères ambigus (0/O, 1/I/L) : facile à recopier depuis une carte imprimée
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const LONGUEUR = 10; // 31^10 ≈ 8 × 10^14 combinaisons
export const JETONS_MAXIMUM_PAR_LOT = 5000;

// Format affiché : K7QF-3MZP-X2
export function formaterCode(brut: string) {
  return `${brut.slice(0, 4)}-${brut.slice(4, 8)}-${brut.slice(8)}`;
}

export function normaliserCode(saisi: string) {
  return saisi.toUpperCase().replace(/[^0-9A-Z]/g, "");
}

function nouveauCode() {
  return Array.from({ length: LONGUEUR }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
}

// Empreinte avec clé secrète : même avec une copie de la base, impossible de retrouver les codes
export function empreinteJeton(code: string) {
  const cle = process.env.AUTH_SECRET;
  if (!cle) throw new Error("AUTH_SECRET manquante");
  return createHmac("sha256", cle).update(`jeton:${normaliserCode(code)}`).digest("hex");
}

export async function genererJetons(
  db: Db,
  adminId: string,
  campaignId: string,
  nombreSaisi: unknown,
): Promise<Resultat<{ codes: string[] }>> {
  const nombre = z.coerce.number().int().min(1).max(JETONS_MAXIMUM_PAR_LOT).safeParse(nombreSaisi);
  if (!nombre.success) return { ok: false, erreur: "nombreJetonsInvalide" };
  const [campagne] = await db.select().from(campaigns).where(eq(campaigns.id, campaignId));
  if (!campagne) return { ok: false, erreur: "introuvable" };
  if (campagne.status === "closed") return { ok: false, erreur: "campagneCloturee" };

  const codes = new Set<string>();
  while (codes.size < nombre.data) codes.add(nouveauCode());
  const liste = [...codes];

  await db.transaction(async (tx) => {
    for (let i = 0; i < liste.length; i += 500) {
      await tx.insert(tokens).values(
        liste.slice(i, i + 500).map((code) => ({
          campaignId,
          tokenHash: empreinteJeton(code),
          expiresOn: campagne.endDate,
        })),
      );
    }
  });
  await journaliser(db, {
    actorUserId: adminId,
    action: "tokens_generated",
    targetType: "campaign",
    targetId: campaignId,
    details: { nombre: liste.length },
  });
  return { ok: true, valeur: { codes: liste.map(formaterCode) } };
}

// Annule tous les jetons non utilisés (lot perdu, fichier égaré…)
export async function revoquerJetonsNonUtilises(
  db: Db,
  adminId: string,
  campaignId: string,
): Promise<Resultat<{ nombre: number }>> {
  const revoques = await db
    .update(tokens)
    .set({ status: "revoked" })
    .where(and(eq(tokens.campaignId, campaignId), eq(tokens.status, "active")))
    .returning({ id: tokens.id });
  await journaliser(db, {
    actorUserId: adminId,
    action: "tokens_revoked",
    targetType: "campaign",
    targetId: campaignId,
    details: { nombre: revoques.length },
  });
  return { ok: true, valeur: { nombre: revoques.length } };
}

export async function compterJetons(db: Db, campaignId: string) {
  const lignes = await db
    .select({ status: tokens.status, n: count() })
    .from(tokens)
    .where(eq(tokens.campaignId, campaignId))
    .groupBy(tokens.status);
  const par = Object.fromEntries(lignes.map((l) => [l.status, l.n]));
  return { actifs: par.active ?? 0, utilises: par.consumed ?? 0, revoques: par.revoked ?? 0 };
}

// Pour le PDF : on n'imprime que des codes réellement actifs de cette campagne
export async function codesValides(db: Db, campaignId: string, codes: string[]) {
  if (!codes.length || codes.length > JETONS_MAXIMUM_PAR_LOT) return false;
  const empreintes = codes.map(empreinteJeton);
  const [r] = await db
    .select({ n: count() })
    .from(tokens)
    .where(
      and(eq(tokens.campaignId, campaignId), eq(tokens.status, "active"), inArray(tokens.tokenHash, empreintes)),
    );
  return r.n === new Set(empreintes).size;
}
