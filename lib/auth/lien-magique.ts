// Connexion des référents (F2) : lien à usage unique, valable 15 minutes.
// Seule l'empreinte du lien est stockée.
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { loginLinks, users } from "../db/schema";
import type { Db } from "../db/types";
import { journaliser } from "../audit";
import { cleLimite, enregistrerEchec, estBloque, normaliserEmail } from "./limite";

export const DUREE_LIEN_MS = 15 * 60 * 1000;

function empreinte(jeton: string) {
  return createHash("sha256").update(jeton).digest("hex");
}

export async function creerLienMagique(db: Db, userId: string, maintenant = new Date()) {
  const jeton = randomBytes(32).toString("base64url");
  await db.insert(loginLinks).values({
    tokenHash: empreinte(jeton),
    userId,
    expiresAt: new Date(maintenant.getTime() + DUREE_LIEN_MS),
  });
  return jeton;
}

// Demande d'un lien. Ne révèle jamais si l'adresse existe : la réponse est toujours la même.
// Chaque demande compte dans la limite (5 en 15 minutes par adresse).
export async function demanderLienMagique(
  db: Db,
  emailSaisi: string,
  envoyer: (destinataire: { email: string; name: string }, jeton: string) => Promise<void>,
  maintenant = new Date(),
) {
  const email = normaliserEmail(emailSaisi);
  const cle = cleLimite("lien", email);
  if (await estBloque(db, cle, maintenant)) return;
  await enregistrerEchec(db, cle, maintenant);

  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.email, email), eq(users.role, "referent")));
  if (!user || user.disabledAt) return;

  const jeton = await creerLienMagique(db, user.id, maintenant);
  await envoyer({ email: user.email, name: user.name }, jeton);
  await journaliser(db, { actorUserId: user.id, action: "referent_link_sent" });
}

// Utilisation d'un lien : il est marqué « utilisé » dans la même opération (usage unique garanti).
export async function consommerLienMagique(db: Db, jeton: string, maintenant = new Date()) {
  const [lien] = await db
    .update(loginLinks)
    .set({ usedAt: maintenant })
    .where(
      and(
        eq(loginLinks.tokenHash, empreinte(jeton)),
        isNull(loginLinks.usedAt),
        gt(loginLinks.expiresAt, maintenant),
      ),
    )
    .returning({ userId: loginLinks.userId });
  if (!lien) return null;

  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, lien.userId), eq(users.role, "referent")));
  if (!user || user.disabledAt) return null;

  await journaliser(db, { actorUserId: user.id, action: "referent_login" });
  return { id: user.id, name: user.name, email: user.email, role: "referent" as const };
}
