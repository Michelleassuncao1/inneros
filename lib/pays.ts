// Fiche pays : ce qui dépend du pays de l'entreprise. Les textes (libellés des numéros d'aide,
// cadre légal) sont dans messages/*.json, sous « Pays » ; ce fichier fixe la structure.
// Ajouter un pays : une entrée ici, ses textes dans chaque fichier de langue, son drapeau.

export const PAYS = ["BE", "FR", "BR", "PT"] as const;
export type CodePays = (typeof PAYS)[number];
type Langue = "fr" | "nl" | "en" | "pt-BR";

type Aide = {
  numero: string;
  cle: string; // libellé dans messages « Pays.<code>.aides.<cle> »
  // Langues pour lesquelles la ligne n'est pas affichée (ex. : en Belgique, les lignes
  // francophones ne sont pas proposées aux néerlandophones, et inversement)
  sauf?: readonly Langue[];
};

type FichePays = {
  // Langues proposées aux répondants (anglais partout depuis le 8 octobre 2026 ;
  // portugais du Portugal à ajouter quand sa traduction sera prête)
  langues: readonly Langue[];
  aides: readonly Aide[];
  // Pays de l'Union européenne : mention du règlement européen sur l'IA
  ue: boolean;
  // Texte juridique encore à faire valider par un juriste
  cadreAValider: boolean;
};

export const FICHES_PAYS: Record<CodePays, FichePays> = {
  BE: {
    langues: ["fr", "nl", "en"],
    aides: [
      { numero: "112", cle: "urgence" },
      { numero: "0800 32 123", cle: "cps", sauf: ["nl"] },
      { numero: "107", cle: "teleAccueil", sauf: ["nl"] },
      { numero: "1813", cle: "zelfmoordlijn", sauf: ["fr"] },
      { numero: "106", cle: "teleOnthaal", sauf: ["fr"] },
      { numero: "100", cle: "ambulance" },
      { numero: "101", cle: "police" },
    ],
    ue: true,
    cadreAValider: false,
  },
  FR: {
    langues: ["fr", "en"],
    aides: [
      { numero: "112", cle: "urgence" },
      { numero: "3114", cle: "suicide" },
      { numero: "01 45 39 40 00", cle: "ecoute" },
    ],
    ue: true,
    cadreAValider: true,
  },
  BR: {
    langues: ["pt-BR", "en"],
    aides: [
      { numero: "188", cle: "cvv" },
      { numero: "192", cle: "samu" },
    ],
    ue: false,
    cadreAValider: false,
  },
  PT: {
    langues: ["pt-BR", "en"],
    aides: [
      { numero: "112", cle: "urgence" },
      { numero: "808 24 24 24", cle: "sns24" },
      { numero: "21 354 45 45", cle: "vozAmiga" },
    ],
    ue: true,
    cadreAValider: true,
  },
};

export function languesDuPays(pays: string) {
  return FICHES_PAYS[pays as CodePays]?.langues ?? [];
}

// Numéros d'aide à afficher pour un pays, dans une langue donnée
export function aidesPour(pays: string, langue: string) {
  const fiche = FICHES_PAYS[pays as CodePays];
  if (!fiche) return [];
  return fiche.aides.filter((a) => !a.sauf?.includes(langue as Langue));
}
