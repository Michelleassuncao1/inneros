// Tests de la configuration PostgreSQL de production et du chiffrement des sauvegardes (étape 10).
import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { chiffrer, dechiffrer } from "../../scripts/sauvegarde.mts";
import { certificatAutorite, configurationPostgres } from "./postgres";

const PEM = "-----BEGIN CERTIFICATE-----\nMIIBexemple\n-----END CERTIFICATE-----\n";
const URL_OVH = "postgres://inneros_app:secret@postgresql-xyz.database.cloud.ovh.net:20184/inneros?sslmode=require";

describe("configuration PostgreSQL de production", () => {
  it("refuse une connexion non chiffrée en production", () => {
    expect(() => configurationPostgres("postgres://u:p@hote/db", { production: true })).toThrow(/sslmode/);
    expect(() => configurationPostgres(URL_OVH, { production: true })).not.toThrow();
  });

  it("avec le certificat d'OVH, vérifie le serveur et retire sslmode de l'adresse", () => {
    const c = configurationPostgres(URL_OVH, { production: true, ca: PEM });
    expect(c.ssl).toEqual({ ca: PEM, rejectUnauthorized: true });
    expect(c.connectionString).not.toContain("sslmode");
    expect(c.max).toBe(5);
  });

  it("accepte le certificat en clair ou en base64", () => {
    expect(certificatAutorite(PEM)).toBe(PEM);
    expect(certificatAutorite(Buffer.from(PEM).toString("base64"))).toBe(PEM);
    expect(certificatAutorite("")).toBeUndefined();
    expect(() => certificatAutorite("n'importe quoi")).toThrow(/PEM/);
  });
});

describe("sauvegardes chiffrées", () => {
  it("chiffre, déchiffre, et refuse une mauvaise clé ou un fichier modifié", () => {
    const cle = randomBytes(32);
    const donnees = Buffer.from("Entreprise essai — données de test");
    const fichier = chiffrer(donnees, cle);
    expect(fichier.includes(donnees)).toBe(false);
    expect(dechiffrer(fichier, cle).equals(donnees)).toBe(true);
    expect(() => dechiffrer(fichier, randomBytes(32))).toThrow(/Clé incorrecte/);
    const abime = Buffer.from(fichier);
    abime[20] ^= 1;
    expect(() => dechiffrer(abime, cle)).toThrow(/Clé incorrecte/);
  });
});
