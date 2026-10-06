// Tests des connexions (F1, F2) : mot de passe, code TOTP, limitation, lien magique.
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { auditLog, loginLinks, organizations, users } from "../db/schema";
import { creerBaseDeTest } from "../db/test-db";
import type { Db } from "../db/types";
import { verifierConnexionAdmin } from "./connexion-admin";
import { consommerLienMagique, demanderLienMagique } from "./lien-magique";
import { hacherMotDePasse, verifierMotDePasse } from "./password";
import { chiffrerSecret, codeTotp, dechiffrerSecret, nouveauSecretTotp } from "./totp";

const MOT_DE_PASSE = "un mot de passe solide";
const T0 = new Date("2026-10-06T09:00:00Z");
const minutes = (n: number) => new Date(T0.getTime() + n * 60 * 1000);

let db: Db;
let secret: string;
let empreinte: string;

beforeAll(async () => {
  process.env.TOTP_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  empreinte = await hacherMotDePasse(MOT_DE_PASSE);
});

beforeEach(async () => {
  ({ db } = await creerBaseDeTest());
  secret = nouveauSecretTotp();
  await db.insert(users).values({
    email: "admin@ima.test",
    name: "Praticienne IMA",
    role: "admin",
    passwordHash: empreinte,
    totpSecretEncrypted: chiffrerSecret(secret),
    totpEnabled: true,
  });
});

const connexion = async (saisie: Partial<{ email: string; password: string; code: string }>, quand = T0) =>
  verifierConnexionAdmin(
    db,
    { email: "admin@ima.test", password: MOT_DE_PASSE, code: await codeTotp(secret, quand), ...saisie },
    quand,
  );

describe("Mot de passe et secret TOTP", () => {
  it("le mot de passe n'est jamais stocké en clair et se vérifie", async () => {
    expect(empreinte).not.toContain(MOT_DE_PASSE);
    expect(await verifierMotDePasse(MOT_DE_PASSE, empreinte)).toBe(true);
    expect(await verifierMotDePasse("mauvais mot de passe", empreinte)).toBe(false);
  });

  it("le secret TOTP est chiffré et se déchiffre", () => {
    const chiffre = chiffrerSecret(secret);
    expect(chiffre).not.toContain(secret);
    expect(dechiffrerSecret(chiffre)).toBe(secret);
  });
});

describe("Connexion administrateur (F1)", () => {
  it("accepte e-mail, mot de passe et code corrects", async () => {
    const r = await connexion({});
    expect(r.ok).toBe(true);
  });

  it("accepte l'adresse avec majuscules ou espaces", async () => {
    expect((await connexion({ email: "  Admin@IMA.test " })).ok).toBe(true);
  });

  it("refuse un mauvais mot de passe", async () => {
    expect(await connexion({ password: "mauvais mot de passe" })).toEqual({ ok: false, raison: "invalide" });
  });

  it("refuse un mauvais code", async () => {
    const bon = await codeTotp(secret, T0);
    const mauvais = bon === "000000" ? "111111" : "000000";
    expect((await connexion({ code: mauvais })).ok).toBe(false);
  });

  it("refuse un code d'il y a 2 minutes", async () => {
    const ancien = await codeTotp(secret, minutes(-2));
    expect((await connexion({ code: ancien })).ok).toBe(false);
  });

  it("refuse de réutiliser un code déjà accepté", async () => {
    const code = await codeTotp(secret, T0);
    expect((await connexion({ code })).ok).toBe(true);
    expect((await connexion({ code }, new Date(T0.getTime() + 5000))).ok).toBe(false);
  });

  it("refuse un compte sans double authentification activée", async () => {
    await db.update(users).set({ totpEnabled: false });
    expect((await connexion({})).ok).toBe(false);
  });

  it("refuse un compte désactivé", async () => {
    await db.update(users).set({ disabledAt: T0 });
    expect((await connexion({})).ok).toBe(false);
  });

  it("bloque l'adresse après 5 erreurs, même avec ensuite les bons identifiants", async () => {
    for (let i = 0; i < 5; i++) {
      await connexion({ password: "mauvais mot de passe" }, minutes(i));
    }
    expect(await connexion({}, minutes(6))).toEqual({ ok: false, raison: "bloque" });
    // 15 minutes après le blocage, l'accès redevient possible
    expect((await connexion({}, minutes(20))).ok).toBe(true);
  });

  it("une adresse inconnue est traitée comme une erreur ordinaire", async () => {
    expect(await connexion({ email: "inconnu@ima.test" })).toEqual({ ok: false, raison: "invalide" });
  });

  it("chaque tentative est inscrite au journal d'audit", async () => {
    await connexion({ password: "mauvais mot de passe" });
    await connexion({}, minutes(1));
    const actions = (await db.select().from(auditLog)).map((l) => l.action);
    expect(actions).toEqual(["admin_login_failed", "admin_login"]);
  });
});

describe("Lien magique des référents (F2)", () => {
  let jetonEnvoye: string | null;
  const envoyer = async (_d: { email: string; name: string }, jeton: string) => {
    jetonEnvoye = jeton;
  };

  beforeEach(async () => {
    jetonEnvoye = null;
    const [org] = await db
      .insert(organizations)
      .values({
        internalCode: "ORG-TEST",
        name: "Entreprise de test",
        country: "BE",
        locale: "fr",
        sector: "Services",
        sizeBand: "50-249",
      })
      .returning();
    await db.insert(users).values({
      email: "rh@client.test",
      name: "Référente RH",
      role: "referent",
      organizationId: org.id,
    });
  });

  it("un lien n'est envoyé qu'à un référent enregistré", async () => {
    await demanderLienMagique(db, "inconnu@client.test", envoyer, T0);
    expect(jetonEnvoye).toBeNull();
    await demanderLienMagique(db, "admin@ima.test", envoyer, T0);
    expect(jetonEnvoye).toBeNull();
    await demanderLienMagique(db, "RH@client.test", envoyer, T0);
    expect(jetonEnvoye).not.toBeNull();
  });

  it("seule l'empreinte du lien est stockée", async () => {
    await demanderLienMagique(db, "rh@client.test", envoyer, T0);
    const [lien] = await db.select().from(loginLinks);
    expect(lien.tokenHash).not.toBe(jetonEnvoye);
  });

  it("le lien ne sert qu'une fois", async () => {
    await demanderLienMagique(db, "rh@client.test", envoyer, T0);
    expect(await consommerLienMagique(db, jetonEnvoye!, minutes(1))).toMatchObject({ role: "referent" });
    expect(await consommerLienMagique(db, jetonEnvoye!, minutes(2))).toBeNull();
  });

  it("le lien expire après 15 minutes", async () => {
    await demanderLienMagique(db, "rh@client.test", envoyer, T0);
    expect(await consommerLienMagique(db, jetonEnvoye!, minutes(16))).toBeNull();
  });

  it("le lien d'un référent désactivé est refusé", async () => {
    await demanderLienMagique(db, "rh@client.test", envoyer, T0);
    await db.update(users).set({ disabledAt: T0 }).where(eq(users.email, "rh@client.test"));
    expect(await consommerLienMagique(db, jetonEnvoye!, minutes(1))).toBeNull();
  });

  it("un lien inventé est refusé", async () => {
    expect(await consommerLienMagique(db, "lien-invente", T0)).toBeNull();
  });

  it("au-delà de 5 demandes en 15 minutes, plus aucun lien n'est envoyé", async () => {
    for (let i = 0; i < 5; i++) await demanderLienMagique(db, "rh@client.test", envoyer, T0);
    jetonEnvoye = null;
    await demanderLienMagique(db, "rh@client.test", envoyer, minutes(1));
    expect(jetonEnvoye).toBeNull();
  });
});
