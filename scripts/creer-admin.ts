// Création d'un compte administrateur IMA, avec double authentification obligatoire.
// À lancer dans votre propre terminal : npm run admin:create
// (arrêter d'abord le serveur de développement : PGlite n'accepte qu'un programme à la fois)
import { rmSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { loadEnvConfig } from "@next/env";
import { eq } from "drizzle-orm";
import QRCode from "qrcode";
import { z } from "zod";
import { journaliser } from "../lib/audit";
import { normaliserEmail } from "../lib/auth/limite";
import { hacherMotDePasse, LONGUEUR_MINIMALE_MOT_DE_PASSE } from "../lib/auth/password";
import { chiffrerSecret, nouveauSecretTotp, uriTotp, verifierCodeTotp } from "../lib/auth/totp";
import { getDb } from "../lib/db/client";
import { users } from "../lib/db/schema";

loadEnvConfig(process.cwd());

const FICHIER_QR = ".data/qr-code-a-scanner.png";

async function demander(question: string) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const reponse = await rl.question(question);
  rl.close();
  return reponse.trim();
}

// Saisie masquée : chaque caractère s'affiche comme une étoile
function demanderMasque(question: string): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(question);
    const entree = process.stdin;
    entree.setRawMode(true);
    entree.resume();
    entree.setEncoding("utf8");
    let saisie = "";
    const lire = (morceau: string) => {
      for (const c of morceau) {
        if (c === "\r" || c === "\n") {
          entree.setRawMode(false);
          entree.pause();
          entree.off("data", lire);
          process.stdout.write("\n");
          resolve(saisie);
          return;
        }
        if (c === "\u0003") process.exit(1); // Ctrl+C
        if (c === "\u007f" || c === "\b") {
          if (saisie) {
            saisie = saisie.slice(0, -1);
            process.stdout.write("\b \b");
          }
          continue;
        }
        saisie += c;
        process.stdout.write("*");
      }
    };
    entree.on("data", lire);
  });
}

async function principal() {
  if (!process.env.TOTP_ENCRYPTION_KEY) {
    console.error("TOTP_ENCRYPTION_KEY est absente de .env.local. Arrêt.");
    process.exit(1);
  }
  const db = getDb();

  console.log("\n=== Création d'un compte administrateur InnerOS ===\n");
  const nom = await demander("Votre nom (affiché dans l'application) : ");
  if (!nom) throw new Error("Le nom est obligatoire.");

  const email = normaliserEmail(await demander("Votre adresse e-mail : "));
  if (!z.string().email().safeParse(email).success) throw new Error("Adresse e-mail invalide.");
  const [existant] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (existant) throw new Error("Un compte existe déjà avec cette adresse.");

  let motDePasse = "";
  for (;;) {
    motDePasse = await demanderMasque(
      `Mot de passe (au moins ${LONGUEUR_MINIMALE_MOT_DE_PASSE} caractères) : `,
    );
    if (motDePasse.length < LONGUEUR_MINIMALE_MOT_DE_PASSE) {
      console.log(`Trop court : au moins ${LONGUEUR_MINIMALE_MOT_DE_PASSE} caractères.`);
      continue;
    }
    if ((await demanderMasque("Confirmez le mot de passe : ")) !== motDePasse) {
      console.log("Les deux saisies sont différentes. Recommencez.");
      continue;
    }
    break;
  }

  const secret = nouveauSecretTotp();
  const uri = uriTotp(secret, email);
  console.log("\nScannez ce QR code avec votre application d'authentification :\n");
  console.log(await QRCode.toString(uri, { type: "terminal", small: true }));
  writeFileSync(FICHIER_QR, await QRCode.toBuffer(uri, { width: 320, margin: 2 }));
  console.log(`Si le QR code s'affiche mal, ouvrez l'image : ${FICHIER_QR}`);
  console.log(`Ou saisissez cette clé à la main dans l'application : ${secret}\n`);

  let pas: number | null = null;
  try {
    for (let essai = 1; essai <= 3 && pas === null; essai++) {
      const code = await demander("Code à 6 chiffres affiché par l'application : ");
      pas = await verifierCodeTotp(secret, code, null);
      if (pas === null) console.log("Code incorrect. Attendez le code suivant et réessayez.");
    }
  } finally {
    rmSync(FICHIER_QR, { force: true }); // l'image contient le secret : elle ne doit pas rester sur le disque
  }
  if (pas === null) throw new Error("Trois codes incorrects : compte non créé. Relancez la commande.");

  const [admin] = await db
    .insert(users)
    .values({
      email,
      name: nom,
      role: "admin",
      passwordHash: await hacherMotDePasse(motDePasse),
      totpSecretEncrypted: chiffrerSecret(secret),
      totpEnabled: true,
      totpLastStep: pas,
    })
    .returning({ id: users.id });
  await journaliser(db, { actorUserId: admin.id, action: "admin_created" });

  console.log(`\nCompte créé pour ${email}. Vous pouvez vous connecter sur /fr/admin/connexion.\n`);
}

principal()
  .then(() => process.exit(0))
  .catch((e: Error) => {
    console.error(`\nErreur : ${e.message}\n`);
    process.exit(1);
  });
