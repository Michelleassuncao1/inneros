// Constantes de l'aide à la rédaction (module D2), partagées par le serveur et l'écran du navigateur.
// Aucun type ne correspond à l'entretien individuel ni à la demande d'intervention psychosociale (exclus).
export const TYPES_REDACTION = ["rapport_annuel", "pv_reunion", "fiche_sensibilisation", "deroule_atelier", "note_information", "plan_actions"] as const;
export type TypeRedaction = (typeof TYPES_REDACTION)[number];
export const LIMITE_PAR_JOUR = 10;
export const LONGUEUR_NOTES = 6000;
