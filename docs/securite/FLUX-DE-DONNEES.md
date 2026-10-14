# InnerOS — Parcours d'une réponse, de la collecte à la suppression

*Document de travail pour l'analyse d'impact (AIPD), destiné à être relu par un DPO ou un juriste.*
*Version du 14 octobre 2026. Décrit le fonctionnement réel du code à cette date (dépôt InnerOS, commit de cette version).*
*Les points marqués « À DÉCIDER » ou « À VÉRIFIER » sont repris dans la liste de la section 9.*

---

## 1. En une phrase

Un travailleur reçoit une carte avec un code, répond à un questionnaire sans donner son nom, ses réponses sont enregistrées **sans lien avec son code**, puis IMA calcule uniquement des **moyennes de groupes d'au moins 10 personnes**, rédige un rapport collectif, et les réponses individuelles sont supprimées après un délai fixé.

## 2. Les acteurs

| Acteur | Rôle | Ce qu'il voit |
| --- | --- | --- |
| **Travailleur (répondant)** | Répond au questionnaire avec un code reçu sur une carte | Ses propres réponses, sur son appareil, pendant qu'il répond |
| **Référent de l'entreprise** (RH, direction, conseiller en prévention) | Distribue les cartes, suit la participation, reçoit le rapport | Le nombre de réponses (masqué sous 10 par groupe), puis le rapport validé. **Jamais une réponse individuelle.** |
| **Référent signataire** | Un seul référent désigné par campagne | Comme les autres référents, et il accepte le rapport (vérification des faits) |
| **Praticien IMA (administrateur)** | Prépare la campagne, crée les codes, calcule et valide le rapport | Les résultats de groupes d'au moins 10 personnes. **Aucun écran ne montre une réponse individuelle.** |
| **Personne ayant un accès technique à la base de données** | Exploitation technique | Peut techniquement lire les réponses brutes (sans nom). À DÉCIDER : qui, chez IMA ou chez un prestataire. |
| **Sous-traitants techniques** | Hébergement, e-mails, IA | Voir section 7 |

## 3. Le parcours, étape par étape

```
 ① Préparation      ② Distribution     ③ Réponse          ④ Enregistrement     ⑤ Clôture et calcul
 IMA crée les       L'entreprise        Le travailleur     Le code est marqué   Codes supprimés,
 codes et les   ──▶ remet les cartes ──▶ scanne le QR  ──▶ « utilisé » ; la ──▶ réponses mélangées,
 cartes (PDF)       au hasard           code et répond     réponse est rangée   moyennes de groupes
                                                           à part, sans lien    (≥ 10 personnes)
                                                                                      │
 ⑨ Suppression      ⑧ Acceptation      ⑦ Validation IMA    ⑥ Brouillon IA ◀──────────┘
 des réponses   ◀── par le référent ◀── (liste de       ◀── (si activé) : reçoit
 brutes             signataire          contrôle)           uniquement les moyennes
```

### ① Préparation (IMA)
- IMA crée la campagne (entreprise, groupes, questionnaires, dates, seuil d'au moins 10 personnes).
- IMA génère des **codes à usage unique** : 10 caractères tirés au hasard (environ 800 000 milliards de combinaisons). Les codes s'affichent **une seule fois**, pour être imprimés sur des cartes (PDF avec QR code) ou exportés en tableau.
- La base ne garde **pas les codes eux-mêmes**, seulement une empreinte chiffrée (empreinte « HMAC-SHA256 » avec une clé secrète du serveur). Un code perdu ne peut pas être réaffiché : on l'annule et on en crée un autre.

### ② Distribution (entreprise)
- L'entreprise remet une carte à chaque travailleur. La consigne affichée à IMA et au référent est de **distribuer les cartes au hasard (pile mélangée) et de ne jamais noter qui reçoit quel code**. C'est une condition de l'anonymat : si une telle liste existait, elle serait le seul lien possible entre une personne et un code.

### ③ Réponse (travailleur)
- Le travailleur scanne le QR code ou tape l'adresse et son code. Le code est placé après le signe « # » de l'adresse : **cette partie de l'adresse n'est jamais envoyée au serveur** par le navigateur. Le code est transmis au serveur uniquement dans le contenu chiffré de la requête (HTTPS), et il est **retiré de l'adresse affichée** après l'envoi.
- Il lit une page d'information (finalité, anonymat, durée, droit de ne pas répondre, absence de diagnostic, usage de l'IA, numéros d'aide), choisit son groupe (par exemple son service) dans une liste, puis répond.
- Toutes les questions proposent « Je préfère ne pas répondre ». **Il n'y a aucune case de texte libre.**
- Pendant qu'il répond, ses réponses sont gardées **uniquement sur son appareil** (stockage du navigateur), pour pouvoir faire une pause. Elles sont effacées de l'appareil dès l'envoi ; un bouton permet aussi de les effacer à tout moment.
- **Aucun cookie** n'est déposé sur l'appareil du répondant par InnerOS.

### ④ Enregistrement (serveur)
1. Le serveur vérifie, **sans rien écrire**, que le code est valide, que la campagne est ouverte, que le groupe existe et que les réponses sont complètes et conformes.
2. Il marque le code « utilisé » (il ne pourra plus servir).
3. **Séparément**, il enregistre la réponse : campagne, groupe, **date du jour (jamais l'heure)**, version des questionnaires, et les réponses sous forme de chiffres.
4. **Rien ne relie le code à la réponse** : pas de colonne commune, et depuis l'audit du 14/10/2026, pas non plus le même numéro technique de transaction (voir le document `ANONYMAT-ET-SECURITE.md`, constat n°1).
- **Ne sont jamais enregistrés** par InnerOS : nom, e-mail, adresse IP, appareil, navigateur, heure, langue choisie, durée de réponse.

### ⑤ Clôture et calcul (IMA)
- À la date de fin, IMA clôture la campagne. Dans une seule opération :
  - **tous les codes sont supprimés** (le nombre de codes distribués est conservé, pour le taux de participation) ;
  - les réponses sont **réécrites dans un ordre aléatoire**, avec de nouveaux identifiants : l'ordre d'arrivée ne peut plus être reconstitué ;
  - les **résultats sont calculés** : pour chaque groupe et chaque échelle, nombre de personnes, moyenne, écart-type.
- **Aucun résultat n'est calculé, enregistré ou affiché pour moins de 10 personnes.** La base de données refuse elle-même un tel résultat.
- **Protection contre la soustraction** : si un petit groupe est masqué, et que l'ensemble de la campagne est affiché, on pourrait retrouver le petit groupe en faisant « total moins groupes visibles ». Le système masque alors aussi le plus petit groupe visible, jusqu'à ce que la part cachée compte au moins 10 personnes.
- Les résultats ne sont **jamais calculés pendant la collecte** : des résultats mis à jour après chaque réponse permettraient de deviner la dernière réponse.

### ⑥ Brouillon assisté par IA (si l'interrupteur IA est activé)
- L'IA (Claude, société Anthropic) reçoit **uniquement** : les moyennes de groupes d'au moins 10 personnes, le contexte du mandat (question diagnostique, périmètre, secteur, pays, langue) et un **code interne** à la place du nom de l'entreprise.
- Avant chaque envoi, le système vérifie automatiquement le contenu et **bloque** l'envoi s'il contient un groupe de moins de 10 personnes, un champ non prévu ou le nom de l'entreprise.
- L'IA ne calcule rien et ne décide de rien. *(Fonction en cours de développement : étape 8.)*

### ⑦ Validation par IMA
- Un praticien IMA relit, corrige et valide le rapport, après avoir coché une liste de contrôle obligatoire (sources vérifiées, aucun groupe sous le seuil, règle de langage, limites mentionnées). La base refuse une validation incomplète ou faite par une autre personne qu'un administrateur IMA actif.

### ⑧ Acceptation par l'entreprise
- Le référent signataire vérifie que les faits correspondent au contrat (périmètre, groupes, période, effectifs) et accepte le rapport, ou demande une correction. Il ne peut pas modifier l'analyse.

### ⑨ Conservation et suppression
| Donnée | Durée | Comment |
| --- | --- | --- |
| Codes (empreintes) | Jusqu'à la clôture | Supprimés automatiquement à la clôture |
| Réponses brutes (sans nom) | 12 mois après l'acceptation du rapport par l'entreprise ; au plus tard 18 mois après la clôture | Suppression automatique chaque nuit ; journalisée |
| Résultats de groupes et rapport | Contrat + 1 an (proposition) | À DÉCIDER et à automatiser |
| Comptes des référents et praticiens | Contrat + 1 an (proposition) | À DÉCIDER et à automatiser |
| Journal des actions (IMA et référents) | 24 mois | Suppression automatique ; aucune donnée de répondant |
| Copies de sauvegarde de la base | Selon l'hébergeur | À VÉRIFIER (OVH) : les données supprimées restent dans les sauvegardes jusqu'à leur expiration |

## 4. Qui peut voir quoi (résumé)

| | Réponse individuelle | Résultats par groupe (≥ 10) | Rapport |
| --- | --- | --- | --- |
| Travailleur | Les siennes, sur son appareil, pendant qu'il répond | Non | Selon la communication de l'entreprise |
| Référent entreprise | **Jamais** | Non (seulement la participation) | Oui, après validation IMA |
| Praticien IMA | **Aucun écran ne l'affiche** | Oui | Oui |
| IA (Anthropic) | **Jamais** | Oui, sans le nom de l'entreprise | Elle en rédige le brouillon |
| Accès technique à la base | Techniquement possible (sans nom) | Oui | Oui |

## 5. Ce que contient exactement une réponse enregistrée

| Champ | Exemple | Pourquoi |
| --- | --- | --- |
| Identifiant | aléatoire, renouvelé à la clôture | Technique (relier les items à la réponse) |
| Campagne | identifiant de la campagne | Calcul par campagne |
| Groupe | « Soins » | Calcul par groupe |
| Date | 10/11/2026 (sans l'heure) | Prévue par le cahier des charges — À DÉCIDER : utile ou à supprimer (voir section 9) |
| Versions des questionnaires | « copsoq3 : be-2023-12-13 » | Savoir quels textes ont été utilisés |
| Réponses | 62 à 89 chiffres (0 à 7) ou « pas de réponse » | Calcul des scores |

## 6. Sécurité, en bref
- **Chiffrement en transit** : toutes les pages en HTTPS (obligation renforcée par l'en-tête HSTS) ; connexion chiffrée obligatoire entre l'application et la base de données en production.
- **Chiffrement au repos** : selon l'hébergeur de la base (OVH) — À VÉRIFIER. Les secrets (clés, mots de passe) ne sont jamais dans le code ; les mots de passe sont stockés sous forme d'empreinte (scrypt) et le second facteur (TOTP) est chiffré (AES-256-GCM).
- **Accès** : praticiens IMA avec mot de passe + code à usage unique (application d'authentification), session de 8 heures ; référents par lien de connexion à usage unique (15 minutes) ; blocage après 5 échecs en 15 minutes.
- **Journal** : chaque action des praticiens et des référents est enregistrée (connexion, création, ouverture, clôture, consultation des résultats, suppression…), sans aucune donnée de répondant.

## 7. Sous-traitants techniques

| Sous-traitant | Rôle | Données reçues | Pays | Statut |
| --- | --- | --- | --- | --- |
| OVHcloud | Base de données | Toutes les données InnerOS | UE (région à choisir) | À CONTRACTUALISER (DPA) — base pas encore créée |
| Vercel | Hébergement de l'application | Données en transit ; journaux techniques des requêtes (dont adresse IP et heure) | Société américaine, fonctions en UE | À CONTRACTUALISER ; durée des journaux À VÉRIFIER |
| Brevo | E-mails de connexion des référents | Nom et e-mail des référents | Société française ; transferts vers les États-Unis et l'Inde mentionnés dans sa politique de confidentialité | À CONTRACTUALISER (DPA : vérifier le mécanisme de transfert actuel) ; durée de conservation des e-mails À DÉCIDER par IMA |
| Anthropic | Brouillon du rapport (IA) | Moyennes de groupes, contexte du mandat, code interne | Société américaine | DPA à consulter et signer ; transfert hors UE à encadrer |

## 8. Ce qui reste à surveiller (risques résiduels)
Voir le détail dans `ANONYMAT-ET-SECURITE.md`. En résumé :
- **Pendant la collecte**, une personne ayant à la fois un accès technique direct à la base (ou à ses journaux internes) **et** la liste « qui a reçu quel code » pourrait en théorie relier une réponse à une personne. La liste ne doit pas exister (distribution au hasard) et l'accès technique doit être restreint et journalisé.
- **Journaux de l'hébergeur** (adresse IP et heure des requêtes) : pendant leur durée de conservation, ils pourraient être recoupés avec l'ordre d'enregistrement par quelqu'un qui aurait aussi accès à la base.
- **Réponses brutes** : même sans nom, la combinaison « groupe + date + réponses » peut permettre d'isoler une personne pour quelqu'un qui dispose d'informations extérieures (par exemple : « elle seule a répondu le samedi »). C'est pourquoi les réponses brutes doivent être traitées comme des **données pseudonymisées** jusqu'à leur suppression, et non comme des données anonymes.
- **Les résultats de groupes d'au moins 10 personnes** (avec la protection contre la soustraction) peuvent être considérés comme anonymes, sous réserve de la comparaison entre deux campagnes successives de la même entreprise (voir `ANONYMAT-ET-SECURITE.md`, point 3).

## 9. Informations et décisions manquantes
La liste complète est tenue à jour dans `ANONYMAT-ET-SECURITE.md`, section « Informations et décisions manquantes ».
