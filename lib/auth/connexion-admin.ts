// Connexion administrateur (F1) : e-mail + mot de passe + code TOTP, tous obligatoires.
import { and, eq } from "drizzle-orm";
import { users } from "../db/schema";
import type { Db } from "../db/types";
import { journaliser } from "../audit";
import { cleLimite, effacerEchecs, enregistrerEchec, estBloque, normaliserEmail } from "./limite";
import { obtenirEmpreinteFactice, verifierMotDePasse } from "./password";
import { dechiffrerSecret, verifierCodeTotp } from "./totp";

export type ResultatConnexion =
  | { ok: true; user: { id: string; name: string; email: string; role: "admin" } }
  | { ok: false; raison: "bloque" | "invalide" };

export async function verifierConnexionAdmin(
  db: Db,
  saisie: { email: string; password: string; code: string },
  maintenant = new Date(),
): Promise<ResultatConnexion> {
  const email = normaliserEmail(saisie.email);
  const cle = cleLimite("admin", email);

  if (await estBloque(db, cle, maintenant)) {
    await journaliser(db, { action: "admin_login_blocked" });
    return { ok: false, raison: "bloque" };
  }

  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.email, email), eq(users.role, "admin")));

  // Le mot de passe est toujours vérifié, même si le compte n'existe pas (temps de réponse constant)
  const motDePasseOk = await verifierMotDePasse(
    saisie.password,
    user?.passwordHash ?? (await obtenirEmpreinteFactice()),
  );

  let pas: number | null = null;
  if (user && motDePasseOk && !user.disabledAt && user.totpEnabled && user.totpSecretEncrypted) {
    pas = await verifierCodeTotp(
      dechiffrerSecret(user.totpSecretEncrypted),
      saisie.code.trim(),
      user.totpLastStep,
      maintenant,
    );
  }

  if (!user || pas === null) {
    await enregistrerEchec(db, cle, maintenant);
    await journaliser(db, { actorUserId: user?.id, action: "admin_login_failed" });
    return { ok: false, raison: "invalide" };
  }

  await db.update(users).set({ totpLastStep: pas }).where(eq(users.id, user.id));
  await effacerEchecs(db, cle);
  await journaliser(db, { actorUserId: user.id, action: "admin_login" });
  return { ok: true, user: { id: user.id, name: user.name, email: user.email, role: "admin" } };
}
