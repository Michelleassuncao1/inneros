// Migrations au déploiement (script « vercel-build ») : seulement pour la production Vercel.
// Les déploiements de prévisualisation ne touchent jamais la base de production.
// Règle : une migration doit rester compatible avec la version précédente de l'application,
// qui continue de servir les visiteurs pendant la construction.
if (process.env.VERCEL_ENV === "production") {
  if (!process.env.DATABASE_MIGRATION_URL && !process.env.DATABASE_URL) {
    console.error("Production : DATABASE_MIGRATION_URL ou DATABASE_URL manquant, construction arrêtée.");
    process.exit(1);
  }
  await import("./migrate.mts");
} else {
  console.log(`Migrations ignorées (environnement : ${process.env.VERCEL_ENV ?? "local"}).`);
}
