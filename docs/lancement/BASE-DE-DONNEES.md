# Base de données de production et sauvegardes

*Guide pas à pas pour Michelle (étape 10, 03/11/2026). À faire au lancement, quand le compte OVHcloud est prêt. Les informations sur OVH ont été vérifiées le 03/11/2026 sur le site et la documentation d'OVHcloud : à revérifier au moment de la commande.*

## En résumé

| Quoi | Choix proposé |
| --- | --- |
| Service | OVHcloud › Public Cloud › Databases › **PostgreSQL** (base gérée par OVH) |
| Région | Union européenne, en France : Gravelines (GRA) ou Strasbourg (SBG) |
| Version | **PostgreSQL 17 ou plus récent** (nécessaire pour le nettoyage des réponses à la clôture, voir l'étape 5) |
| Offre | **Production** pour les vrais clients : 2 serveurs (si l'un tombe, l'autre prend le relais), sauvegardes gardées 14 jours. **Discovery** (1 serveur, sauvegardes 48 heures) seulement pour les essais avec l'entreprise pilote |
| Sauvegardes OVH | Automatiques et chiffrées, restauration à la minute près dans la limite des 14 jours ; choisir deux régions de sauvegarde |
| Copie de secours d'IMA | Une fois par mois, une copie chiffrée sur votre PC (`npm run sauvegarde`), les 3 dernières sont gardées |
| Comptes de la base | Deux utilisateurs : le **propriétaire** (migrations et sauvegardes) et **inneros_app** (l'application, sans droit de modifier la structure) |

## 1. Créer la base chez OVHcloud

1. Espace client OVHcloud › **Public Cloud** › votre projet › **Databases** › **Créer un service**.
2. Moteur **PostgreSQL**, version 17 ou plus récente.
3. Offre **Production**, région **GRA** ou **SBG**.
4. Réseau : **public** (Vercel se connecte par internet). Dans « IP autorisées », OVH demande les adresses qui peuvent se connecter. Vercel n'a pas d'adresse fixe dans son offre de base : il faudra soit autoriser toutes les adresses (`0.0.0.0/0`, protégé par le mot de passe et le chiffrement), soit utiliser une adresse fixe chez Vercel si elle est disponible dans votre offre. **À VÉRIFIER avec Claude au moment de la commande.**
5. Sauvegardes : garder la sauvegarde dans la région de la base et **ajouter une deuxième région européenne**.

## 2. Créer les utilisateurs et une base

Dans le service créé, onglet **Utilisateurs** :
- l'utilisateur administrateur créé par OVH (souvent `avnadmin`) sera le **propriétaire** des tables : il sert uniquement aux migrations et aux sauvegardes ;
- créer un deuxième utilisateur **`inneros_app`** : c'est celui de l'application.

Onglet **Bases de données** : créer une base `inneros`.

Onglet **Informations générales** : télécharger le **certificat de l'autorité** (fichier `.pem`). Il permet à l'application de vérifier qu'elle parle bien au serveur d'OVH.

Les mots de passe ne s'écrivent jamais dans la conversation avec Claude ni dans un fichier du projet : seulement dans Vercel (étape 3) et dans votre coffre-fort de mots de passe.

## 3. Renseigner les variables chez Vercel

Projet Vercel › **Settings** › **Environment Variables**, en cochant **uniquement « Production »** :

| Variable | Valeur |
| --- | --- |
| `DATABASE_URL` | `postgres://inneros_app:<mot de passe>@<hôte OVH>:<port>/inneros?sslmode=require` |
| `DATABASE_MIGRATION_URL` | la même adresse avec l'utilisateur propriétaire et son mot de passe |
| `DATABASE_CA_CERT` | le contenu du fichier `.pem` (copier-coller tout le texte) |

Les déploiements de **prévisualisation** (« Preview ») n'ont pas ces variables : ils ne peuvent jamais toucher la base des clients. Sans base, ils affichent une erreur ; c'est voulu. Si un jour une prévisualisation complète est utile, créer une petite base « Discovery » séparée.

## 4. Premier déploiement

À chaque déploiement en production, Vercel applique automatiquement les migrations (script `vercel-build`), puis construit l'application. Si la base ne répond pas, le déploiement s'arrête et l'ancienne version reste en ligne.

## 5. Donner ses droits à l'application (une seule fois)

Après le premier déploiement, Claude lance le fichier `scripts/production/roles.sql` avec l'utilisateur propriétaire. L'utilisateur `inneros_app` peut alors lire et écrire les données, mais pas supprimer ou modifier une table. Testé le 03/11/2026 sur PostgreSQL 16 : suppression de table, création de table, modification de table et lecture de l'historique des migrations refusées pour `inneros_app`.

Le droit de nettoyage (`MAINTAIN`) n'existe qu'à partir de PostgreSQL 17 : c'est pourquoi la version 17 ou plus récente est demandée.

Ensuite : créer votre compte administrateur sur la base de production (`npm run admin:create`, avec Claude), puis charger les questionnaires.

## 6. Sauvegardes

### Automatiques (OVH)
Rien à faire : OVH sauvegarde en continu. En cas de problème (erreur de manipulation, données effacées par erreur), OVH peut restaurer la base **à une minute précise des 14 derniers jours**, dans un nouveau service : espace client › votre base › **Sauvegardes** › **Restaurer**.

### Copie mensuelle d'IMA (sécurité supplémentaire, hors d'OVH)
Elle protège contre un problème du compte OVH lui-même (compte bloqué, erreur de facturation, incident majeur).

Une seule fois :
1. Installer les outils PostgreSQL de la **même version que la base OVH** (ou plus récente) et indiquer leur dossier `bin` dans `.env.local` : `PG_BIN=...`. Claude peut vous aider.
2. Mettre l'adresse du propriétaire dans `.env.local` : `DATABASE_MIGRATION_URL=...`, et le certificat : `DATABASE_CA_CERT=...`.
3. Créer la clé de chiffrement :
   ```
   npm run sauvegarde:cle
   ```
   La clé est écrite dans `.env.local` sans être affichée. **Copiez-la dans votre coffre-fort de mots de passe** : sans elle, les copies sont illisibles, même pour vous.

Chaque mois :
```
npm run sauvegarde
```
Le fichier chiffré arrive dans le dossier `.sauvegardes` du projet (jamais envoyé sur GitHub). Les 3 plus récents sont gardés, les plus anciens sont supprimés automatiquement : une sauvegarde contient aussi des données qui ont été supprimées depuis dans l'application (voir l'AIPD).

Recommandation : copier aussi le dernier fichier sur un disque externe ou un espace de stockage européen. Il est chiffré : il peut être rangé sans risque tant que la clé est rangée ailleurs.

### Essai de restauration (tous les 3 mois)
Une sauvegarde n'est utile que si on sait la restaurer. Avec Claude, tous les 3 mois :
```
npm run sauvegarde:restaurer -- .sauvegardes/<fichier> <adresse d'une base de test>
```
Le script refuse de restaurer par-dessus la base de production. Testé le 03/11/2026 : sauvegarde chiffrée (aucun texte lisible dans le fichier), restauration complète dans une base de test, refus de la base de production, refus d'une mauvaise clé.

## 7. Ce que Claude a préparé dans le code

| Élément | Fichier |
| --- | --- |
| Connexion chiffrée obligatoire, vérification du certificat d'OVH, 5 connexions au plus par instance | `lib/db/postgres.ts` |
| Refus de démarrer sur Vercel sans base | `lib/db/client.ts` |
| Migrations automatiques en production seulement | `scripts/migrer-deploiement.mts`, `package.json` (`vercel-build`) |
| Droits de l'utilisateur de l'application | `scripts/production/roles.sql` |
| Copies chiffrées et restauration | `scripts/sauvegarde.mts` |
| Variables à renseigner | `.env.example` |

Toutes les migrations (0000 à 0021) ont été appliquées avec succès sur un vrai PostgreSQL 16 le 03/11/2026, et pas seulement sur la base de développement.

## Sources (consultées le 03/11/2026)
- OVHcloud, *Managed PostgreSQL* (offres Discovery, Production, Advanced et durée des sauvegardes) : https://www.ovhcloud.com/en/public-cloud/postgresql/
- OVHcloud, *Automated Backups for Public Cloud Databases* : https://docs.ovhcloud.com/en/guides/public-cloud/databases/backups
