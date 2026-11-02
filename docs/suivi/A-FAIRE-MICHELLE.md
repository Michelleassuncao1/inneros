# À faire — Michelle (IMA)

Liste des actions qui ne dépendent pas du code. Claude la relit et la rappelle à chaque fin d'étape.

## Contrats et juridique

### À intégrer au contrat type, au DPA et à la page « Confidentialité »

À reprendre **au moment de la rédaction du contrat type avec les entreprises**, puis à faire relire par un juriste. Liste tenue par l'agent juridique IMA.

- [ ] **Contrat type — clause « recherche »** : **clause rédigée par l'agent juridique le 29/10/2026** dans `docs/juridique/clauses-contrat-type.md` (article X, accord facultatif de l'entreprise, groupes de 10 minimum, jamais le nom, retrait possible, engagements des chercheurs, note Brésil). À insérer dans le contrat type et à faire relire par l'avocat. Ensuite : ajouter une phrase « recherche » à la page Confidentialité et rédiger la convention avec l'équipe de recherche (UGent, prof. Els Clays) au premier partage.
- [ ] **Contrat type — ateliers (module C)** : l'entreprise est responsable des inscriptions aux ateliers ; IMA est son sous-traitant (art. 28 RGPD ; « operador » au Brésil, LGPD). Un animateur IMA qui anime un atelier agit dans ce même cadre. Si IMA veut utiliser les avis des ateliers pour améliorer ses propres prestations, le prévoir explicitement (finalité propre d'IMA, résultats agrégés uniquement). *Agent juridique, 27/10/2026.*
- [ ] **Contrat type — engagements de l'entreprise pour les ateliers** : participation volontaire ; présence et avis jamais utilisés pour évaluer ou sanctionner un travailleur ; information du CPPT (Belgique), du CSE (France), des représentants des travailleurs (Portugal) ou de la CIPA (Brésil) ; information des travailleurs (texte fourni par InnerOS sur la page d'inscription).
- [ ] **DPA (contrat de sous-traitance)** : ajouter le traitement « inscriptions aux ateliers » (nom, e-mail professionnel, présence) ; finalités (organisation, confirmation, rappel, liste des présents) ; durée (suppression 30 jours après l'atelier ; l'entreprise peut exporter la liste des présents avant, par exemple comme preuve de formation des managers) ; sous-traitants ultérieurs (Brevo pour les e-mails, OVHcloud, Vercel) ; accès limité au conseiller en prévention et à l'animateur.
- [ ] **Page « Confidentialité » d'InnerOS** : ajouter une partie « Ateliers » (qui est responsable, données collectées, durée, droits et à qui s'adresser) et expliquer que l'avis est séparé de l'inscription. Ne pas promettre que le texte libre est « anonyme » dans tous les cas : dans un petit groupe, on peut reconnaître quelqu'un à ce qu'il écrit. *Claude prépare le texte pendant le module C ; à faire relire par le juriste.*

### Autres points

- [x] Portugal : cadre légal du plan de prévention corrigé sur la version consolidée (prompt `plan-v1.4`, 26/10/2026) ; à inclure dans la relecture par le juriste.

### Relecture par un juriste

Documents déjà relus et corrigés par l'agent juridique IMA (dernière relecture : 02/11/2026). Ils restent « à valider » : un vrai juriste doit les relire avant le lancement.

- [ ] **Contrat type** : [clauses à intégrer, dont la clause « recherche »](https://github.com/Michelleassuncao1/inneros/blob/main/docs/juridique/clauses-contrat-type.md) et les points ci-dessus (ateliers, DPA, page Confidentialité).
- [ ] **Guide interne « Utiliser l'IA dans InnerOS » v1.0** : https://claude.ai/artifact/SpVKPZd85cfz9KwtwNap6D, avec la confirmation qu'InnerOS n'est pas un système à haut risque (AI Act, annexe III) et l'information du CPPT (Belgique) ou du CSE (France) chez les clients.
- [ ] **Page Confidentialité** (parties questionnaires et ateliers) : [textes dans les 4 langues](https://github.com/Michelleassuncao1/inneros/blob/main/lib/confidentialite/textes.ts).
- [ ] **Modèles psychosociaux (Belgique)**, priorité : [demande d'intervention psychosociale formelle (PDF)](https://github.com/Michelleassuncao1/inneros/blob/main/data/modeles/fichiers/BE/fr/be-fr-demande-intervention-formelle.pdf), [fiche d'entretien (PDF)](https://github.com/Michelleassuncao1/inneros/blob/main/data/modeles/fichiers/BE/fr/be-fr-fiche-entretien.pdf) et [avis du conseiller en prévention aspects psychosociaux (PDF)](https://github.com/Michelleassuncao1/inneros/blob/main/data/modeles/fichiers/BE/fr/be-fr-avis-cpap.pdf) (secret professionnel ; articles I.3-14, I.3-15, I.3-24 à I.3-27 et I.3-35, version du Code du 13/06/2026).
- [ ] **Dossier RGPD à faire relire** (à préparer avant le lancement) : analyse d'impact (AIPD), à rédiger à partir des documents de travail [flux de données](https://github.com/Michelleassuncao1/inneros/blob/main/docs/securite/FLUX-DE-DONNEES.md) et [anonymat et sécurité](https://github.com/Michelleassuncao1/inneros/blob/main/docs/securite/ANONYMAT-ET-SECURITE.md) ; registre des traitements d'IMA (à rédiger) ; mentions légales de PluriPrev – RPS (page à créer) ; DPA signés (à télécharger en PDF dans chaque compte : Anthropic, Brevo, OVHcloud, Vercel).
- [ ] **Assurance** : demander à votre courtier une RC professionnelle couvrant l'édition et l'hébergement de logiciel (erreurs, IA) **et** une assurance cyber (fuite de données) ; vérifier si la RC pro actuelle d'IMA exclut les activités informatiques.
- [ ] **Autres modèles IMA (Belgique)** : [plan global de prévention](https://github.com/Michelleassuncao1/inneros/blob/main/data/modeles/fichiers/BE/fr/be-fr-plan-global-prevention.pdf), [plan d'action annuel](https://github.com/Michelleassuncao1/inneros/blob/main/data/modeles/fichiers/BE/fr/be-fr-plan-action-annuel.pdf), [PV du CPPT](https://github.com/Michelleassuncao1/inneros/blob/main/data/modeles/fichiers/BE/fr/be-fr-pv-cppt.pdf), [fiche de sensibilisation](https://github.com/Michelleassuncao1/inneros/blob/main/data/modeles/fichiers/BE/fr/be-fr-fiche-sensibilisation.pdf), [déroulé d'atelier](https://github.com/Michelleassuncao1/inneros/blob/main/data/modeles/fichiers/BE/fr/be-fr-deroule-atelier.pdf).
- [ ] **Modèles Brésil**, par un professionnel brésilien (NR-1, NR-5) : [plano de ação do PGR](https://github.com/Michelleassuncao1/inneros/blob/main/data/modeles/fichiers/BR/pt-BR/br-pt-plano-acao-pgr.pdf), [ata da CIPA](https://github.com/Michelleassuncao1/inneros/blob/main/data/modeles/fichiers/BR/pt-BR/br-pt-ata-cipa.pdf), [ficha de sensibilização](https://github.com/Michelleassuncao1/inneros/blob/main/data/modeles/fichiers/BR/pt-BR/br-pt-ficha-sensibilizacao.pdf), [roteiro de oficina](https://github.com/Michelleassuncao1/inneros/blob/main/data/modeles/fichiers/BR/pt-BR/br-pt-roteiro-oficina.pdf).
- [ ] **Prompts de l'IA** : [aide à la rédaction](https://github.com/Michelleassuncao1/inneros/blob/main/prompts/aide-redaction.system.md), [plan de prévention (cadres légaux par pays)](https://github.com/Michelleassuncao1/inneros/blob/main/prompts/plan-prevention.system.md), [rapport](https://github.com/Michelleassuncao1/inneros/blob/main/prompts/redaction-rapport.system.md).

## InnerOS

- [ ] Suivre la formation « IMA Talks — Utiliser l'IA dans InnerOS » (espace IMA > Formation IA) puis enregistrer votre formation : nécessaire pour valider rapports, plans et thèmes.
- [ ] Relire `docs/relecture/risques-relecture.html` : grille Kinney, exemples de gravité, règles de probabilité et de gravité proposées, côté défavorable des échelles.
- [ ] Relire les choix de méthode du plan (prompt `prompts/plan-prevention.system.md`) : nouveau diagnostic au plus tard en année 3, évaluation à mi-parcours, 3 à 5 actions « importantes » par an.
- [ ] Relire et valider les 12 thèmes de sensibilisation (espace IMA > Sensibilisation) : kits français rédigés par l'IA le 23/10/2026. Faire relire « Prendre soin les uns des autres » (prévention du suicide) et « Le respect au travail » (harcèlement, violence) par un professionnel ; puis faire rédiger les autres langues (bouton IA par langue).
- [ ] **Valider les modèles** (module D1) : espace IMA › onglet « Modèles » (votre serveur : http://localhost:3000/fr/admin/modeles). Ils deviennent visibles pour les conseillers en prévention du pays une fois validés : formulaires officiels du SPF (rapport annuel du SIPP 2025, A, B, C et notice, en français et en néerlandais : contenu officiel, seule la mise en page IMA change) et les 12 modèles IMA, après la relecture par le juriste. Chaque année, déposer les nouveaux formulaires du SPF.
- [ ] Ateliers (module C) : regarder l'affiche PDF d'un atelier et la page d'inscription sur téléphone ; relire les 5 questions de l'avis (utile, clair, envie d'appliquer, animation, recommandation) et les textes des e-mails aux participants.
- [ ] Après une première vraie campagne : vérifier le réglage des valeurs Kinney proposées (beaucoup de risques « élevés » sur les données de démonstration).

## Au lancement (décision du 02/11/2026)

Les contrats avec Anthropic, Brevo, OVHcloud et Vercel sont déjà signés pour le site IMA (même titulaire : Michelle Assunção) : pas de deuxième signature, mais une vérification de leur portée (02/11/2026). Les vrais tests puis le lancement auront lieu quand l'application sera prête.

- [ ] **Vérifier les contrats existants** dans chaque compte : DPA bien accepté (Anthropic : Console › Settings ; Vercel : dans les conditions de l'offre Pro, obligatoire pour un usage commercial ; OVHcloud : espace client › Contrats ; Brevo : Paramètres › Sécurité / DPA). Anthropic : demander la conservation nulle des données (ZDR). Brevo : durée de conservation des e-mails, suivi des ouvertures et des clics désactivé, domaine d'envoi PluriPrev authentifié. Créer des clés séparées pour PluriPrev – RPS (jamais celles du site IMA).
- [ ] **Brésil** : l'aide à la rédaction reste bloquée tant que les clauses-types de l'ANPD ne sont pas vérifiées (Résolution CD/ANPD n° 19/2024, obligatoires depuis le 23/08/2025, article 33 de la LGPD). **Envoyer l'e-mail préparé par Claude le 02/11/2026 à privacy@anthropic.com** (ou via le support de la Console). Après leur réponse écrite seulement : `AI_WRITING_AID_BRAZIL=true`. *Vérifié par l'agent juridique le 02/11/2026.*
- [ ] **Activer l'aide à la rédaction** (module D2) après la signature du DPA d'Anthropic : `AI_WRITING_AID_ENABLED=true` dans les réglages de Vercel, puis un premier essai réel (environ 0,02 à 0,10 $ par brouillon).
- [x] **Nom public** : « PluriPrev – RPS » (décision du 02/11/2026). Faire vérifier la marque (Benelux, UE, Brésil) avant le lancement.
- [ ] **Nom de domaine** chez OVHcloud (même compte que le site IMA) : `pluriprev.com`, `pluriprev.be` et `pluriprev.eu`, libres au 02/11/2026 ; `pluriprev.com.br` demande un CPF ou un CNPJ brésilien. Application à l'adresse `app.pluriprev.com`.
- [ ] **Vrais tests** avec une entreprise pilote (campagne, rapport, plan, calendrier, ateliers, modèles), puis lancement.

## En attente d'autres personnes

- [ ] Traductions FR/NL du CBI par vos collègues (après le 20/10).
- [ ] COPSOQ III-BR : réponse de Cassia Rodrigues et de la prof. Marín Rueda.
- [ ] Articles CBI-Br (Moser 2023) et Flourishing BR (Fonseca) : à télécharger par vous (accès bloqué pour Claude).
