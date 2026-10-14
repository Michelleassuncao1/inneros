# InnerOS — Audit d'anonymat, de minimisation et de sécurité

*Audit du 14 octobre 2026, réalisé sur le code réel (et non sur les intentions du cahier des charges).*
*Complète `FLUX-DE-DONNEES.md` (description pour non-développeurs). Destiné à l'AIPD, au DPO et au juriste.*
*Chaque affirmation renvoie au fichier du code concerné ; les mesures marquées « testé » sont vérifiées par un test automatique.*

---

## Conclusion générale

| Donnée | Qualification proposée | Justification |
| --- | --- | --- |
| Réponses brutes **pendant la collecte** | **Pseudonymisées** | Aucun lien direct code ↔ réponse, mais un recoupement technique reste théoriquement possible pour une personne disposant d'un accès direct à la base ou aux journaux de l'hébergeur **et** de la correspondance code ↔ personne (voir constats 1 et 2). |
| Réponses brutes **après la clôture** | **Pseudonymisées (risque faible)** | Les codes sont supprimés et l'ordre d'arrivée est effacé ; il reste un risque d'individualisation par la combinaison groupe + date + profil de réponses, pour quelqu'un qui a des informations extérieures (constat 3). Elles doivent rester traitées comme des données personnelles jusqu'à leur suppression. |
| Résultats de groupes (≥ 10 personnes, protection contre la soustraction) | **Anonymes**, sous réserve du point 3.4 | Aucun résultat sous le seuil, ni directement ni par différence au sein d'une campagne. |
| Rapport validé | **Anonyme** | Construit uniquement à partir des résultats de groupes. |

**Recommandation : ne pas présenter InnerOS comme « anonyme » sans nuance dans les documents juridiques.** La formulation exacte proposée : *« Les réponses sont collectées sans identité et sans lien technique avec le code utilisé ; les données brutes sont traitées comme des données pseudonymisées jusqu'à leur suppression ; seuls des résultats agrégés sur au moins 10 personnes sont produits et communiqués. »*

---

## 1. Anonymisation réelle ou pseudonymisation

### Ce qui relie potentiellement une réponse à une personne

| Lien possible | État | Mesure |
| --- | --- | --- |
| Nom, e-mail, compte du répondant | **Inexistant** : aucun compte, aucun champ d'identité | — |
| Code ↔ réponse (colonne commune) | **Inexistant** : la table `responses` n'a aucune référence aux codes (`lib/db/schema.ts`) | — |
| Code ↔ réponse (numéro de transaction caché `xmin` de PostgreSQL) | **Constat n°1 — corrigé le 14/10/2026.** Le code « utilisé » et la réponse étaient écrits dans la même transaction et portaient le même numéro technique : une simple requête SQL permettait de les relier. | Écriture en deux transactions distinctes (`lib/passation.ts`). **Testé** (`lib/confidentialite/anonymat.test.ts`). |
| Ordre d'arrivée des réponses (numéros de transaction consécutifs, ordre physique) | **Constat n°2 — atténué.** Pendant la collecte, deux transactions successives restent proches ; un opérateur de la base pourrait rapprocher l'ordre de consommation des codes et l'ordre des réponses. | À la clôture, réponses réécrites dans un ordre aléatoire avec de nouveaux identifiants, dans la même transaction que la suppression des codes, puis nettoyage des anciennes versions (`lib/confidentialite/anonymat.ts`). **Testé.** Risque résiduel pendant la collecte : voir ci-dessous. |
| Journaux internes de la base (WAL) et sauvegardes | **Risque résiduel.** Ils conservent l'historique des écritures pendant leur durée de conservation chez l'hébergeur. | À VÉRIFIER chez OVH : durée de rétention des sauvegardes et journaux ; accès restreint. |
| Horodatage | **Minimisé** : seule la date du jour est enregistrée, jamais l'heure (`responses.response_date`). | Décision ouverte : supprimer aussi la date (voir section 6). |
| Adresse IP | **Non enregistrée par InnerOS** (vérifié : aucune lecture d'en-tête IP dans le code). **Risque résiduel** : l'hébergeur de l'application (Vercel) journalise les requêtes (IP, heure, chemin). | À VÉRIFIER : durée de conservation des journaux Vercel ; ne pas activer de « log drain » ; accès à l'équipe Vercel restreint. |
| Identifiant d'appareil, de session, cookie | **Inexistant pour les répondants** : aucun cookie (le cookie de langue a été désactivé le 14/10/2026, `i18n/routing.ts`), aucune empreinte d'appareil, aucun outil de mesure d'audience. | — |
| Code dans l'adresse (QR code) | Le code est après « # » : jamais transmis au serveur ni enregistré dans ses journaux. Il reste dans l'historique du navigateur. | Retiré de l'adresse après l'envoi (14/10/2026). Le code est alors déjà « utilisé ». |
| Réponses en cours sur l'appareil | Stockées dans le navigateur jusqu'à l'envoi (pour faire une pause). Une personne ayant accès à l'appareil pourrait les lire. | Effacées à l'envoi ; bouton « Effacer mes réponses de cet appareil ». À mentionner dans l'information aux travailleurs (appareils partagés). |
| Correspondance code ↔ personne | **Dépend de l'organisation de l'entreprise.** C'est le seul lien qui permettrait de relier une personne à un code. | Consigne affichée lors de la création des codes : distribution au hasard, aucune liste (14/10/2026). À reprendre dans le contrat et le kit. |
| Petits effectifs | Voir point 3. | — |

### Conditions d'un recoupement pendant la collecte
Pour relier une réponse à une personne, il faudrait réunir **deux** éléments que personne ne détient normalement ensemble :
1. la correspondance « qui a reçu quel code » (qui ne doit pas exister : distribution au hasard) ;
2. un accès technique direct à la base de données (ou à ses journaux internes, ou aux journaux de l'hébergeur), avec des compétences d'analyse de bas niveau.

Les praticiens IMA n'ont **aucun écran** montrant une réponse individuelle ; les référents n'ont **aucun accès** à la base.

## 2. Minimisation des données

| Donnée du répondant | Collectée ? | Nécessaire au calcul ? |
| --- | --- | --- |
| Groupe choisi | Oui | Oui (résultats par groupe) |
| Réponses chiffrées | Oui | Oui |
| Versions des questionnaires | Oui | Oui (traçabilité des textes utilisés) |
| Date du jour | Oui | **Non** pour le calcul ; prévue par le cahier des charges — décision ouverte (section 6) |
| Langue du questionnaire | Non | — |
| Heure, durée, IP, appareil, navigateur, cookie | Non | — |
| Texte libre | Non (aucune case) | — |
| Données démographiques (âge, sexe, ancienneté…) | Non | — |

Données des référents et praticiens : nom, e-mail, rôle ; pour les praticiens, empreinte du mot de passe et secret du second facteur chiffré. Données techniques : compteur d'échecs de connexion indexé sur une empreinte de l'adresse e-mail (`lib/auth/limite.ts`).

## 3. Seuil de 10, y compris sur les croisements

### 3.1 Ce qui est appliqué
- **Une seule variable de regroupement** par campagne (le groupe choisi par le répondant, défini par un seul critère : service, site, métier…). InnerOS ne collecte **aucune autre variable** (ancienneté, âge, sexe…) : aucun croisement « groupe × ancienneté × service » n'est donc possible.
- **Aucun résultat sous le seuil** : contrainte et déclencheur en base de données (`drizzle/0000`, `drizzle/0001_garde-fous.sql` : `aggregates.n >= 10` et `n >= seuil de la campagne`). Le seuil d'une campagne ne peut pas être inférieur à 10.
- **Seuil appliqué échelle par échelle** : le nombre de personnes est compté pour chaque échelle (certaines personnes ne répondent pas à toutes les questions).
- **Protection contre la soustraction (masquage complémentaire)** : si la part masquée (total − groupes visibles) est comprise entre 1 et 9 personnes, le plus petit groupe visible est masqué à son tour (`lib/resultats/agregats.ts`, fonction `groupesAffichables`). **Testé** avec des groupes de 25, 12 et 9 personnes : le groupe de 9 n'apparaît nulle part, celui de 12 est masqué aussi.
- **Participation** : le nombre de réponses par groupe est masqué selon la même règle.
- **Aucun calcul pendant la collecte** : empêche de déduire une réponse en comparant deux affichages successifs.
- **IA** : ne reçoit que les résultats déjà enregistrés (donc ≥ seuil), avec vérification bloquante avant envoi (étape 8).

### 3.2 Règle pour toute évolution future
Si un jour une deuxième variable est ajoutée (par exemple l'ancienneté), **chaque case du croisement** devra passer par la même règle (seuil + masquage complémentaire sur chaque ligne et chaque colonne), et ce point devra être réévalué dans l'AIPD avant mise en production.

### 3.3 Groupes trop petits dès la conception
L'effectif prévu de chaque groupe doit être au moins égal au seuil (contrainte en base). Mais un groupe peut recevoir moins de 10 réponses : il est alors masqué (et un autre groupe si nécessaire).

### 3.4 Risque résiduel : comparaison entre deux campagnes
Si la même entreprise mène deux campagnes successives avec les mêmes groupes, la différence entre deux résultats pourrait, en théorie, refléter le changement d'une ou deux personnes (départ, arrivée). Mesure recommandée : en parler dans le rapport (limite méthodologique) et ne pas présenter d'évolution pour un groupe dont l'effectif a très peu changé. **À DÉCIDER.**

## 4. Sécurité technique

| Mesure | État | Où |
| --- | --- | --- |
| HTTPS partout | Assuré par l'hébergeur ; en-tête HSTS ajouté (2 ans) | `next.config.ts` |
| Autres en-têtes de sécurité | `nosniff`, `Referrer-Policy: no-referrer` (aucune adresse transmise aux liens externes), interdiction d'affichage dans un cadre, désactivation caméra/micro/géolocalisation | `next.config.ts` |
| Connexion chiffrée à la base | Obligatoire en production (refus de démarrer sans `sslmode=require` ou `verify-full`) | `lib/db/client.ts` |
| Chiffrement de la base au repos | **À VÉRIFIER** auprès d'OVH (et option de chiffrement des sauvegardes) | — |
| Empreinte des codes | HMAC-SHA256 avec clé secrète du serveur ; codes jamais stockés | `lib/admin/jetons.ts` |
| Mots de passe des praticiens | Empreinte scrypt | `lib/auth/password.ts` |
| Second facteur (TOTP) | Obligatoire ; secret chiffré AES-256-GCM | `lib/auth/totp.ts` |
| Liens de connexion des référents | Usage unique, 15 minutes, empreinte seulement | `lib/auth/lien-magique.ts` |
| Limitation des tentatives | 5 échecs en 15 minutes | `lib/auth/limite.ts` |
| Sessions | 8 heures | `auth.ts` |
| Devinette de codes | 31^10 ≈ 8 × 10^14 combinaisons ; pas de limitation de débit sur l'ouverture du questionnaire | Recommandé avant production : limitation de débit au niveau de l'hébergeur |
| Contrôle d'accès | Praticiens : agrégats et rapports ; référents : participation et rapport validé de leurs campagnes ; **aucun écran de réponses brutes** | Pages `app/[locale]/admin`, `app/[locale]/espace` |
| Accès direct à la base | **À DÉCIDER** : liste nominative des personnes, accès personnels (pas de compte partagé), journalisation des accès côté OVH | — |
| Journal d'audit applicatif | Actions des praticiens et référents (dont la consultation des résultats et les suppressions), 24 mois, sans donnée de répondant (**testé**) | `lib/audit.ts`, page « Journal » |
| Suppression des données brutes | Automatique : 12 mois après l'acceptation du rapport, 18 mois après la clôture au plus tard ; journalisée ; simulation possible | `lib/confidentialite/conservation.ts`, tâche nocturne `app/api/cron/purge` |
| Secrets | Uniquement dans `.env.local` (développement) et les variables de l'hébergeur (production), jamais dans le code ni dans Git | `.env.example` |
| Environnement de développement | Base locale sur le PC de développement, données fictives uniquement | **À FORMALISER** : interdiction de copier des données réelles en développement |
| Politique de sécurité du contenu (CSP) | Non configurée | Recommandé avant production |
| Revue de sécurité externe | Non réalisée | Prévue avant la première campagne réelle (cahier, section 10) |

## 5. Vérifications automatisées
Les tests suivants s'exécutent à chaque modification (`npm test`, 125 tests au 14/10/2026) :
- un code utilisé et une réponse n'ont jamais le même numéro de transaction ;
- un envoi refusé ne consomme pas le code ;
- à la clôture : codes supprimés, réponses réécrites (nouveaux identifiants, un seul numéro de transaction), aucune réponse perdue ;
- aucun résultat sous 10 personnes, y compris par soustraction ; le groupe de 9 n'apparaît nulle part ;
- le journal ne contient ni code ni réponse ;
- suppression des réponses brutes à l'échéance, conservation des résultats et du rapport ;
- acceptation du rapport réservée au référent signataire, après validation IMA.

## 6. Informations et décisions manquantes

À transmettre à l'agent juridique d'IMA. Chaque point bloque ou conditionne une partie de l'AIPD.

### Rôles et cadre juridique
1. **Responsable de traitement** pour chaque client : l'entreprise cliente (IMA sous-traitant), IMA, ou responsabilité conjointe ? Faut-il un modèle de contrat de sous-traitance (article 28 RGPD) entre IMA et chaque client ?
2. **Base légale** du traitement, par pays : obligation légale de l'employeur (analyse des risques psychosociaux en Belgique, NR-1 au Brésil, évaluation des risques en France et au Portugal), intérêt légitime, consentement ?
3. **Statut juridique d'IMA** : personne physique (organisation Anthropic et facturation au nom de Michelle Assunção avec son numéro de TVA) ou société distincte ? Cela détermine au nom de qui signer les DPA.
4. **DPO** : IMA doit-il en désigner un ? Coordonnées à publier sur la page de confidentialité.
5. **Qualification des données** : confirmer la position proposée (réponses brutes = données pseudonymisées ; résultats ≥ 10 = anonymes). Les réponses portent sur la santé et le bien-être au travail : relèvent-elles de l'article 9 RGPD (données de santé) tant qu'elles sont pseudonymisées ?
6. **Information des travailleurs et consultation des représentants** (CPPT, délégation syndicale, CSE, CIPA) : qui en est responsable, et à quel moment ?

### Hébergement et sous-traitants
7. **OVHcloud** : région exacte (France, Allemagne…), offre (base PostgreSQL managée), chiffrement au repos, durée de rétention des sauvegardes et des journaux, accès des équipes OVH, DPA signé. Option « HDS » nécessaire pour la France ?
8. **Vercel** : région des fonctions (UE), durée de conservation des journaux de requêtes (adresse IP, heure), DPA et clauses contractuelles types, membres ayant accès au projet.
9. **Brevo** : DPA, région, durée de conservation des e-mails envoyés.
10. **Anthropic** : DPA, durée de conservation des requêtes, absence d'entraînement sur les données, transfert vers les États-Unis (clauses contractuelles types / cadre de protection des données UE–États-Unis), mention au registre.
11. **GitHub** (code source, dépôt privé) : ne contient aucune donnée personnelle ; à confirmer comme hors périmètre.

### Accès et organisation chez IMA
12. **Qui a accès aux données brutes** (accès direct à la base) chez IMA ou chez un prestataire : liste nominative, procédure d'attribution et de retrait, journalisation des accès.
13. **Qui sont les praticiens habilités** à valider les rapports (formation à la maîtrise de l'IA, article 4 de l'AI Act) ?
14. **Procédure en cas de violation de données** (notification à l'autorité sous 72 heures, information des clients).
15. **Politique de distribution des cartes** : la consigne « au hasard, sans liste » doit-elle figurer dans le contrat avec le client ?

### Durées de conservation
16. Confirmer : réponses brutes 12 mois après l'acceptation du rapport / 18 mois après la clôture ; journal 24 mois.
17. Fixer et automatiser : résultats de groupes, rapports, comptes des référents (« contrat + 1 an » proposé) — **pas encore automatisé**.
18. Durée de conservation des sauvegardes (dépend d'OVH, point 7).

### Choix de minimisation
19. **Date de réponse** : la conserver (prévue par le cahier des charges, utile pour suivre la participation dans le temps) ou la supprimer (réduit le risque d'individualisation) ? Option intermédiaire : la supprimer à la clôture.
20. **Évolution d'une campagne à l'autre** (point 3.4) : autoriser la comparaison entre campagnes successives, et à quelles conditions ?
21. **Variables complémentaires** (ancienneté, âge…) : confirmer qu'aucune n'est prévue ; sinon, réévaluation obligatoire.

### Avant la mise en production
22. Revue de sécurité par un développeur externe (prévue au cahier des charges).
23. Limitation du débit des requêtes et politique de sécurité du contenu (CSP) chez l'hébergeur.
24. Interdiction formelle d'utiliser des données réelles sur un poste de développement.
