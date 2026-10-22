# Format d'échange InnerOS → PluriPrev

**Format** : `inneros.plan-prevention` · **version** : `1.0` · **date** : 22/10/2026
**Description technique** : [`inneros-plan-prevention-1.0.schema.json`](inneros-plan-prevention-1.0.schema.json) (JSON Schema, généré depuis le code d'InnerOS : `lib/plan/export.ts`).

Ce document s'adresse à l'équipe (et au Claude) qui construit **PluriPrev**. Il décrit le fichier qu'InnerOS (module RPS) produit pour qu'une entreprise équipée des deux outils puisse intégrer son plan RPS dans le plan global de prévention de PluriPrev.

## Principes

1. **InnerOS peut être vendu seul.** Le fichier est un export ponctuel téléchargé par IMA ou le conseiller en prévention ; il n'y a pas de connexion directe entre les deux applications (version 1.0).
2. **Aucune donnée personnelle.** Ni nom de personne, ni nom d'entreprise (code interne seulement), ni réponse individuelle, ni résultat sur moins de 10 personnes. Les responsables d'actions sont des **fonctions** (« Direction », « RH »), jamais des noms. Les questions internes à IMA ne sont jamais exportées.
3. **Seul un plan validé par IMA est exportable.** L'adoption par l'employeur est indiquée si elle a eu lieu.
4. **Réimport sans doublon.** Chaque action porte une `cle_dedoublonnage` stable : `inneros:<id du plan>:<id de l'action>`. PluriPrev peut la stocker dans `preventive_action.dedup_key`.
5. **Compatibilité.** Un changement non rétrocompatible change la version majeure (`2.0`). Un ajout de champ facultatif change la version mineure (`1.1`). PluriPrev doit refuser une version majeure inconnue.

## Structure

| Bloc | Contenu |
|---|---|
| `format`, `version`, `genere_le`, `source` | Identification du fichier (InnerOS, Institut Mindset en Action). |
| `organisation` | `code_interne`, `pays` (BE, FR, BR, PT), `secteur`, `tranche_effectif` (`lt50`, `50-249`, `250-999`, `1000+`). |
| `plan` | Plan global de prévention RPS sur 5 ans (`annee_debut` → `annee_fin`), langue, date de validation, `redige_avec_ia`, `adoption` (date, organe consulté, date de l'avis), objectifs, mesures, moyens, rôles, calendrier, évaluation, cadre légal. Domaine : toujours `psychosocial`. |
| `risques` | Registre des risques RPS de l'entreprise (voir ci-dessous). |
| `actions` | Plan d'action de l'année `annee_debut`, avec l'avancement (voir ci-dessous). |

### Risques

| Champ | Signification | Correspondance PluriPrev |
|---|---|---|
| `id` | Identifiant du risque dans InnerOS (UUID) | `risk_assessment` : à conserver comme référence externe |
| `domaine` | `psychosocial` | `domain` |
| `intitule`, `description` | Rédigés par IMA ou le conseiller en prévention, sans nom | `hazard`, `situation` |
| `origine` | `echelle` (résultat de diagnostic), `comportement` (comportement indésirable signalé), `manuel` | — |
| `niveau_mindset`, `groupes` | Niveau de la méthode MINDSET® ; groupes de 10 personnes ou plus | `org_unit` à rapprocher par l'utilisateur |
| `methode` | `{ code: "KINNEY", composantes: { P, E, G } }`, valeurs de la grille Kinney classique | `method_version` « KINNEY », `initial_components` |
| `score`, `classe` | P × E × G ; `tres_eleve` > 400, `eleve` > 200, `important` > 70, `possible` > 20, `acceptable` | `initial_score`, `initial_level` |
| `priorite` | `immediate` (très élevé), `high` (élevé), `medium` (important), `low` (possible, acceptable) | `priority` |
| `justification`, `statut` | Justification des valeurs ; `ouvert`, `traite`, `clos` | `justification`, `status` |

Un comportement indésirable signalé (harcèlement, violence…) est toujours au moins de classe `eleve`, quel que soit son score.

### Actions

| Champ | Signification | Correspondance PluriPrev |
|---|---|---|
| `id`, `cle_dedoublonnage` | Identifiants stables | `dedup_key` |
| `titre`, `description`, `indicateur` | Contenu de l'action | `title`, `description` |
| `risques` | Identifiants des risques visés | `action_source` (type `risk`) |
| `niveau_prevention` | `primaire`, `secondaire`, `tertiaire` | — |
| `responsable_fonction` | Fonction responsable (jamais un nom) | à rapprocher d'un `owner_id` par l'utilisateur |
| `annee`, `trimestre`, `echeance` | Échéance = dernier jour du trimestre | `due_date` |
| `effort`, `budget` | `simple`, `moyen`, `important` ; budget en mots | `budget` (numérique : à chiffrer dans PluriPrev) |
| `priorite` | La plus haute priorité des risques visés | `priority` |
| `statut`, `statut_pluriprev` | `a_faire`→`proposed`, `en_cours`→`accepted`, `realisee`→`closed`, `reportee`→`reopened`, `abandonnee`→`cancelled` | `status` |
| `realisee_le`, `commentaire` | Date de réalisation, commentaire sans nom | `closed_at`, `evidence.note` |

## Point à trancher côté PluriPrev

Dans PluriPrev, le domaine `psychosocial` est actuellement décrit comme utilisant des « méthodes spécialisées, pas de score Kinney » (`src/server/domains.ts`, méthode `PSICOSSOCIAL-BR` au Brésil). InnerOS évalue les risques psychosociaux avec la matrice Kinney (décision d'IMA du 19/10/2026). Pour importer ce fichier, PluriPrev doit donc **autoriser la méthode KINNEY pour le domaine psychosocial**, ou convertir la classe Kinney vers sa méthode psychosociale (par exemple via la `priorite`).

## Exemple minimal

```json
{
  "format": "inneros.plan-prevention",
  "version": "1.0",
  "genere_le": "2027-01-20T10:00:00.000Z",
  "source": { "application": "InnerOS", "editeur": "Institut Mindset en Action" },
  "organisation": { "code_interne": "ORG-AB12", "pays": "BE", "secteur": "Soins", "tranche_effectif": "50-249" },
  "plan": { "id": "…", "domaine": "psychosocial", "annee_debut": 2027, "annee_fin": 2031, "langue": "fr", "valide_le": "2027-01-10", "redige_avec_ia": true, "adoption": null, "…": "…" },
  "risques": [
    { "id": "…", "domaine": "psychosocial", "origine": "comportement", "intitule": "Menaces de violence", "methode": { "code": "KINNEY", "composantes": { "P": 10, "E": 6, "G": 40 } }, "score": 2400, "classe": "tres_eleve", "priorite": "immediate", "…": "…" }
  ],
  "actions": [
    { "id": "A1", "cle_dedoublonnage": "inneros:…:A1", "titre": "Procédure de signalement", "responsable_fonction": "RH", "annee": 2027, "trimestre": 1, "echeance": "2027-03-31", "priorite": "immediate", "statut": "a_faire", "statut_pluriprev": "proposed", "…": "…" }
  ]
}
```
