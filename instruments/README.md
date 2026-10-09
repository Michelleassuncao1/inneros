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
