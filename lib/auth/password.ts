// Mots de passe des administrateurs : empreinte scrypt (outil intégré à Node.js), jamais le mot de passe.
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const N = 2 ** 15;
const R = 8;
const P = 1;
const LONGUEUR = 64;
export const LONGUEUR_MINIMALE_MOT_DE_PASSE = 12;

function deriver(motDePasse: string, sel: Buffer, n: number, r: number, p: number) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(motDePasse, sel, LONGUEUR, { N: n, r, p, maxmem: 128 * n * r * 2 }, (err, cle) =>
      err ? reject(err) : resolve(cle),
    );
  });
}

// Format stocké : scrypt$N$r$p$sel$empreinte (base64)
export async function hacherMotDePasse(motDePasse: string): Promise<string> {
  const sel = randomBytes(16);
  const cle = await deriver(motDePasse, sel, N, R, P);
  return ["scrypt", N, R, P, sel.toString("base64"), cle.toString("base64")].join("$");
}

export async function verifierMotDePasse(motDePasse: string, stocke: string): Promise<boolean> {
  const [algo, n, r, p, sel, empreinte] = stocke.split("$");
  if (algo !== "scrypt" || !sel || !empreinte) return false;
  const attendu = Buffer.from(empreinte, "base64");
  const cle = await deriver(motDePasse, Buffer.from(sel, "base64"), Number(n), Number(r), Number(p));
  return cle.length === attendu.length && timingSafeEqual(cle, attendu);
}

// Empreinte factice : on calcule toujours un scrypt, même pour une adresse inconnue,
// pour que le temps de réponse ne révèle pas si un compte existe.
let empreinteFactice: Promise<string> | undefined;
export function obtenirEmpreinteFactice() {
  empreinteFactice ??= hacherMotDePasse(randomBytes(16).toString("hex"));
  return empreinteFactice;
}
