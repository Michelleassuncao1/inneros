// Copie de sauvegarde chiffrée de la base de production, en plus des sauvegardes automatiques d'OVH.
// Usage (depuis la racine du projet, base de production renseignée dans DATABASE_MIGRATION_URL ou DATABASE_URL) :
//   npm run sauvegarde:cle       → crée la clé de chiffrement dans .env.local (une seule fois ; la copier aussi dans un coffre-fort)
//   npm run sauvegarde           → .sauvegardes/inneros-AAAA-MM-JJ.sauvegarde (chiffrée), garde les 3 plus récentes
//   npm run sauvegarde:restaurer -- <fichier> <adresse de la base de test>
// pg_dump et pg_restore viennent de PG_BIN (dossier bin de PostgreSQL, même version majeure que la base OVH, ou plus récente).
// Format du fichier : « INNEROS1 » | iv (12 octets) | données chiffrées AES-256-GCM | étiquette (16 octets).
import nextEnv from "@next/env";
import { spawn } from "node:child_process";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { certificatAutorite, estUrlPostgres } from "../lib/db/postgres.ts";

nextEnv.loadEnvConfig(process.cwd());

const ENTETE = Buffer.from("INNEROS1");
const DOSSIER = ".sauvegardes";
const A_GARDER = 3; // une copie par mois : environ 3 mois de données déjà supprimées ailleurs (voir AIPD)

function cle() {
  const valeur = process.env.SAUVEGARDE_CLE;
  const octets = valeur ? Buffer.from(valeur, "base64") : Buffer.alloc(0);
  if (octets.length !== 32) throw new Error("SAUVEGARDE_CLE manquante ou invalide : lancer d'abord « npm run sauvegarde:cle ».");
  return octets;
}

export function chiffrer(donnees: Buffer, k: Buffer) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", k, iv);
  return Buffer.concat([ENTETE, iv, c.update(donnees), c.final(), c.getAuthTag()]);
}

export function dechiffrer(fichier: Buffer, k: Buffer) {
  if (!fichier.subarray(0, ENTETE.length).equals(ENTETE)) throw new Error("Ce fichier n'est pas une sauvegarde InnerOS.");
  const iv = fichier.subarray(ENTETE.length, ENTETE.length + 12);
  const d = createDecipheriv("aes-256-gcm", k, iv);
  d.setAuthTag(fichier.subarray(fichier.length - 16));
  try {
    return Buffer.concat([d.update(fichier.subarray(ENTETE.length + 12, fichier.length - 16)), d.final()]);
  } catch {
    throw new Error("Clé incorrecte ou fichier abîmé : la sauvegarde ne peut pas être déchiffrée.");
  }
}

function outil(nom: "pg_dump" | "pg_restore") {
  const bin = process.env.PG_BIN;
  return bin ? path.join(bin, process.platform === "win32" ? `${nom}.exe` : nom) : nom;
}

// Le mot de passe et le certificat passent par l'environnement de pg_dump, jamais par la ligne de commande
function environnementPg(url: string) {
  const env: NodeJS.ProcessEnv = { ...process.env };
  const ca = certificatAutorite();
  if (ca) {
    const fichierCa = path.join(DOSSIER, "ca-ovh.pem");
    writeFileSync(fichierCa, ca);
    env.PGSSLROOTCERT = path.resolve(fichierCa);
    env.PGSSLMODE = "verify-full";
  }
  const adresse = new URL(url);
  if (adresse.password) env.PGPASSWORD = decodeURIComponent(adresse.password);
  adresse.password = "";
  return { env, adresse: adresse.toString() };
}

function lancer(commande: string, args: string[], env: NodeJS.ProcessEnv, entree?: Buffer) {
  return new Promise<Buffer>((resolve, reject) => {
    const p = spawn(commande, args, { env, stdio: ["pipe", "pipe", "inherit"] });
    const morceaux: Buffer[] = [];
    p.stdout.on("data", (m: Buffer) => morceaux.push(m));
    p.on("error", (e) => reject(new Error(`${commande} introuvable : renseigner PG_BIN (${e.message}).`)));
    p.on("close", (code) => (code === 0 ? resolve(Buffer.concat(morceaux)) : reject(new Error(`${commande} a échoué (code ${code}).`))));
    p.stdin.end(entree);
  });
}

async function sauvegarder() {
  const url = process.env.DATABASE_MIGRATION_URL || process.env.DATABASE_URL;
  if (!estUrlPostgres(url)) throw new Error("Aucune base PostgreSQL renseignée (DATABASE_MIGRATION_URL ou DATABASE_URL).");
  const k = cle();
  mkdirSync(DOSSIER, { recursive: true });
  const { env, adresse } = environnementPg(url);
  const vidage = await lancer(outil("pg_dump"), ["--format=custom", "--no-owner", "--no-privileges", adresse], env);
  rmSync(path.join(DOSSIER, "ca-ovh.pem"), { force: true });
  const nom = path.join(DOSSIER, `inneros-${new Date().toISOString().slice(0, 10)}.sauvegarde`);
  writeFileSync(nom, chiffrer(vidage, k));
  // Rotation : les sauvegardes contiennent des données supprimées depuis ; on n'en garde que quelques-unes
  const anciennes = readdirSync(DOSSIER).filter((f) => f.endsWith(".sauvegarde")).sort().reverse().slice(A_GARDER);
  for (const f of anciennes) rmSync(path.join(DOSSIER, f));
  console.log(`Sauvegarde chiffrée : ${nom} (${Math.round(vidage.length / 1024)} Ko avant chiffrement). Anciennes supprimées : ${anciennes.length}.`);
}

async function restaurer(fichier: string, cible: string) {
  if (!estUrlPostgres(cible)) throw new Error("Indiquer l'adresse de la base de test où restaurer.");
  // Garde-fou : jamais par-dessus la base de production
  for (const prod of [process.env.DATABASE_URL, process.env.DATABASE_MIGRATION_URL]) {
    if (prod && new URL(prod).host === new URL(cible).host && new URL(prod).pathname === new URL(cible).pathname) {
      throw new Error("Refusé : la cible est la base de production. Restaurer dans une base de test, ou demander à OVH une restauration.");
    }
  }
  const vidage = dechiffrer(readFileSync(fichier), cle());
  const { env, adresse } = environnementPg(cible);
  await lancer(outil("pg_restore"), ["--no-owner", "--no-privileges", "--clean", "--if-exists", "--dbname", adresse], env, vidage);
  console.log(`Restauration terminée dans la base de test (${new URL(cible).pathname.slice(1)}).`);
}

function creerCle() {
  if (process.env.SAUVEGARDE_CLE) {
    console.log("SAUVEGARDE_CLE existe déjà dans votre environnement : rien n'a été changé.");
    return;
  }
  const fichier = ".env.local";
  const finDeLigne = existsSync(fichier) && !readFileSync(fichier, "utf8").endsWith("\n") ? "\n" : "";
  appendFileSync(fichier, `${finDeLigne}# Clé des sauvegardes chiffrées : à copier aussi dans un coffre-fort (sans elle, les sauvegardes sont illisibles)\nSAUVEGARDE_CLE=${randomBytes(32).toString("base64")}\n`);
  console.log("Clé créée dans .env.local (non affichée). Copiez-la dans votre coffre-fort de mots de passe.");
}

const [action, ...args] = process.argv.slice(2);
if (action === "cle") creerCle();
else if (action === "restaurer") await restaurer(args[0], args[1]);
else if (action === "sauvegarder") await sauvegarder();
