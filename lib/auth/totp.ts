// Double authentification (TOTP) : codes à 6 chiffres renouvelés toutes les 30 secondes.
// Le secret est chiffré (AES-256-GCM) avec TOTP_ENCRYPTION_KEY avant d'être stocké.
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { generate, generateSecret, generateURI, verify } from "otplib";

export const EMETTEUR_TOTP = "InnerOS (IMA)";
// Tolérance d'horloge : le code précédent reste accepté 30 secondes, pas plus
const TOLERANCE_SECONDES = 30;

export function nouveauSecretTotp() {
  return generateSecret();
}

export function uriTotp(secret: string, email: string) {
  return generateURI({ issuer: EMETTEUR_TOTP, label: email, secret });
}

export async function codeTotp(secret: string, maintenant = new Date()): Promise<string> {
  return generate({ secret, epoch: Math.floor(maintenant.getTime() / 1000) });
}

// Renvoie le pas de temps du code accepté, ou null si le code est refusé.
// `dernierPas` empêche de réutiliser un code déjà accepté.
export async function verifierCodeTotp(
  secret: string,
  code: string,
  dernierPas: number | null,
  maintenant = new Date(),
): Promise<number | null> {
  if (!/^\d{6}$/.test(code)) return null;
  const resultat = await verify({
    secret,
    token: code,
    epoch: Math.floor(maintenant.getTime() / 1000),
    epochTolerance: [TOLERANCE_SECONDES, 0],
    ...(dernierPas !== null ? { afterTimeStep: dernierPas } : {}),
  });
  return resultat.valid && "timeStep" in resultat ? resultat.timeStep : null;
}

function cleChiffrement() {
  const cle = Buffer.from(process.env.TOTP_ENCRYPTION_KEY ?? "", "base64");
  if (cle.length !== 32) {
    throw new Error("TOTP_ENCRYPTION_KEY manquante ou invalide (32 octets en base64 attendus)");
  }
  return cle;
}

// Format stocké : iv.tag.texte chiffré (base64)
export function chiffrerSecret(secret: string) {
  const iv = randomBytes(12);
  const chiffreur = createCipheriv("aes-256-gcm", cleChiffrement(), iv);
  const chiffre = Buffer.concat([chiffreur.update(secret, "utf8"), chiffreur.final()]);
  return [iv, chiffreur.getAuthTag(), chiffre].map((b) => b.toString("base64")).join(".");
}

export function dechiffrerSecret(stocke: string) {
  const [iv, tag, chiffre] = stocke.split(".").map((p) => Buffer.from(p, "base64"));
  const dechiffreur = createDecipheriv("aes-256-gcm", cleChiffrement(), iv);
  dechiffreur.setAuthTag(tag);
  return Buffer.concat([dechiffreur.update(chiffre), dechiffreur.final()]).toString("utf8");
}
