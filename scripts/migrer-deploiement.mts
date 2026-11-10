// Migrations au déploiement (script « vercel-build ») : seulement pour la production Vercel.
// Les déploiements de prévisualisation ne touchent jamais la base de production.
// Règle : une migration doit rester compatible avec la version précédente de l'application,
// qui continue de servir les visiteurs pendant la construction.
// Avant tout : vérification des clés secrètes (lib/securite/variables.ts) ; s'il en manque, la construction s'arrête.
import { problemesVariables } from "../lib/securite/variables.ts";

if (process.env.VERCEL_ENV === "production") {
  const problemes = problemesVariables(); // dont DATABASE_URL (les migrations utilisent DATABASE_MIGRATION_URL si elle existe)
  if (problemes.length > 0) {
    console.error(`Production : construction arrêtée, l'ancienne version reste en ligne.\n- ${problemes.join("\n- ")}`);
    process.exit(1);
  }
  await import("./migrate.mts");
} else {
  console.log(`Migrations ignorées (environnement : ${process.env.VERCEL_ENV ?? "local"}).`);
}
