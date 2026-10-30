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
- [ ] Brevo : télécharger le DPA, décider la durée de conservation des e-mails, désactiver le suivi des ouvertures et des clics.
- [ ] Anthropic : signer le DPA, demander la conservation nulle des données (ZDR), encadrer le transfert vers les États-Unis. **Avant d'activer l'aide à la rédaction (module D2) en production**, et pour le Brésil : vérifier que le DPA d'Anthropic contient les clauses-types de l'ANPD (obligatoires depuis le 23/08/2025, article 33 de la LGPD).
- [ ] Faire relire par un juriste, avec les autres documents : le guide interne « Utiliser l'IA dans InnerOS » v1.0 (https://claude.ai/artifact/SpVKPZd85cfz9KwtwNap6D), la confirmation qu'InnerOS n'est pas un système à haut risque (AI Act, annexe III), et l'information du CSE (France) ou du CPPT (Belgique) chez les clients.

## InnerOS

- [ ] Suivre la formation « IMA Talks — Utiliser l'IA dans InnerOS » (espace IMA > Formation IA) puis enregistrer votre formation : nécessaire pour valider rapports, plans et thèmes.
- [ ] Relire `docs/relecture/risques-relecture.html` : grille Kinney, exemples de gravité, règles de probabilité et de gravité proposées, côté défavorable des échelles.
- [ ] Relire les choix de méthode du plan (prompt `prompts/plan-prevention.system.md`) : nouveau diagnostic au plus tard en année 3, évaluation à mi-parcours, 3 à 5 actions « importantes » par an.
- [ ] Relire et valider les 12 thèmes de sensibilisation (espace IMA > Sensibilisation) : kits français rédigés par l'IA le 23/10/2026. Faire relire « Prendre soin les uns des autres » (prévention du suicide) et « Le respect au travail » (harcèlement, violence) par un professionnel ; puis faire rédiger les autres langues (bouton IA par langue).
- [ ] Modèles (module D1) : ouvrir dans Word les formulaires A, B et C du rapport annuel du SIPP 2025 aux couleurs d'IMA (espace IMA > Modèles), vérifier qu'ils se remplissent bien, puis me dire de les marquer « validés » pour les rendre visibles aux conseillers en prévention. Chaque année, déposer les nouveaux formulaires du SPF (exercice 2026…).
- [ ] Ateliers (module C) : regarder l'affiche PDF d'un atelier et la page d'inscription sur téléphone ; relire les 5 questions de l'avis (utile, clair, envie d'appliquer, animation, recommandation) et les textes des e-mails aux participants.
- [ ] Après une première vraie campagne : vérifier le réglage des valeurs Kinney proposées (beaucoup de risques « élevés » sur les données de démonstration).

## En attente d'autres personnes

- [ ] Traductions FR/NL du CBI par vos collègues (après le 20/10).
- [ ] COPSOQ III-BR : réponse de Cassia Rodrigues et de la prof. Marín Rueda.
- [ ] Articles CBI-Br (Moser 2023) et Flourishing BR (Fonseca) : à télécharger par vous (accès bloqué pour Claude).
