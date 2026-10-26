// Bibliothèque de thèmes de sensibilisation RPS et santé mentale (module B1, décisions de Michelle du 23/10/2026).
// Un thème = une fiche (métadonnées) + un kit par langue : article, message court, affiche, questions d'échange,
// e-mail aux managers et fiche d'animation d'un « quart d'heure bien-être ».
// Les personnes de soutien de l'entreprise et les numéros d'aide du pays sont ajoutés automatiquement au kit
// (module B2) : ils ne font pas partie du texte du thème.
import { z } from "zod";
import { NIVEAUX_MINDSET } from "../rapport/contenu";

export const LANGUES_THEME = ["fr", "nl", "en", "pt-BR"] as const;

// Événements que le conseiller en prévention peut déclarer (module B3). Un décès n'appelle pas de campagne de
// communication : InnerOS oriente d'abord vers un professionnel (décision de Michelle du 26/10/2026).
export const EVENEMENTS_THEME = [
  "reorganisation",
  "licenciements",
  "fusion",
  "accident_grave",
  "agression",
  "forte_charge",
  "conflit_collectif",
  "cyberattaque",
] as const;
export const EVENEMENTS = [...EVENEMENTS_THEME, "deces"] as const;
export type Evenement = (typeof EVENEMENTS)[number];
export type LangueTheme = (typeof LANGUES_THEME)[number];

const texte = (max: number) => z.string().max(max);

export const schemaKit = z.object({
  titre: texte(120),
  objectif: texte(500),
  article: texte(5000), // article pour l'intranet ou le journal interne
  message_court: texte(700), // message pour la messagerie interne ou un écran
  affiche: z.object({ titre: texte(90), texte: texte(450) }),
  questions: z.array(texte(300)), // questions pour une réunion d'équipe
  email_managers: z.object({ objet: texte(140), texte: texte(3000) }),
  fiche_animation: z.object({
    duree_minutes: z.number().int().min(5).max(60),
    deroule: z.array(texte(400)), // étapes du « quart d'heure bien-être »
    conseils: z.array(texte(400)), // conseils à l'animateur (posture, limites, orientation)
  }),
});
export type Kit = z.infer<typeof schemaKit>;

// Fiche du thème (identique dans toutes les langues)
export const schemaFicheTheme = z.object({
  code: z.string().regex(/^[a-z0-9-]{3,40}$/),
  mois: z.number().int().min(1).max(12).nullable(), // mois proposé dans le calendrier
  journee: texte(120).nullable(), // ex. « 10 octobre — Journée mondiale de la santé mentale »
  niveau_mindset: z.enum(NIVEAUX_MINDSET).nullable(),
  // Échelles des questionnaires visées (ex. « charge », « qd ») : servent à proposer le thème
  // quand le registre des risques de l'entreprise les signale (module B3)
  echelles: z.array(z.string().regex(/^[a-z0-9]{1,20}$/)).max(30),
  // Thème sensible (idées suicidaires, violence…) : règles de communication responsable renforcées
  sensible: z.boolean(),
  pays: z.array(z.enum(["BE", "FR", "BR", "PT"])).nullable(), // null = tous les pays
  // Événements de l'entreprise auxquels le thème répond : servent à le proposer quand le conseiller
  // en prévention en déclare un (module B3)
  evenements: z.array(z.enum(EVENEMENTS_THEME)).max(10).default([]),
});
export type FicheTheme = z.infer<typeof schemaFicheTheme>;

export const kitVide = (): Kit => ({
  titre: "",
  objectif: "",
  article: "",
  message_court: "",
  affiche: { titre: "", texte: "" },
  questions: [],
  email_managers: { objet: "", texte: "" },
  fiche_animation: { duree_minutes: 15, deroule: [], conseils: [] },
});

export function lireKits(brut: unknown): Partial<Record<LangueTheme, Kit>> {
  const r = z.partialRecord(z.enum(LANGUES_THEME), schemaKit).safeParse(brut ?? {});
  return r.success ? r.data : {};
}

// Un kit est complet quand toutes ses parties sont rédigées
export function kitComplet(k: Kit | undefined) {
  if (!k) return false;
  return (
    !!k.titre.trim() && !!k.objectif.trim() && !!k.article.trim() && !!k.message_court.trim() &&
    !!k.affiche.titre.trim() && !!k.affiche.texte.trim() && k.questions.some((q) => q.trim()) &&
    !!k.email_managers.objet.trim() && !!k.email_managers.texte.trim() && k.fiche_animation.deroule.some((d) => d.trim())
  );
}
