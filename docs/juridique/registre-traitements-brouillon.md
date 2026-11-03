# Registre des activités de traitement — Institut Mindset en Action® (IMA)

> **BROUILLON n° 1 du 03/11/2026**, préparé par l'agent juridique IMA (IA). **À relire et valider par un juriste ou un DPO.** Ceci n'est pas un avis juridique.
>
> L'article 30 RGPD demande deux registres : l'un pour les traitements dont IMA est **responsable** (art. 30.1), l'autre pour ceux qu'IMA réalise **pour le compte de ses clients** comme sous-traitant (art. 30.2). Ce registre couvre l'application PluriPrev – RPS (InnerOS). Les autres activités d'IMA (site web, prospection, comptabilité, accompagnements individuels) sont à ajouter **[À COMPLÉTER]**.
>
> Voir aussi : [AIPD (brouillon)](AIPD-brouillon.md), [flux de données](../securite/FLUX-DE-DONNEES.md).

## Identification

| | |
| --- | --- |
| Responsable / sous-traitant | Michelle Assunção, indépendante en personne physique, exploitant l'Institut Mindset en Action® |
| Adresse | **[À COMPLÉTER : adresse d'établissement]** |
| Numéro d'entreprise (BCE) | **[À COMPLÉTER]** |
| Contact protection des données | info@institutmindsetenaction.com |
| Délégué à la protection des données (DPO) | **[JURISTE : désignation obligatoire ou non ? (art. 37 RGPD)]** |
| Mise à jour | 03/11/2026 |

---

## Partie A — Traitements dont IMA est responsable (art. 30.1)

| Champ | A1. Comptes des praticiens IMA et formation IA | A2. Journal d'audit et sécurité du service | A3. Clients et contrats (gestion commerciale liée à PluriPrev – RPS) |
| --- | --- | --- | --- |
| Finalités | Accès sécurisé à l'espace IMA ; preuve de la maîtrise de l'IA (art. 4 AI Act) | Tracer les actions des comptes, détecter les abus, protéger le service (limitation des requêtes) | Contrats, facturation, relation client |
| Base légale | Intérêt légitime (sécurité) ; obligation légale (art. 4 AI Act) | Intérêt légitime ; obligation de sécurité (art. 32 RGPD) | Contrat (art. 6.1.b) ; obligations comptables (art. 6.1.c) |
| Personnes concernées | Praticiens IMA | Praticiens, référents des clients ; appareils des visiteurs | Contacts des entreprises clientes |
| Données | Nom, e-mail, rôle, empreinte du mot de passe (scrypt), secret du second facteur chiffré, progression et certificat de formation | Action, date et heure, compte, cible ; compteur d'échecs de connexion (empreinte de l'e-mail) ; empreinte HMAC quotidienne de l'adresse réseau | Nom, fonction, e-mail, téléphone, données de facturation |
| Destinataires | IMA | IMA | IMA, comptable **[À COMPLÉTER]** |
| Sous-traitants | OVHcloud, Vercel, Brevo (e-mails) | OVHcloud, Vercel | **[À COMPLÉTER : logiciel de facturation…]** |
| Transferts hors UE | Vercel (États-Unis, fonctions en UE), Brevo (selon DPA) | Vercel | **[À COMPLÉTER]** |
| Durée | Durée de la fonction + 1 an **[À DÉCIDER]** ; certificat de formation : **[À DÉCIDER]** | Journal 24 mois ; compteurs de requêtes 24 h ; compteurs d'échecs 15 min après blocage | Contrat + délai de prescription ; pièces comptables 7 ans en Belgique **[À VÉRIFIER]** |
| Sécurité | Second facteur obligatoire, sessions de 8 h, blocage après 5 échecs | Journal sans donnée de répondant ; aucune adresse réseau en clair | **[À COMPLÉTER]** |

## Partie B — Traitements réalisés pour le compte des clients (art. 30.2)

Une ligne par client est tenue dans l'espace IMA (liste des entreprises) ; les catégories ci-dessous sont communes à tous les clients.

| Champ | B1. Enquêtes anonymes RPS | B2. Comptes des référents | B3. Plan de prévention, registre des risques, calendrier | B4. Ateliers : inscriptions et présences | B5. Avis anonymes sur les ateliers | B6. Aide à la rédaction (IA) |
| --- | --- | --- | --- | --- | --- | --- |
| Responsable du traitement | L'entreprise cliente | L'entreprise cliente | L'entreprise cliente | L'entreprise cliente | L'entreprise cliente **[À DÉCIDER si IMA réutilise les avis]** | L'entreprise cliente |
| Catégories de traitements faits par IMA | Création des codes, hébergement, calcul des résultats de groupes ≥ 10, brouillon IA, rapport | Hébergement, envoi des liens de connexion | Hébergement, rappels | Hébergement, e-mails de confirmation et de rappel, liste des présents | Hébergement, résultats à partir de 5 avis | Envoi des notes à l'IA, mise en forme Word |
| Personnes | Travailleurs | Référents | Référents ; personnes citées | Travailleurs inscrits | Participants | Aucune en principe |
| Données | Groupe, date du jour, réponses chiffrées, versions (pseudonymisées) ; codes (empreintes) jusqu'à la clôture | Nom, e-mail, rôle | Textes saisis | Nom, e-mail professionnel, présence | Notes, commentaire libre, date | Notes filtrées (aucun nom d'entreprise) |
| Sous-traitants ultérieurs | OVHcloud, Vercel, Anthropic (moyennes seulement) | OVHcloud, Vercel, Brevo | OVHcloud, Vercel, Brevo | OVHcloud, Vercel, Brevo | OVHcloud, Vercel | Anthropic, OVHcloud, Vercel |
| Transferts hors UE | Anthropic (États-Unis) : moyennes de groupes seulement | Brevo (selon DPA) | Brevo (selon DPA) | Brevo (selon DPA) | — | Anthropic (États-Unis) ; Brésil : bloqué tant que les clauses-types de l'ANPD ne sont pas confirmées |
| Durée | Codes : jusqu'à la clôture ; réponses brutes : 12 mois après l'acceptation du rapport, 18 mois après la clôture au plus tard ; résultats et rapport : **[À DÉCIDER]** | Contrat + 1 an **[À DÉCIDER]** | Contrat + 1 an **[À DÉCIDER]** | 30 jours après l'atelier | 24 mois | Rien n'est conservé (journal sans contenu) |
| Mesures de sécurité (art. 32) | Voir AIPD § 3 et ANONYMAT-ET-SECURITE.md | Liens à usage unique (15 min), empreintes | Droits par organisation, journal | Accès limité au conseiller en prévention et à l'animateur | Jamais relié à l'inscription | Filtre des coordonnées, 10 brouillons par jour |

## Mesures générales de sécurité (art. 30.1.g et 30.2.d)

Chiffrement en transit (HTTPS, HSTS) et vers la base ; secrets hors du code ; second facteur pour IMA ; journal d'audit ; limitation des requêtes ; suppressions automatiques chaque nuit ; tests automatisés de l'anonymat ; revue de sécurité externe prévue avant le lancement. Chiffrement de la base au repos : **[À VÉRIFIER chez OVH]**.

---

*Sources : règlement (UE) 2016/679, art. 28, 30, 32 et 37, consulté le 03/11/2026. Ceci n'est pas un avis juridique. Pour toute décision engageante, faites valider par un avocat, un DPO ou un expert en prévention.*
