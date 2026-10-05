# Guide des prompts Claude Code — InnerOS phase 1

Mode d'emploi : copiez un prompt à la fois dans Claude Code, lisez le plan qu'il propose, répondez « Validé, tu peux exécuter » seulement si le plan vous paraît clair, puis faites les vérifications indiquées. Ne passez à l'étape suivante que lorsque tout est vert.

Chaque prompt commence par la même consigne de sécurité : Claude Code relit `CLAUDE.md` et ne code rien avant votre accord.

---

## Avant de commencer (sans Claude Code, environ 30 minutes)

1. Installer Claude Code (application de bureau Claude, onglet Code).
2. Créer un dossier `inneros` sur votre ordinateur et y copier tout le contenu de ce kit.
3. Créer un dépôt **privé** sur GitHub nommé `inneros` (vide, sans README).
4. Dans la console Anthropic : créer une clé API nommée « InnerOS », distincte de celle du chatbot, avec un plafond mensuel de 30 €. La garder dans un gestionnaire de mots de passe.
5. Dans Brevo : créer une clé API nommée « InnerOS » (e-mails transactionnels uniquement).
6. Préparer dans `instruments/` les fichiers officiels des questionnaires dès que vous les recevez (version nationale COPSOQ III, CBI, Flourishing Scale). En attendant, Claude Code utilisera des items de test.

Ouvrez ensuite le dossier `inneros` dans Claude Code.

---

## Étape 1 — Squelette de l'application

```text
Lis CLAUDE.md, docs/CAHIER_DES_CHARGES_V1.1.md et docs/CHARTE_GRAPHIQUE.md.
Ne code rien encore. Propose-moi le plan de l'étape 1 :
- créer une application Next.js (App Router, TypeScript strict, Tailwind v4) dans ce dossier ;
- brancher design/tokens.css et les polices de la charte ;
- configurer next-intl avec fr (par défaut) et pt-BR ;
- créer une page d'accueil InnerOS aux couleurs IMA, avec le logo assets/logo-ima-provisoire.png
  et la vague bleu nuit soulignée d'or en pied de page ;
- préparer .gitignore (incluant .env*), un fichier .env.example sans valeur, et le dépôt Git
  relié à mon dépôt GitHub privé inneros.
Liste les fichiers que tu vas créer et les commandes que tu vas lancer, en français simple.
Attends mon accord avant d'exécuter.
```

Vérifier : l'application s'ouvre sur `http://localhost:3000`, en français et en portugais, avec le logo, le bleu nuit, l'or et la vague.

## Étape 1 bis — Aligner la charte sur le site IMA

```text
Ouvre la page https://institutmindsetenaction.com et relève les couleurs (codes hex),
les polices et le style des boutons utilisés par le site.
Compare-les avec design/tokens.css et docs/CHARTE_GRAPHIQUE.md.
Présente-moi un tableau des écarts et propose les corrections, sans rien modifier.
Si une couleur du site ne respecte pas le contraste AA pour du texte, signale-le
et propose une variante accessible.
Attends mon accord avant de modifier les fichiers.
```

Si le code source de votre site se trouve sur GitHub ou Vercel, vous pouvez aussi donner son adresse à Claude Code pour qu'il y lise directement les couleurs et polices.

Vérifier : les couleurs et polices d'InnerOS correspondent à celles du site.

## Étape 2 — Base de données

```text
Relis CLAUDE.md (règles 1, 2 et 3) et la section 7 du cahier des charges.
Propose le schéma Drizzle des tables : users, organizations, campaigns, groups, tokens,
responses, answers, aggregates, reports, instruments, audit_log.
Contraintes :
- tokens ne contient qu'un hash, un statut et une date d'expiration, sans lien vers responses ;
- responses ne contient que campaign_id, group_id, la date du jour et la version des instruments ;
- answers ne contient aucun champ texte libre ;
- groups refuse un effectif prévu inférieur au seuil de la campagne (minimum 10).
Utilise PGlite en développement, avec les mêmes migrations que pour PostgreSQL OVH plus tard.
Montre-moi le schéma commenté en français avant de créer les fichiers.
```

Vérifier : Claude Code vous montre les tables créées et confirme qu'aucune ne peut relier une réponse à une personne.

## Étape 3 — Connexions

```text
Relis CLAUDE.md et la section 3 du cahier (F1, F2).
Propose la mise en place d'Auth.js :
- administrateurs IMA : e-mail + mot de passe + double authentification TOTP obligatoire,
  avec QR code à scanner dans une application d'authentification ;
- référents entreprise : lien magique envoyé par Brevo, valable 15 minutes, sans mot de passe ;
- sessions de 8 heures, limitation des tentatives ;
- un script pour créer mon compte administrateur.
Explique-moi chaque écran que je vais voir. Attends mon accord.
```

Vérifier : vous vous connectez avec votre application d'authentification ; un mauvais code est refusé.

## Étape 4 — Entreprises, campagnes et jetons

```text
Relis CLAUDE.md et les fonctionnalités F3, F4, F5 et F13 du cahier.
Propose les écrans administrateur pour :
- créer une fiche entreprise (nom, pays BE/BR/FR/PT, langue, secteur, tranche d'effectif, référent) ;
- créer une campagne liée à un mandat IMA (Flash, N1, N2, N3), choisir les instruments,
  les groupes et le seuil (10 par défaut) ; refuser tout groupe prévu sous le seuil ;
- générer les jetons à usage unique (stockés uniquement sous forme de hash),
  les exporter en CSV et en PDF de QR codes à imprimer, à la charte IMA ;
- générer le kit d'information (F13) pour les travailleurs et leurs représentants, en fr et pt-BR.
Attends mon accord.
```

Vérifier : vous créez une entreprise et une campagne de test ; un groupe de 8 personnes est refusé ; le PDF de QR codes porte le logo et la vague IMA.

## Étape 5 — Questionnaires et passation

```text
Relis CLAUDE.md (règles 1, 9 et 10) et les sections 2 et 4 du cahier.
1. Propose un format JSON versionné pour les instruments (items, langue, sens de cotation,
   échelles, source à citer). Crée un fichier de test avec des items fictifs clairement marqués
   « ITEM DE TEST ». N'invente jamais le texte réel d'un item.
2. Propose le parcours du répondant, mobile d'abord, à la charte IMA :
   page d'information (finalité, anonymat, durée, droit de ne pas répondre, absence de diagnostic,
   usage de l'IA, ressources d'aide du pays), choix du groupe, questionnaire avec barre de progression,
   option « je préfère ne pas répondre », sauvegarde sur l'appareil, écran de fin avec ressources d'aide.
3. Le jeton est marqué « consommé » à l'envoi, sans aucun lien avec la réponse enregistrée.
Attends mon accord.
```

Vérifier : vous répondez sur votre téléphone avec un jeton ; le même jeton est refusé ensuite ; aucune case de texte libre n'existe.

Quand vous recevez les versions officielles des questionnaires, utilisez ce prompt :

```text
J'ai placé dans instruments/ le fichier officiel [nom du fichier] pour [instrument, langue].
Convertis-le dans notre format JSON sans modifier aucun mot des items.
Exclus les items d'engagement au travail (WE) pour COPSOQ.
Montre-moi la liste des items convertis pour que je la compare à l'original avant d'enregistrer.
```

## Étape 6 — Moteur de calcul

```text
Relis CLAUDE.md (règle 4) et les règles de calcul de la section 4 du cahier.
Propose le module lib/scoring :
- COPSOQ III : recodage 0/25/50/75/100 selon le sens de l'item, moyenne si au moins la moitié des items
  de l'échelle sont renseignés ;
- CBI : recodage 100/75/50/25/0, item d'énergie pour la famille et les amis inversé, règle des valeurs
  manquantes paramétrable ;
- Flourishing Scale : somme des 8 items, seulement si les 8 sont renseignés.
Écris d'abord les tests Vitest avec 5 cas de référence que je pourrai vérifier à la main,
présentés dans un tableau lisible. Puis écris le code jusqu'à ce que les tests passent.
Attends mon accord avant d'écrire le code.
```

Vérifier : tous les tests passent et les 5 cas correspondent à votre calcul sur papier.

## Étape 7 — Agrégats et tableau de bord

```text
Relis CLAUDE.md (règle 3) et F7, F9 du cahier.
Propose :
- le calcul des agrégats par groupe et par échelle (effectif, moyenne, écart-type,
  part au-dessus du seuil de vigilance), uniquement pour les groupes d'au moins 10 réponses ;
- le suivi de participation (réponses / jetons) avec masquage sous le seuil ;
- le tableau de bord administrateur à la charte IMA, avec les repères favorable / vigilance /
  prioritaire toujours accompagnés d'un libellé, et « sans référence nationale » sinon.
Crée aussi un script qui remplit une campagne de démonstration avec des réponses fictives,
dont un groupe de 9 réponses pour tester le masquage.
Attends mon accord.
```

Vérifier : le groupe de 9 réponses n'apparaît nulle part.

## Étape 8 — Brouillon IA, validation et rapport PDF

```text
Relis CLAUDE.md (règles 5 à 8), la section 5 du cahier et prompts/redaction-rapport.system.md.
Propose :
- l'appel à l'API Claude avec ce prompt système, la clé ANTHROPIC_API_KEY lue dans .env.local,
  le modèle Sonnet courant, température 0.2, et l'enregistrement du modèle, de la version du prompt
  et de la date ;
- une vérification avant envoi qui bloque tout groupe sous le seuil et tout champ non autorisé ;
- la validation de la réponse JSON avec Zod ;
- l'écran de relecture : brouillon à gauche, données sources à droite, bandeau « Brouillon IA — non validé » ;
- l'éditeur, le refus motivé (journalisé), la liste de contrôle obligatoire avant validation ;
- l'interrupteur IA (par campagne et global) : rapport rédigeable entièrement à la main ;
- l'export PDF à la charte IMA (page de garde, en-têtes de tableaux bleu nuit, vague en pied de page,
  mention « Analyse préparée avec l'assistance d'une IA et validée par [praticien] », sources des
  instruments, limites) ;
- l'espace référent qui n'affiche que les rapports validés.
Attends mon accord.
```

Vérifier : le référent ne voit rien avant votre validation ; avec l'interrupteur IA coupé, vous produisez quand même un rapport complet.

## Étape 9 — Journal, suppression et confidentialité

```text
Relis CLAUDE.md et F11, F12 du cahier, ainsi que la section 7 (durées de conservation).
Propose :
- le journal d'audit des actions administrateurs et référents ;
- la suppression des jetons à la clôture, et des réponses brutes 12 mois après validation du rapport
  (durée paramétrable), en conservant agrégats et rapport ;
- la page de confidentialité et la page d'information des répondants en fr et pt-BR,
  mentionnant l'usage de l'IA (article 50 de l'AI Act).
Montre-moi comment tester la suppression sur la campagne de démonstration. Attends mon accord.
```

Vérifier : après le test, les réponses brutes de démonstration ont disparu, les agrégats et le rapport restent.

## Étape 10 — Mise en ligne et pilote

```text
Relis CLAUDE.md et la section 6 du cahier.
Guide-moi pas à pas, en français simple, pour :
1. passer mon compte Vercel en Pro (ou ajouter InnerOS à mon équipe Pro existante) ;
2. créer la base PostgreSQL managée OVH en région UE et y appliquer les migrations ;
3. renseigner les variables d'environnement dans Vercel (sans jamais afficher les clés) ;
4. configurer les fonctions Vercel en région UE ;
5. relier le sous-domaine app.institutmindsetenaction.com ;
6. vérifier l'envoi des e-mails Brevo depuis le domaine IMA.
Puis prépare une check-list de recette reprenant les dix critères d'acceptation de la section 10.
Ne fais aucune action payante ou irréversible sans ma confirmation explicite.
```

Vérifier : vous déroulez la campagne pilote fictive de bout en bout. Ensuite seulement : revue de sécurité par un développeur, AIPD signée, formation des praticiens, puis première campagne réelle.

---

## Prompts utiles à tout moment

**Quand quelque chose ne marche pas**

```text
Voici ce que je vois : [copier le message d'erreur ou décrire l'écran].
Explique-moi en français simple ce qui se passe, propose une correction,
et attends mon accord avant de modifier quoi que ce soit.
```

**Contrôle de conformité avant chaque fin d'étape**

```text
Relis CLAUDE.md et vérifie que tout le code écrit jusqu'ici respecte les 11 règles non négociables.
Présente-moi un tableau règle par règle : respectée / à corriger, avec l'endroit du code concerné.
```

**Contrôle de la charte graphique**

```text
Parcours tous les écrans et vérifie la charte IMA : aucune couleur en dur, or jamais utilisé pour du
petit texte sur fond clair, contraste AA, focus clavier visible, affichage correct à 360 px de large.
Liste les écarts avant de les corriger.
```

**Reprendre le travail après une pause**

```text
Relis CLAUDE.md et l'historique Git récent. Résume-moi où nous en sommes,
quelle étape est terminée, et quelle est la prochaine action.
```

**Préparer la revue de sécurité par un développeur**

```text
Prépare un document SECURITE.md pour le développeur qui fera la revue : architecture, flux de données,
points sensibles (anonymat, découplage jeton/réponse, seuil, contrôle d'accès, secrets, appels IA),
et la liste des tests existants.
```
