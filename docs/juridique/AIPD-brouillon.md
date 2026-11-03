# Analyse d'impact relative à la protection des données (AIPD) — PluriPrev – RPS (InnerOS)

> **BROUILLON n° 1 du 03/11/2026**, préparé par l'agent juridique IMA (IA) à partir du code et des documents de travail du dépôt. **À relire, compléter et valider par un juriste ou un DPO avant toute campagne réelle.** Ceci n'est pas un avis juridique.
>
> Documents de référence : [FLUX-DE-DONNEES.md](../securite/FLUX-DE-DONNEES.md) (parcours d'une réponse), [ANONYMAT-ET-SECURITE.md](../securite/ANONYMAT-ET-SECURITE.md) (audit d'anonymat et liste des décisions ouvertes), [registre des traitements](registre-traitements-brouillon.md), [clauses du contrat type](clauses-contrat-type.md), page Confidentialité (`lib/confidentialite/textes.ts`).
>
> Légende : **[À DÉCIDER]** choix de Michelle ou du client · **[À VÉRIFIER]** information à obtenir d'un sous-traitant · **[JURISTE]** point de droit à trancher.

---

## 0. Identification

| | |
| --- | --- |
| Outil | PluriPrev – RPS (nom de code interne : InnerOS), application web d'enquêtes anonymes sur les risques psychosociaux, de suivi des plans de prévention et d'ateliers |
| Éditeur et prestataire | Institut Mindset en Action® (IMA), exploité par Michelle Assunção, indépendante en personne physique (Belgique) — numéro d'entreprise **[À COMPLÉTER]** |
| Rôle d'IMA | Sous-traitant (art. 28 RGPD) des entreprises clientes pour les campagnes, les ateliers et le suivi ; responsable du traitement pour ses propres comptes, son journal de sécurité et sa facturation **[JURISTE : confirmer, voir § 2]** |
| Pourquoi une AIPD | Voir § 1 |
| Rédaction | Agent juridique IMA (IA), 03/11/2026, à partir du code au commit `b9a7173` |
| Validation | **[À COMPLÉTER : nom du juriste ou DPO, date, avis]** |
| Révision | À chaque nouveau module, nouvelle variable collectée, nouveau sous-traitant ou nouveau pays, et au moins tous les 2 ans |

## 1. Pourquoi une AIPD est nécessaire

L'article 35 RGPD impose une AIPD avant un traitement « susceptible d'engendrer un risque élevé ». L'Autorité de protection des données (APD) renvoie à sa liste (décision 01/2019) et aux critères des lignes directrices du Groupe de l'article 29 (WP248 rév.01) : au-delà de deux critères, une AIPD est en principe requise.

| Critère WP248 | Présent ? | Pourquoi |
| --- | --- | --- |
| Données sensibles | **Oui, probablement** | Questions sur la santé, l'épuisement et le bien-être au travail (art. 9) tant que les réponses sont pseudonymisées **[JURISTE]** |
| Personnes vulnérables | **Oui** | Travailleurs, dans un rapport de subordination avec l'employeur (WP248 les cite expressément) |
| Usage innovant de technologies | **Oui** | IA générative pour le brouillon de rapport et l'aide à la rédaction |
| Grande échelle | Possible | Selon le nombre de clients et de répondants **[À ÉVALUER au lancement]** |
| Évaluation ou notation | Non pour les personnes | Seuls des groupes d'au moins 10 personnes sont évalués ; aucune décision individuelle |
| Croisement d'ensembles de données | Non | Une seule variable de regroupement ; aucune donnée démographique |

**Conclusion proposée** : au moins trois critères sont réunis ; l'AIPD est nécessaire. Comme IMA est sous-traitant, l'AIPD incombe juridiquement à chaque client (responsable du traitement) ; IMA la prépare et la fournit comme document d'aide (art. 28.3.f RGPD) que chaque client adapte **[JURISTE : confirmer ce partage]**.

## 2. Description des traitements

### 2.1 Vue d'ensemble

| # | Traitement | Personnes concernées | Données | Rôle proposé d'IMA |
| --- | --- | --- | --- | --- |
| T1 | Enquête anonyme (codes, réponses, résultats de groupes) | Travailleurs du client | Groupe choisi, date du jour, réponses chiffrées, version des questionnaires ; **ni nom, ni e-mail, ni adresse IP, ni heure, ni texte libre** | Sous-traitant |
| T2 | Rapport collectif (brouillon IA, validation IMA, acceptation client) | Aucune personne identifiable (résultats ≥ 10) ; praticien et référent (traçabilité) | Moyennes de groupes, contexte du mandat, nom du validateur | Sous-traitant |
| T3 | Comptes des référents du client | Référents (RH, direction, conseiller en prévention) | Nom, e-mail professionnel, rôle, liens de connexion (empreintes) | Sous-traitant |
| T4 | Plan de prévention, registre des risques, calendrier de sensibilisation | Référents ; éventuellement des personnes citées dans les champs libres | Textes saisis par le client (risques, actions, responsables) | Sous-traitant |
| T5 | Ateliers (module C) : inscription, présence, rappel | Travailleurs inscrits | Nom, e-mail professionnel, présence | Sous-traitant |
| T6 | Avis anonymes sur les ateliers | Participants | 5 notes et un commentaire libre, date du jour, jamais reliés à l'inscription | Sous-traitant (ou responsable si IMA les utilise pour ses propres prestations, **[À DÉCIDER]**) |
| T7 | Aide à la rédaction par IA (module D2) | Aucune en principe (notes collectives) | Notes du conseiller en prévention, sans nom d'entreprise, filtrées | Sous-traitant |
| T8 | Comptes des praticiens IMA, formation IA (art. 4 AI Act) | Praticiens IMA | Nom, e-mail, empreinte du mot de passe, second facteur chiffré, progression de formation | Responsable |
| T9 | Journal d'audit et sécurité (dont limitation des requêtes) | Praticiens, référents ; appareils des visiteurs | Actions datées des comptes ; empreinte HMAC quotidienne de l'adresse réseau, 24 h au plus | Responsable (sécurité de son service) **[JURISTE]** |

### 2.2 Finalités
- T1–T2 : permettre à l'employeur de réaliser l'analyse des risques psychosociaux qui lui incombe, en mesurant collectivement les facteurs de risque et de bien-être, puis de définir des mesures de prévention.
- T3–T4 : organiser la campagne et suivre le plan d'action.
- T5–T6 : organiser des ateliers de prévention et en mesurer l'utilité.
- T7 : aider le conseiller en prévention à rédiger des documents collectifs (PV, plan, fiche, rapport).
- T8–T9 : sécuriser l'accès, prouver la maîtrise de l'IA et tracer les actions.

### 2.3 Bases légales proposées **[JURISTE : à confirmer pays par pays]**

| Pays | Base de l'employeur (responsable) | Condition art. 9 si données de santé |
| --- | --- | --- |
| Belgique | Obligation légale (art. 6.1.c) : analyse des risques psychosociaux, Code du bien-être au travail, livre I, titre 3 (art. I.3-1 et suivants) et loi du 4 août 1996 | Art. 9.2.b (obligations en droit du travail) ou 9.2.h (médecine du travail) ; à vérifier avec la loi belge du 30 juillet 2018 |
| France | Obligation légale : art. L4121-1 et suivants du Code du travail (évaluation des risques, DUERP) | Art. 9.2.b |
| Portugal | Obligation légale : Lei n.º 102/2009 | Art. 9.2.b |
| Brésil (LGPD) | Art. 7, II (obligation légale : NR-1, GRO et PGR) | Art. 11, II, a (dados sensíveis : obligation légale) |

Les ateliers (T5) reposent sur l'intérêt légitime ou l'obligation de prévention de l'employeur ; la participation reste volontaire. T8–T9 : intérêt légitime d'IMA (sécurité) et obligation légale (art. 4 AI Act, art. 32 RGPD).

### 2.4 Qualification des données (point clé)

| Donnée | Qualification proposée | Raison |
| --- | --- | --- |
| Réponses brutes pendant la collecte et jusqu'à leur suppression | **Pseudonymisées** (données personnelles) | Une personne disposant à la fois d'un accès technique à la base et d'informations extérieures pourrait en théorie isoler une réponse (groupe + date) |
| Résultats de groupes d'au moins 10 personnes, avec masquage complémentaire | **Anonymes**, sous réserve | Critères « isoler, relier, déduire » respectés ; réserve : comparaison entre deux campagnes successives (ANONYMAT § 3.4) |
| Avis sur les ateliers | Pseudonymisés si commentaire libre | Dans un petit groupe, on peut reconnaître quelqu'un à ce qu'il écrit |
| Empreinte de l'adresse réseau (limitation des requêtes) | Pseudonyme, 24 h | HMAC avec clé secrète et changement quotidien ; jamais reliée aux réponses **[JURISTE]** |

## 3. Nécessité et proportionnalité

| Principe | Mesures en place |
| --- | --- |
| Minimisation | Aucune identité, aucune variable démographique, aucune heure, aucune adresse IP enregistrée avec les réponses, aucune case de texte libre dans les questionnaires ; une seule variable de regroupement |
| Seuil de 10 | Contrainte en base de données ; seuil appliqué échelle par échelle ; masquage complémentaire contre la soustraction ; aucun calcul pendant la collecte |
| Limitation de la conservation | Codes supprimés à la clôture ; réponses brutes supprimées 12 mois après l'acceptation du rapport (18 mois après la clôture au plus tard) ; inscriptions aux ateliers 30 jours après l'atelier ; avis d'ateliers 24 mois ; journal 24 mois ; compteurs de requêtes 24 h. Sauvegardes : les données supprimées restent jusqu'à 14 jours dans les sauvegardes automatiques d'OVH (offre « Production ») et jusqu'à environ 3 mois dans les copies chiffrées mensuelles d'IMA (3 dernières gardées) — voir `docs/lancement/BASE-DE-DONNEES.md`. **[À DÉCIDER]** : résultats, rapports et comptes (« contrat + 1 an » proposé, pas encore automatisé) |
| Exactitude | Réponses non modifiables après envoi ; rapport validé par un praticien IMA formé, puis accepté par le client |
| Information des personnes | Page d'information avant le questionnaire (finalité, anonymat, durées, droit de ne pas répondre, usage de l'IA, numéros d'aide) ; page Confidentialité en 4 langues ; mention sur la page d'inscription aux ateliers |
| Droits des personnes | Accès, rectification et effacement impossibles pour les réponses (aucune identification possible : art. 11 RGPD) — à expliquer dans l'information ; droits exerçables pour les comptes et les inscriptions aux ateliers |
| Participation volontaire | Droit de ne pas répondre à chaque question ; ateliers volontaires ; engagement du client de ne jamais utiliser la participation pour évaluer un travailleur (contrat type) |
| Sous-traitants | Voir § 5 |

## 4. Risques pour les personnes

Échelle : gravité et vraisemblance de 1 (négligeable) à 4 (maximale), **après** les mesures existantes. Cotation proposée par l'agent juridique, **à revoir par le juriste**.

| # | Risque | Source | Gravité | Vraisemblance | Mesures existantes | Mesures à ajouter |
| --- | --- | --- | --- | --- | --- | --- |
| R1 | Un employeur identifie la réponse d'un travailleur | Liste « qui a reçu quel code » ; petit groupe ; recoupement | 4 | 1 | Distribution au hasard (consigne affichée) ; seuil de 10 ; masquage complémentaire ; aucun écran de réponses individuelles | Clause « distribution au hasard » dans le contrat type ; mention dans le kit du référent |
| R2 | Accès technique illégitime aux réponses brutes | Personne ayant accès à la base, journaux internes, sauvegardes | 3 | 1 | Codes non stockés (HMAC) ; écriture en deux transactions ; réponses mélangées à la clôture | **[À DÉCIDER]** liste nominative des accès à la base, comptes personnels, journalisation OVH ; revue de sécurité externe |
| R3 | Fuite de données (piratage) | Attaque sur l'application ou un sous-traitant | 3 | 2 | HTTPS, HSTS, connexion chiffrée à la base, second facteur obligatoire pour IMA, liens de connexion à usage unique, limitation des requêtes | Politique de sécurité du contenu (CSP) ; suivi des erreurs ; revue de sécurité externe ; procédure de violation (72 h) |
| R4 | Utilisation des résultats pour sanctionner un groupe ou une personne | Mauvais usage par l'employeur | 3 | 2 | Résultats collectifs seulement ; règle de langage du rapport ; information du CPPT | Engagement contractuel du client ; rappel dans le rapport |
| R5 | Transfert hors UE (États-Unis) mal encadré | Anthropic, Vercel, Brevo | 2 | 2 | Seulement des moyennes de groupes et des notes filtrées envoyées à l'IA ; aucune donnée de répondant | DPA vérifiés ; clauses contractuelles types ou Data Privacy Framework (recours C-703/25 P pendant) ; demande de conservation nulle (ZDR) à Anthropic ; Brésil : clauses-types de l'ANPD |
| R6 | Le conseiller en prévention colle des données personnelles dans l'aide à la rédaction | Erreur humaine | 3 | 2 | Filtre des e-mails, téléphones, numéros d'identification et IBAN ; engagement « aucune donnée personnelle » ; types individuels exclus ; rien n'est conservé | Formation des conseillers ; rappel dans les conditions d'utilisation |
| R7 | Un commentaire libre d'atelier permet d'identifier son auteur | Petit groupe | 2 | 2 | Résultats affichés à partir de 5 avis ; filtre des e-mails et téléphones | Information honnête des participants (fait sur la page d'inscription) |
| R8 | Détresse d'un répondant pendant le questionnaire | Sujet sensible | 3 | 2 | Numéros d'aide affichés ; aucun diagnostic ; rappel que l'outil n'est pas un service d'urgence | Validation de la liste des numéros par pays |
| R9 | Conservation trop longue | Durées non automatisées | 2 | 2 | Suppressions automatiques déjà en place pour les réponses, inscriptions, journal, compteurs | Automatiser la suppression des résultats, rapports et comptes |

## 5. Sous-traitants ultérieurs **[À VÉRIFIER dans chaque compte]**

| Sous-traitant | Rôle | Données | Localisation | Garanties à documenter |
| --- | --- | --- | --- | --- |
| OVHcloud | Base de données PostgreSQL | Toutes | UE (région à choisir) | DPA ; chiffrement au repos ; durée des sauvegardes ; accès des équipes OVH |
| Vercel | Hébergement de l'application | En transit ; journaux techniques (IP, heure) | Société américaine, fonctions en UE | DPA ; durée des journaux ; aucun « log drain » ; offre Pro |
| Brevo | E-mails (connexion, ateliers, rappels) | Nom et e-mail des référents et des inscrits | France ; transferts mentionnés | DPA ; mécanisme de transfert ; suivi des ouvertures et des clics désactivé ; domaine d'envoi authentifié |
| Anthropic | IA (brouillon de rapport, aide à la rédaction) | Moyennes de groupes ; notes filtrées | États-Unis | DPA ; ZDR ; clauses contractuelles types ; Brésil : clauses-types de l'ANPD (e-mail envoyé ou à envoyer à privacy@anthropic.com) |

## 6. AI Act (pour mémoire)

- Brouillons IA toujours relus et validés par un praticien formé (art. 4, maîtrise de l'IA, en vigueur depuis le 02/02/2025) ; mention « préparé avec l'aide de l'IA » (art. 50).
- Pas de reconnaissance des émotions, pas d'évaluation de personnes : position proposée « hors annexe III » **[JURISTE]**, voir le guide interne « Utiliser l'IA dans InnerOS ».

## 7. Plan d'action avant la première campagne réelle

1. Juriste : trancher les points **[JURISTE]** (rôles, bases légales, art. 9, qualification des données).
2. Michelle : décider les points **[À DÉCIDER]** (date de réponse, comparaison entre campagnes, durées des résultats et comptes, accès à la base).
3. Michelle : vérifier les DPA et réglages des 4 sous-traitants (§ 5) et joindre les PDF à ce dossier.
4. Claude : automatiser les durées restantes, ajouter la CSP et le suivi des erreurs (étape 10).
5. Développeur externe : revue de sécurité.
6. Client : adapter cette AIPD à son organisation, informer le CPPT (Belgique), le CSE (France), les représentants (Portugal) ou la CIPA (Brésil).
7. Signature et date de l'AIPD par le responsable du traitement.

## 8. Avis du DPO et des représentants des travailleurs

**[À COMPLÉTER]** — art. 35.2 (avis du DPO s'il est désigné) et art. 35.9 (avis des personnes concernées ou de leurs représentants, le cas échéant).

---

*Sources consultées le 03/11/2026 : APD, page « Analyse d'impact relative à la protection des données » (renvoi à la décision 01/2019 et aux critères WP248) ; règlement (UE) 2016/679, art. 9, 11, 28, 30, 35 ; Code du bien-être au travail, version du 13/06/2026, livre I, titre 3. Ceci n'est pas un avis juridique. Pour toute décision engageante, faites valider par un avocat, un DPO ou un expert en prévention.*
