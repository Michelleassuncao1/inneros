// Vérification des clés secrètes et réglages de production (étape 10), avant chaque mise en ligne
// (scripts/migrer-deploiement.mts, appelé par « vercel-build ») : s'il en manque un, la construction s'arrête
// et l'ancienne version reste en ligne. Les messages donnent le nom de la variable, jamais sa valeur.
type Env = Record<string, string | undefined>;

const octetsBase64 = (v: string | undefined) => (v ? Buffer.from(v, "base64").length : 0);

export function problemesVariables(env: Env = process.env): string[] {
  const p: string[] = [];
  const presente = (nom: string) => !!env[nom]?.trim();

  if ((env.AUTH_SECRET ?? "").length < 32) p.push("AUTH_SECRET manquante ou trop courte (32 caractères au moins)");
  if (octetsBase64(env.TOTP_ENCRYPTION_KEY) !== 32) p.push("TOTP_ENCRYPTION_KEY manquante ou invalide (32 octets en base64)");
  if ((env.CRON_SECRET ?? "").length < 32) p.push("CRON_SECRET manquante ou trop courte (32 caractères au moins)");
  if (!presente("DATABASE_URL")) p.push("DATABASE_URL manquante");
  if (!presente("BREVO_API_KEY")) p.push("BREVO_API_KEY manquante");
  if (!presente("EMAIL_FROM")) p.push("EMAIL_FROM manquante");
  if (!/^https:\/\//.test(env.APP_URL ?? "")) p.push("APP_URL manquante ou sans https://");
  // La clé Anthropic seulement si une fonction d'IA est activée
  const ia = env.AI_DRAFTING_ENABLED !== "false" || env.AI_WRITING_AID_ENABLED === "true";
  if (ia && !presente("ANTHROPIC_API_KEY")) p.push("ANTHROPIC_API_KEY manquante (ou désactiver l'IA : AI_DRAFTING_ENABLED=false)");
  // Réglages de développement interdits en production
  if (presente("PGLITE_DIR")) p.push("PGLITE_DIR ne doit pas exister en production (base de développement)");
  return p;
}
