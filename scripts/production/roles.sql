-- Rôles de la base de production (OVH), à exécuter une fois après la création de la base et la première migration,
-- connecté avec l'utilisateur propriétaire (celui de DATABASE_MIGRATION_URL). Voir docs/lancement/BASE-DE-DONNEES.md.
--
-- inneros_app : utilisé par l'application (DATABASE_URL). Il lit et écrit les données, mais ne peut ni créer,
-- ni modifier, ni supprimer une table : une faille dans l'application ne peut pas détruire la structure de la base.
-- Le mot de passe est choisi dans l'espace client OVH (création de l'utilisateur), jamais dans ce fichier.
-- Sur OVH, créer d'abord l'utilisateur « inneros_app » dans l'espace client (onglet Utilisateurs), puis lancer ce script.

GRANT USAGE ON SCHEMA public TO inneros_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO inneros_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO inneros_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO inneros_app;

-- Tables créées par les prochaines migrations : mêmes droits automatiquement
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO inneros_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO inneros_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO inneros_app;

-- Nettoyage des anciennes versions des réponses à la clôture d'une campagne (VACUUM, lib/confidentialite/anonymat.ts).
-- Droit MAINTAIN : PostgreSQL 17 ou plus récent. Sur une version plus ancienne, supprimer ces lignes :
-- le nettoyage est alors laissé à l'autovacuum de PostgreSQL.
GRANT MAINTAIN ON TABLE responses, answers, tokens TO inneros_app;

-- L'application n'a pas besoin de l'historique des migrations
REVOKE ALL ON TABLE drizzle.__drizzle_migrations FROM inneros_app;
