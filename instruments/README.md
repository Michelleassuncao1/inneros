# Instruments (questionnaires)

Placez ici les fichiers officiels reçus des détenteurs des questionnaires :

- **COPSOQ III** — version nationale validée (une par langue), sans les items d'engagement au travail (WE) ;
- **CBI** — domaine public (Kristensen et al., 2005) ; versions validées à vérifier pour chaque langue ;
- **Flourishing Scale** — libre d'utilisation avec citation de Diener et al. ; traductions validées pour chaque langue.

Claude Code les convertit dans le format JSON du projet **sans modifier un seul mot** (règle 9 de `CLAUDE.md`).

## Format (version 2)

Un fichier par questionnaire, par version et par langue, par exemple `copsoq3-<version>.fr.json`.
Le format est défini et vérifié par `lib/instruments/format.ts`. Les fichiers de `test/` en sont des exemples
complets, avec des items fictifs marqués « ITEM DE TEST ».

- `instrument`, `version`, `langue`, `titre`, `source` (citation complète), `licence`, `test` ;
- `echelles_reponse` : les échelles de réponse (code numérique et libellé de chaque option) ;
- `dimensions` : les dimensions, chacune avec ses items (`id`, `texte`, échelle de `reponse`, `sens` direct ou inverse),
  une `consigne` facultative et le `niveau_mindset` facultatif.

Les identifiants sont **identiques dans toutes les langues** : le chargement refuse une langue dont la structure
diffère des langues déjà enregistrées.

## Chargement

```bash
npm.cmd run instruments:charger -- instruments/copsoq3-xxx.fr.json
```

Cette commande affiche seulement l'aperçu, à comparer mot à mot avec le document officiel.
Après vérification, la même commande avec `--enregistrer` à la fin enregistre le questionnaire
(serveur de développement arrêté).

## Questionnaires convertis

| Dossier | Questionnaire | Langues | Source | État |
|---|---|---|---|---|
| `copsoq3/` | COPSOQ III, version belge `be-2023-12-13` (CORE + MIDDLE, 62 items, sans WE), réservée aux entreprises belges | fr, nl, en | Excel de l'équipe nationale belge (prof. Els Clays, 13/12/2023) ; anglais : version internationale (lignes directrices 2019) | en relecture : voir `docs/relecture/copsoq3-be-relecture.html` |

Les options « je n'ai pas de supérieur / de collègues » (code 9) sont marquées `manquant` : elles comptent comme
une réponse manquante dans les scores, comme le prévoient les lignes directrices internationales.
| `flourishing/` | Flourishing Scale `diener-2009` (8 items, réponses 1 à 7), tous pays | fr, nl, en | PDF du laboratoire de Diener (FR : Villieux et al. 2016 ; NL : van Egmond & Hanke) | en relecture : voir `docs/relecture/flourishing-relecture.html` |
