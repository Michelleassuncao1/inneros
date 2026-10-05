# InnerOS — Cahier des charges technique — Phase 1

Version 1.1 du 5 octobre 2026 — Institut Mindset en Action® (Michelle Assunção). Mise à jour réglementaire et scientifique : AI Act après le Digital Omnibus, droit belge, synthèses 2026.

## 1. Contexte, objectifs et périmètre

La phase 1 livre le module Entreprise d'InnerOS : une mesure collective et anonyme des risques psychosociaux, au service du pilier M — Mesurer de MINDSET®. Elle doit être utilisable dans les premières missions IMA (Diagnostic Flash, N1, N2, N3) en Belgique et au Brésil.

Conformément à l'architecture MINDSET®, une campagne ne s'ouvre jamais d'elle-même : elle suit la porte P0 (recevabilité) et la porte P1 (mandat validé). InnerOS outille la méthode ; il ne la remplace pas.

**Objectifs mesurables**

1. Ouvrir une campagne anonyme pour une entreprise cliente en moins de 15 minutes de paramétrage.
2. Calculer automatiquement les scores collectifs COPSOQ III, CBI et Flourishing Scale, par groupe d'au moins 10 répondants.
3. Produire un brouillon de cartographie (pilier I) et de priorités (pilier N) rédigé par Claude, validé par IMA avant toute restitution.
4. Réduire d'environ un jour le temps de collecte et de traitement d'un Diagnostic N1.

| Dans la phase 1 | Hors phase 1 |
| --- | --- |
| Espace administrateur IMA | Comptes individuels des salariés |
| Campagnes anonymes par jetons à usage unique | PHQ-9 et GAD-7 |
| COPSOQ III, CBI, Flourishing Scale | Coach IA et outils ACTION® numériques |
| Scores agrégés, tableau de bord, rapport PDF | Voix, wearables, méditation, journaling |
| Brouillon IA validé par IMA | Paiement en ligne, abonnements InnerOS |
| Espace de consultation du référent entreprise | Accès autonome d'une entreprise sans mandat IMA |
| Français et portugais (Brésil) | Néerlandais, espagnol, anglais, portugais (Portugal) |

## 2. Rôles et parcours utilisateurs

Trois rôles seulement, et aucun accès aux réponses individuelles pour personne, IMA comprise.

| Rôle | Qui | Peut faire | Ne peut jamais |
| --- | --- | --- | --- |
| Administrateur IMA | Michelle Assunção et praticiens habilités | Créer entreprises et campagnes, suivre la participation, lire les agrégats, valider les rapports | Voir une réponse individuelle, publier un rapport non validé |
| Référent entreprise | RH, direction ou conseiller en prévention (CPAP / SESMT) désigné au mandat | Suivre le taux de participation global, consulter le rapport validé | Voir les agrégats d'un groupe sous le seuil, voir un brouillon IA |
| Répondant | Salarié de l'entreprise cliente | Répondre une fois avec un jeton, abandonner à tout moment | Être identifié : aucun compte, aucun nom, aucune adresse |

Cycle d'une campagne : P0 Recevabilité → P1 Mandat validé → Paramétrage → Jetons remis par l'entreprise → Collecte anonyme → Clôture → Calcul des scores → Brouillon IA → Validation IMA (portes PI et PN) → Restitution au référent.

**Parcours du répondant**

1. Il reçoit un jeton à usage unique (code ou QR code), distribué par l'entreprise sans registre de correspondance nom–jeton.
2. Une page d'information explique la finalité, l'anonymat, la durée (environ 20 minutes), le droit de ne pas répondre, l'absence de diagnostic, l'usage de l'IA et les ressources d'aide du pays.
3. Il choisit son groupe dans une liste fermée (service, site ou fonction), puis répond ; chaque question accepte « je préfère ne pas répondre ».
4. La progression est sauvegardée sur son appareil ; il peut reprendre plus tard avec le même jeton.
5. L'écran final remercie et rappelle les ressources d'aide.

## 3. Fonctionnalités de la phase 1

| Code | Fonctionnalité | Détail | Priorité |
| --- | --- | --- | --- |
| F1 | Connexion administrateur | E-mail + mot de passe + double authentification (application TOTP) | P1 |
| F2 | Connexion référent | Lien de connexion à usage unique envoyé par e-mail (Brevo), valable 15 minutes | P1 |
| F3 | Fiche entreprise | Nom, pays (BE, BR, FR, PT), langue, secteur, taille, référent ; rien d'autre | P1 |
| F4 | Création de campagne | Référence du mandat IMA (Flash, N1, N2, N3), questionnaires choisis, groupes, seuil, dates, langues | P1 |
| F5 | Jetons | Génération en lot de jetons à usage unique, export CSV et PDF de QR codes à imprimer | P1 |
| F6 | Passation | Interface mobile d'abord, barre de progression, sauvegarde locale, reprise avec le même jeton | P1 |
| F7 | Suivi de participation | Nombre de réponses sur nombre de jetons ; détail par groupe masqué sous le seuil | P1 |
| F8 | Calcul des scores | Moteur déterministe, testé ; jamais délégué à l'IA (section 4) | P1 |
| F9 | Tableau de bord IMA | Scores par échelle et par groupe, repères visuels avec libellés, effectifs affichés | P1 |
| F10 | Brouillon IA et validation | Brouillon de cartographie et de priorités, éditeur, liste de contrôle de validation, interrupteur IA, export PDF | P1 |
| F11 | Journal d'audit | Qui a fait quoi et quand, côté administrateurs et référents | P2 |
| F12 | Suppression automatique | Effacement programmé des réponses brutes après validation du rapport (section 7) | P2 |
| F13 | Kit d'information | Note pour les travailleurs et leurs représentants (CPPT, délégation syndicale ; consultation prévue par la NR-1) : finalité, anonymat, seuil, destinataires, usage de l'IA, ressources d'aide ; FR et PT-BR | P1 |

**Règles transverses**

- Un groupe dont l'effectif prévu est inférieur au seuil (10 par défaut) est refusé dès le paramétrage.
- Aucun champ de texte libre pour les répondants en phase 1.
- Aucune combinaison de filtres ne peut produire un sous-groupe sous le seuil.
- Le rapport reste invisible pour le référent tant qu'il n'est pas validé par IMA.

## 4. Questionnaires, licences et règles de calcul

Trois instruments validés, utilisés sans modification, avec leur source citée dans le questionnaire et dans le rapport. Les scores sont calculés par le code, jamais par l'IA. Les textes officiels des items sont fournis par IMA ; ils ne sont jamais rédigés par Claude Code.

| Instrument | Ce qu'il mesure | Contenu | Licence | Statut |
| --- | --- | --- | --- | --- |
| COPSOQ III | Facteurs psychosociaux du travail (pilier M, grille des six niveaux MINDSET®) | Items CORE + MIDDLE de la version nationale ; items d'engagement au travail (WE) exclus | CC BY-NC-ND 4.0 ; usage commercial gratuit selon les lignes directrices ; on facture l'analyse, jamais le questionnaire | Accord de principe du réseau international reçu ; équipes nationales à contacter |
| CBI | Épuisement : personnel, lié au travail, lié aux bénéficiaires | 19 items ; échelle bénéficiaires optionnelle | Décrit comme libre d'usage ; pas de texte de licence commerciale trouvé | Confirmation écrite demandée au NFA (Copenhague) |
| Flourishing Scale | Bien-être positif | 8 items, réponses de 1 à 7 | Libre, avec citation de Diener et al. (2010) | Traductions validées FR et PT-BR à identifier |

**Règles de calcul**

- COPSOQ III : réponses sur 5 points recodées 0, 25, 50, 75, 100 selon le sens de l'item ; score d'échelle = moyenne des items répondus si au moins la moitié des items de l'échelle sont renseignés.
- CBI : réponses recodées 100, 75, 50, 25, 0 ; l'item « énergie pour la famille et les amis » est inversé ; score d'échelle = moyenne des items répondus ; la règle exacte des valeurs manquantes est reprise du manuel CBI.
- Flourishing Scale : somme des 8 items (8 à 56) ; score calculé seulement si les 8 items sont renseignés.
- Agrégats par groupe : effectif, moyenne, écart-type et part des répondants au-dessus d'un seuil de vigilance ; rien n'est calculé ni affiché sous 10 répondants.

**Repères d'interprétation.** Les repères favorable / vigilance / prioritaire sont fixés à partir des valeurs de référence nationales COPSOQ lorsqu'elles sont disponibles. À défaut, le tableau de bord affiche les scores sans couleur, avec la mention « sans référence nationale ».

**Structure technique.** Chaque instrument est un fichier de définition versionné (items, langue, sens de cotation, échelles, source). Une nouvelle langue ou version nationale s'ajoute sans toucher au code de calcul.

## 5. Rôle de l'IA (Claude) et garde-fous

Claude rédige un brouillon ; il ne calcule pas, ne décide pas et ne voit jamais une réponse individuelle. La validation reste humaine, aux portes PI (analyse étayée) et PN (priorités décidées).

**Ce que Claude reçoit**

- Les agrégats par échelle et par groupe, uniquement pour les groupes d'au moins 10 répondants.
- Le contexte du mandat saisi par IMA : question diagnostique, périmètre, secteur, pays.
- Aucun nom, aucune adresse, aucun identifiant d'entreprise autre qu'un code interne.

**Ce que Claude produit**

- Un brouillon de cartographie MIN-I-01 selon les six niveaux MINDSET® : travail, rôles, interactions, management, organisation, environnement.
- Pour chaque constat : sa nature (fait ou donnée, perception rapportée, hypothèse, conclusion étayée) et un niveau de confiance (élevé, intermédiaire, limité).
- Une proposition de priorités (pilier N) et, si pertinent, l'orientation vers l'acteur compétent : conseiller en prévention aspects psychosociaux, médecin du travail, SESMT au Brésil.

**Règles du prompt système** (fichier `prompts/redaction-rapport.system.md`)

- Règle de langage IMA (ETH-IMA-01) : formulations descriptives, fonctionnelles, proportionnées.
- Interdits : diagnostic clinique, qualification juridique, causalité non démontrée, jugement de personnes, conclusion sur un groupe sous le seuil.
- Toute affirmation renvoie à une donnée fournie ; une donnée absente est signalée comme limite.
- Le texte est marqué « Brouillon assisté par IA — non validé » tant qu'il n'est pas validé.

**Paramètres et traçabilité**

- Modèle : Claude Sonnet, version courante au moment du développement, température 0,2.
- Chaque brouillon enregistre le modèle, la version du prompt, la date et l'administrateur qui a validé.
- Mention dans le rapport final : « Analyse préparée avec l'assistance d'une IA et validée par [praticien IMA] ».
- Clé API dédiée à InnerOS, distincte de celle du chatbot du site, avec son propre plafond mensuel.

**Supervision humaine effective** (article 14 de l'AI Act appliqué volontairement)

- Le brouillon s'affiche à côté des données sources, pour que chaque affirmation puisse être vérifiée.
- Avant de valider, l'administrateur coche une liste de contrôle : sources vérifiées, aucun groupe sous le seuil, règle de langage respectée, limites mentionnées. La validation reste bloquée tant qu'elle n'est pas complète.
- Il peut modifier, refuser ou annuler le brouillon ; un refus est motivé et journalisé.
- Un interrupteur désactive la rédaction IA pour une campagne ou pour toute la plateforme.
- Seuls des praticiens IMA formés à la maîtrise de l'IA peuvent valider un rapport.

## 6. Architecture technique et sous-traitants

Une application web unique, une seule base de données chez OVH en Europe, Claude comme seul fournisseur d'IA.

| Sous-traitant | Rôle | Données reçues | Localisation | Encadrement |
| --- | --- | --- | --- | --- |
| OVH | Base de données managée, sauvegardes | Toutes les données InnerOS | France / UE ; option HDS à vérifier pour la France | DPA |
| Vercel | Hébergement de l'application (à partir du pilote) | Données en transit, rien au repos | Fonctions en région UE ; société américaine | DPA + clauses contractuelles types |
| Anthropic | Rédaction des brouillons | Agrégats anonymes, contexte du mandat | Société américaine | DPA + clauses types ; rétention à vérifier |
| Brevo | E-mails de connexion et de notification | Adresse du référent ou de l'admin, aucun résultat | France | DPA |

Make et HubSpot restent hors du périmètre des réponses. GitHub héberge uniquement le code source.

**Pile technique** : Next.js (App Router) et TypeScript ; Tailwind CSS ; Drizzle ORM (PGlite en développement, PostgreSQL OVH en production) ; Auth.js avec TOTP ; next-intl (fr, pt-BR) ; Zod ; Vitest ; @react-pdf/renderer ; code portable sans dépendance propre à Vercel.

**Coûts mensuels estimés** : Vercel 0 € pendant le développement en local, puis environ 20 $ (sans supplément si le site IMA est déjà en Pro) ; OVH PostgreSQL managé environ 20 à 40 € ; API Claude quelques euros par rapport (plafond 30 €) ; Brevo 0 € ; sous-domaine `app.institutmindsetenaction.com` 0 €.

## 7. Modèle de données

Le jeton et la réponse sont stockés sans lien entre eux : c'est ce découplage qui garantit l'anonymat, même pour IMA.

| Table | Contenu principal | Classe IMA | Conservation proposée |
| --- | --- | --- | --- |
| users | Administrateurs et référents : nom, e-mail, rôle, secret TOTP chiffré | C1 | Contrat + 1 an |
| organizations | Nom, pays, langue, secteur, tranche d'effectif | C1 | Contrat + 1 an |
| campaigns | Mandat IMA lié, instruments, seuil, dates, langues, statut, interrupteur IA | C2 | Contrat + 1 an |
| groups | Libellé, effectif prévu (≥ seuil) | C5 | Comme la campagne |
| tokens | Hash du jeton, statut, date d'expiration ; aucun lien vers une réponse | C1 technique | Supprimés à la clôture |
| responses | Campagne, groupe, date du jour, version des instruments | Anonyme, protégé comme C4 | 12 mois après validation |
| answers | Réponse, item, valeur ; aucun texte libre | Anonyme, protégé comme C4 | 12 mois après validation |
| aggregates | Campagne, groupe, échelle, effectif, moyenne, écart-type, part au-dessus du seuil | C5 | Contrat + 1 an |
| reports | Brouillon IA, texte validé, métadonnées IA, validateur, liste de contrôle, date | C5 | Contrat + 1 an |
| instruments | Définitions versionnées et traductions | Référentiel | Permanent |
| audit_log | Actions des administrateurs et référents | C1 | 2 ans |

Aucune adresse IP, aucun navigateur, aucun horodatage précis n'est enregistré pour les répondants. Les durées sont des propositions à valider dans l'AIPD.

## 8. Sécurité et conformité

Aucune campagne réelle avant quatre conditions : AIPD signée, revue de sécurité par un développeur humain, contrats de sous-traitance en place, formation des praticiens IMA à la maîtrise de l'IA.

**Sécurité technique** : HTTPS partout et chiffrement au repos ; secrets uniquement dans `.env.local` puis dans Vercel ; TOTP obligatoire pour les administrateurs, sessions de 8 heures ; contrôle d'accès côté serveur à chaque requête ; limitation des tentatives ; sauvegardes quotidiennes OVH et test de restauration trimestriel ; procédure d'incident alignée sur le Bloc 2 (notification sous 72 heures si nécessaire).

**RGPD** : rôles à confirmer par un juriste (entreprise cliente probablement responsable du traitement, IMA sous-traitant pour la campagne) ; minimisation ; AIPD et registre ; information des répondants.

**Droit belge du bien-être au travail** : InnerOS soutient l'analyse des risques psychosociaux de l'employeur (Code du bien-être au travail, livre I, titre 3) sans la remplacer, ni le rôle du CPAP, de la personne de confiance ou du médecin du travail. Avant une campagne, l'employeur informe et consulte les représentants des travailleurs (CPPT, à défaut délégation syndicale ou travailleurs). L'application de la CCT n° 39 est examinée au cas par cas avec le juriste. Le kit F13 facilite cette étape sans s'y substituer.

**LGPD et NR-1** : transfert encadré par les clauses types de l'ANPD ; le rapport nourrit le GRO/PGR sans le remplacer.

**AI Act (après le Digital Omnibus, règlement (UE) 2026/1744)**

- Pratiques interdites (depuis le 2 février 2025) : aucune inférence d'émotions au travail.
- Classification documentée : analyse collective sous validation humaine, aucune évaluation ni décision individuelle, donc hors annexe III point 4 ; consignée dans l'AIPD.
- Annexe III applicable à partir du 2 décembre 2027 : toute future fonctionnalité individuelle est réévaluée avant sa conception.
- Article 4 (obligation de moyens depuis le 27 juillet 2026) : formation documentée des praticiens et notice pour les référents.
- Article 50 (depuis le 2 août 2026) : assistance de l'IA indiquée dans chaque rapport, la page d'information et la politique de confidentialité.

**Dispositif médical et licences** : pas de PHQ-9 ni de GAD-7 en phase 1, vocabulaire non clinique, aucun score individuel restitué ; sources des instruments citées.

**Fondement scientifique et allégations** : InnerOS se présente comme un outil d'aide à la prévention collective, jamais comme une IA qui améliore ou mesure la santé mentale d'une personne ; aucune détection ni prédiction individuelle ; chaque rapport mentionne ses limites (données déclaratives, mesure ponctuelle, aucune causalité, aucun diagnostic) ; aucune allégation chiffrée de performance sans étude propre.

## 9. Plan de construction

Le détail des prompts se trouve dans `docs/PROMPTS_CLAUDE_CODE.md`.

| Étape | Contenu | Vérification |
| --- | --- | --- |
| 1 | Squelette Next.js, fr / pt-BR, charte IMA, en local | La page d'accueil s'affiche dans les deux langues |
| 1 bis | Alignement de la charte sur le site IMA | Couleurs et polices identiques au site |
| 2 | Schéma de base de données et migrations (PGlite) | Les tables existent, aucune ne relie réponse et personne |
| 3 | Connexions administrateur (TOTP) et référent (lien magique) | Connexion avec l'application d'authentification |
| 4 | Entreprises, campagnes, groupes, jetons, QR codes, kit F13 | Un groupe de 8 est refusé |
| 5 | Questionnaires et passation | Un jeton ne sert qu'une fois |
| 6 | Moteur de calcul et tests | 5 cas de référence vérifiés à la main |
| 7 | Agrégats et tableau de bord | Un groupe de 9 n'apparaît nulle part |
| 8 | Brouillon IA, validation, PDF, espace référent | Rien n'est visible avant validation ; rapport possible sans IA |
| 9 | Journal, suppression, confidentialité | La suppression fonctionne sur la démonstration |
| 10 | Mise en ligne (Vercel Pro, OVH, sous-domaine) et pilote fictif | Parcours complet de bout en bout |

## 10. Critères d'acceptation, budget et points ouverts

**Critères d'acceptation**

- [ ] Un répondant termine le questionnaire sur mobile en 20 minutes ou moins.
- [ ] La base ne contient aucune donnée permettant d'identifier un répondant.
- [ ] Un groupe de moins de 10 répondants n'apparaît ni au tableau de bord, ni dans le rapport, ni dans les données envoyées à Claude.
- [ ] Les scores sont identiques à 5 cas de référence calculés à la main.
- [ ] Le référent ne voit aucun brouillon ; il voit le rapport seulement après validation.
- [ ] La suppression programmée des réponses brutes est testée et journalisée.
- [ ] L'AIPD est signée et la revue de sécurité est faite.
- [ ] L'interrupteur IA est testé : un rapport complet peut être produit sans brouillon IA.
- [ ] La liste de contrôle bloque la validation tant qu'elle n'est pas complète.
- [ ] Les preuves de maîtrise de l'IA (article 4) existent pour chaque praticien utilisateur.

**Budget** : fonctionnement environ 50 à 80 € par mois ; revue de sécurité (1 à 2 jours), validation juridique RGPD / AIPD et traductions validées à chiffrer, financées par les premières missions IMA.

**Points ouverts**

- [ ] Contacter les équipes nationales COPSOQ (Belgique, France, Brésil, Portugal).
- [ ] Obtenir la confirmation écrite du NFA pour le CBI.
- [ ] Identifier les traductions validées de la Flourishing Scale (FR, PT-BR).
- [ ] Obtenir les valeurs de référence nationales COPSOQ.
- [ ] Faire confirmer par un juriste les rôles RGPD, l'information-consultation (CPPT, CCT n° 39) et la participation des travailleurs (NR-1).
- [ ] Vérifier si l'hébergement HDS est requis pour la France.
- [ ] Fixer les durées de conservation dans l'AIPD.
- [ ] Vérifier les numéros d'aide par pays (Belgique, France, Brésil — CVV 188, Portugal).
- [ ] Réévaluer la classification AI Act avant la phase 2 et au plus tard avant le 2 décembre 2027.
- [ ] Relire ce cahier après la proposition de Quality Jobs Act attendue fin 2026.
- [ ] Revue réglementaire et scientifique tous les six mois.
- [x] Remplacer le logo provisoire par le fichier officiel haute définition (5 octobre 2026).
