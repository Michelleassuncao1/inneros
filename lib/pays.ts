// Fiche pays : ce qui dépend du pays de l'entreprise. Les textes (numéros d'aide, cadre légal)
// sont dans messages/*.json, sous « Pays » ; ce fichier fixe la structure.
// Ajouter un pays : une entrée ici, ses textes dans chaque fichier de langue, son drapeau.

export const PAYS = ["BE", "FR", "BR", "PT"] as const;
export type CodePays = (typeof PAYS)[number];

type FichePays = {
  // Langues proposées aux répondants (néerlandais en Belgique et portugais du Portugal :
  // à ajouter quand leurs traductions seront prêtes)
  langues: readonly ("fr" | "pt-BR")[];
  // Numéros d'aide affichés aux travailleurs ; libellés dans messages « Pays.<code>.aides »
  aides: readonly string[];
  // Pays de l'Union européenne : mention du règlement européen sur l'IA
  ue: boolean;
  // Texte juridique encore à faire valider par un juriste
  cadreAValider: boolean;
};

export const FICHES_PAYS: Record<CodePays, FichePays> = {
  BE: { langues: ["fr"], aides: ["112", "0800 32 123", "100", "101"], ue: true, cadreAValider: false },
  FR: { langues: ["fr"], aides: ["112", "3114", "01 45 39 40 00"], ue: true, cadreAValider: true },
  BR: { langues: ["pt-BR"], aides: ["188", "192"], ue: false, cadreAValider: false },
  PT: { langues: ["pt-BR"], aides: ["112", "808 24 24 24", "21 354 45 45"], ue: true, cadreAValider: true },
};

export function languesDuPays(pays: string) {
  return FICHES_PAYS[pays as CodePays]?.langues ?? [];
}
