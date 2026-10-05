# Charte graphique InnerOS — déclinaison de l'identité IMA

InnerOS doit être reconnu immédiatement comme un outil de l'Institut Mindset en Action® : même bleu nuit, même or, même sobriété institutionnelle que le site et les documents IMA. Les valeurs ci-dessous sont relevées sur les documents officiels IMA (septembre 2026) ; l'étape 1 bis du guide de prompts les compare au site `institutmindsetenaction.com` et corrige les écarts.

## 1. Couleurs

| Rôle | Token | Hex | Usage |
| --- | --- | --- | --- |
| Bleu nuit IMA | `ima-navy` | #07275A | Titres, barre de navigation, boutons principaux, pied de page |
| Bleu nuit profond | `ima-navy-deep` | #051C42 | Survol des boutons, fond de la vague |
| Or IMA | `ima-gold` | #BD903B | Filets, cercle du logo, anneau de focus, détails sur fond bleu nuit |
| Or lisible | `ima-gold-text` | #8A651F | Seule teinte dorée autorisée pour du texte sur fond clair |
| Crème | `ima-cream` | #F3EBDD | Encadrés, bandeaux d'information, en-têtes de tableaux secondaires |
| Papier | `ima-paper` | #FAF8F3 | Fond de page |
| Encre | `ima-ink` | #262626 | Texte courant |
| Gris | `ima-muted` | #5A5A5A | Texte secondaire, légendes |

Contrastes vérifiés (WCAG) : encre sur papier 14:1, bleu nuit sur papier 13,7:1, or sur bleu nuit 5:1, or lisible sur papier 5:1. L'or #BD903B sur blanc n'atteint que 2,9:1 : jamais pour du texte courant.

**Repères d'interprétation** (tableau de bord et rapport) : favorable #2F6B4F, vigilance #9A6A00, prioritaire #B4462E, sans référence #5A5A5A. Chaque couleur est toujours accompagnée de son libellé (« favorable », « vigilance », « prioritaire »), jamais de la couleur seule.

## 2. Typographie

- Titres : serif à forte présence (proposition : Source Serif 4, gras, bleu nuit), comme les titres des documents IMA.
- Interface et texte : sans-serif lisible (proposition : Source Sans 3), 16 px minimum, interligne 1,5.
- Mention de marque « INSTITUT MINDSET EN ACTION® » : capitales, or lisible, uniquement dans l'en-tête et la page de garde des rapports.
- Lignes de texte limitées à environ 70 caractères.

Si le site IMA utilise d'autres polices, ce sont elles qui priment : l'étape 1 bis les reprend.

## 3. Signature visuelle

La signature d'IMA est **la vague bleu nuit soulignée d'un filet or**, en bas des documents, avec **le logo circulaire cerclé d'or**. InnerOS la reprend une seule fois par écran :

- en pied de page de l'espace administrateur et de l'espace référent ;
- en bas de la page d'accueil du questionnaire ;
- en pied de chaque page des rapports PDF, comme dans les documents IMA.

Le reste de l'interface reste calme : fonds papier, filets fins, pas de dégradés, pas d'ombres lourdes.

## 4. Logo

- Fichier provisoire : `assets/logo-ima-provisoire.png` (extrait des documents IMA, basse définition). **À remplacer par le fichier officiel du logo (SVG ou PNG haute définition)** avant la mise en ligne.
- Toujours sur fond clair ou dans son cercle blanc cerclé d'or ; jamais déformé, jamais recoloré.
- Taille minimale : 40 px de diamètre à l'écran.

## 5. Composants

| Composant | Règle |
| --- | --- |
| Bouton principal | Fond bleu nuit, texte blanc, rayon 8 px ; survol bleu nuit profond |
| Bouton secondaire | Bordure bleu nuit 1 px, texte bleu nuit, fond transparent |
| Champs de formulaire | Fond blanc, bordure `ima-line`, rayon 4 px, libellé toujours visible au-dessus |
| Encadré d'information | Fond crème, filet or de 3 px à gauche |
| Tableaux | En-tête bleu nuit texte blanc (comme les documents IMA), lignes séparées par des filets fins |
| Bandeau « Brouillon IA — non validé » | Fond crème, texte or lisible, toujours visible au-dessus d'un brouillon |
| Focus clavier | Anneau or 3 px sur tous les éléments interactifs |

## 6. Ton des textes

- Français et portugais du Brésil, vouvoiement en français, « você » en portugais.
- Phrases courtes, verbes d'action, aucune promesse de résultat de santé.
- Le questionnaire rassure avant de questionner : anonymat, durée, droit de ne pas répondre, ressources d'aide.
- Les boutons disent ce qu'ils font : « Commencer le questionnaire », « Valider le rapport », « Générer les jetons ».

## 7. Accessibilité

Niveau AA minimum : contraste, navigation complète au clavier, libellés de formulaires, textes alternatifs, respect de « réduire les animations », responsive dès 360 px de large.
