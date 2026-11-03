// Connexion à PostgreSQL (production OVH), partagée par l'application, les migrations et les sauvegardes.
// Sans dépendance à Next.js : utilisable depuis les scripts lancés avec node.
import { Pool, type PoolConfig } from "pg";

export function estUrlPostgres(url: string | undefined): url is string {
  return !!url && /^postgres(ql)?:\/\//.test(url);
}

// Certificat de l'autorité d'OVH (fichier .pem téléchargé dans l'espace client), en clair ou encodé en base64.
// Avec lui, le certificat du serveur est vérifié (protection contre l'interception), sinon TLS sans vérification de l'émetteur.
export function certificatAutorite(valeur = process.env.DATABASE_CA_CERT) {
  if (!valeur?.trim()) return undefined;
  const texte = valeur.includes("BEGIN CERTIFICATE") ? valeur : Buffer.from(valeur, "base64").toString("utf8");
  if (!texte.includes("BEGIN CERTIFICATE")) throw new Error("DATABASE_CA_CERT n'est pas un certificat PEM.");
  return texte.replaceAll("\\n", "\n");
}

export function configurationPostgres(
  url: string,
  options: { production?: boolean; ca?: string; max?: number } = {},
): PoolConfig {
  const { production = process.env.NODE_ENV === "production", ca = certificatAutorite(), max = 5 } = options;
  if (production && !/[?&]sslmode=(require|verify-ca|verify-full)\b/.test(url)) {
    throw new Error("DATABASE_URL doit imposer une connexion chiffrée (sslmode=require ou verify-full).");
  }
  const base: PoolConfig = {
    // Fonctions serverless : peu de connexions par instance, fermées vite, pour rester sous la limite de l'offre OVH
    max,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  };
  if (!ca) return { ...base, connectionString: url };
  // Le paramètre sslmode de l'adresse remplacerait l'objet ssl : on le retire et on impose la vérification
  const adresse = new URL(url);
  adresse.searchParams.delete("sslmode");
  return { ...base, connectionString: adresse.toString(), ssl: { ca, rejectUnauthorized: true } };
}

export function poolPostgres(url: string, options?: Parameters<typeof configurationPostgres>[1]) {
  return new Pool(configurationPostgres(url, options));
}
