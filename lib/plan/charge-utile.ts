// Ce qui part vers l'IA pour rédiger le plan de prévention (module A2, règle 5) : le registre des risques
// (déjà collectif), le rapport validé (sans les questions internes au praticien), le secteur, la taille,
// le pays et le code interne. Jamais le nom de l'entreprise, jamais un nom de personne.
// Le message est vérifié avant chaque envoi : toute anomalie bloque l'envoi.
import { z } from "zod";
import type { organizations } from "../db/schema";
import type { ContenuRapport } from "../rapport/contenu";
import type { ContenuPlan } from "./contenu";
import type { Risque } from "../risques/registre";

const texte = (max: number) => z.string().max(max);

export const schemaChargePlan = z
  .object({
    entreprise: z
      .object({
        code_interne: texte(40),
        secteur: texte(200),
        tranche_effectif: z.enum(["lt50", "50-249", "250-999", "1000+"]), // lt50 = moins de 50
        pays: z.enum(["BE", "FR", "BR", "PT"]),
        langue: z.enum(["fr", "nl", "en", "pt-BR"]),
        annee_debut: z.number().int(),
        annee_plan_action: z.number().int(), // année du plan d'action à rédiger (annee_debut la première année)
      })
      .strict(),
    risques: z
      .array(
        z
          .object({
            ref: z.string().regex(/^R\d{1,3}$/),
            titre: texte(200),
            description: texte(2000),
            origine: z.enum(["echelle", "comportement", "manuel"]),
            niveau_mindset: texte(20).nullable(),
            groupes: z.array(texte(80)),
            p: z.number(),
            e: z.number(),
            g: z.number(),
            score: z.number(),
            classe: z.enum(["tres_eleve", "eleve", "important", "possible", "acceptable"]),
            etat: z.enum(["ouvert", "traite"]),
          })
          .strict(),
      )
      .min(1),
    // Année suivante (module A3, partie 3) : plan en vigueur et avancement de ses actions
    suite: z
      .object({
        annee_precedente: z.number().int(),
        plan_en_vigueur: z
          .object({
            objectifs: z.array(z.object({ niveau: texte(20), objectif: texte(800), risques: z.array(texte(6)) }).strict()),
            mesures: z.array(z.object({ niveau_prevention: texte(20), mesure: texte(800), risques: z.array(texte(6)) }).strict()),
            calendrier: z.array(z.object({ annee: z.number().int(), etapes: z.array(texte(500)) }).strict()),
            actions: z.array(
              z
                .object({
                  id: texte(40),
                  titre: texte(300),
                  description: texte(1500),
                  risques: z.array(texte(6)),
                  trimestre: z.number().int(),
                  effort: texte(20),
                  etat: z.enum(["a_faire", "en_cours", "realisee", "reportee", "abandonnee"]),
                })
                .strict(),
            ),
          })
          .strict(),
      })
      .strict()
      .optional(),
    rapport: z
      .object({
        synthese: texte(3000),
        priorites: z.array(texte(2400)),
        orientations: z.array(texte(800)),
      })
      .strict(),
  })
  .strict();

export type ChargePlan = z.infer<typeof schemaChargePlan>;

const normaliser = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

// Contrôle bloquant avant envoi (règle 5) ; la consigne du prompt n'est qu'un second filet.
// groupesAffichables : groupes présentés dans les résultats (au moins le seuil de la campagne).
export function verifierChargePlan(charge: unknown, nomEntreprise: string, groupesAffichables?: Set<string>) {
  const lecture = schemaChargePlan.safeParse(charge);
  if (!lecture.success) return ["format du message non conforme"];
  const brut = JSON.stringify(lecture.data);
  const erreurs: string[] = [];
  const nom = normaliser(nomEntreprise);
  if (nom.length >= 3 && normaliser(brut).includes(nom)) erreurs.push("le nom de l'entreprise apparaît dans le message");
  if (/[^\s@"]+@[^\s@"]+\.[^\s@"]+/.test(brut)) erreurs.push("adresse e-mail dans le message");
  if (/(\+?\d[\s.-]?){8,}/.test(brut.replace(/"(p|e|g|score|annee_debut)":[\d.]+/g, ""))) erreurs.push("numéro de téléphone dans le message");
  if (ADRESSE.test(brut)) erreurs.push("adresse postale dans le message");
  const r = lecture.data.risques;
  // Un comportement indésirable n'est jamais rattaché à un groupe (décision du 17/10/2026)
  if (r.some((x) => x.origine === "comportement" && x.groupes.length)) erreurs.push("comportement indésirable rattaché à un groupe");
  // Seulement des groupes présentés dans les résultats (au moins 10 personnes)
  if (groupesAffichables && r.some((x) => x.groupes.some((g) => !groupesAffichables.has(g)))) erreurs.push("groupe non présenté dans les résultats");
  return erreurs;
}

// Adresse postale : numéro puis type de voie (« 12 rue… », France), ou type de voie puis numéro
// (« Rue de la Loi 16 », Belgique ; « Rua Augusta, 25 », Portugal et Brésil)
const VOIE = "rue|avenue|boulevard|chaussée|chemin|impasse|place|straat|laan|plein|rua|avenida|travessa|praça";
const ADRESSE = new RegExp(`\\b\\d{1,4}\\s*(bis|ter)?,?\\s+(${VOIE})\\s|\\b(${VOIE})\\s+[^"\\d]{2,40}?\\d{1,4}\\b`, "i");

// Les risques clôturés ne figurent pas dans le plan ; R1, R2… dans l'ordre du registre (score décroissant)
export function construireChargePlan(
  org: typeof organizations.$inferSelect,
  registre: Risque[],
  rapport: ContenuRapport,
  langue: ChargePlan["entreprise"]["langue"],
  anneeDebut: number,
  suite?: { annee_precedente: number; contenu: ContenuPlan; statuts: Map<string, string> },
  anneePlanAction = anneeDebut,
) {
  const retenus = registre.filter((r) => r.status !== "clos");
  const refs = new Map(retenus.map((r, i) => [`R${i + 1}`, r.id]));
  const versRef = new Map([...refs].map(([ref, id]) => [id, ref]));
  const enRefs = (ids: string[]) => ids.map((id) => versRef.get(id)).filter((x): x is string => !!x);
  const charge: ChargePlan = {
    entreprise: {
      code_interne: org.internalCode,
      secteur: org.sector,
      tranche_effectif: org.sizeBand as ChargePlan["entreprise"]["tranche_effectif"],
      pays: org.country,
      langue,
      annee_debut: anneeDebut,
      annee_plan_action: anneePlanAction,
    },
    risques: retenus.map((r, i) => ({
      ref: `R${i + 1}`,
      titre: r.title,
      description: r.description ?? "",
      origine: r.source,
      niveau_mindset: r.mindsetLevel,
      groupes: r.groupLabels,
      p: r.p,
      e: r.e,
      g: r.g,
      score: r.score,
      classe: r.classe,
      etat: r.status as "ouvert" | "traite",
    })),
    ...(suite
      ? {
          suite: {
            annee_precedente: suite.annee_precedente,
            plan_en_vigueur: {
              objectifs: suite.contenu.objectifs.map((o) => ({ niveau: o.niveau, objectif: o.objectif, risques: enRefs(o.risques) })),
              mesures: suite.contenu.mesures.map((m) => ({ niveau_prevention: m.niveau_prevention, mesure: m.mesure, risques: enRefs(m.risques) })),
              calendrier: suite.contenu.calendrier,
              actions: suite.contenu.actions.map((a) => ({
                id: a.id,
                titre: a.titre,
                description: a.description,
                risques: enRefs(a.risques),
                trimestre: a.trimestre,
                effort: a.effort,
                etat: (suite.statuts.get(a.id) ?? "a_faire") as "a_faire",
              })),
            },
          },
        }
      : {}),
    rapport: {
      synthese: rapport.synthese,
      priorites: rapport.priorites_proposees.map((p) => `${p.priorite} — ${p.justification}`),
      orientations: rapport.orientations,
    },
  };
  return { charge, refs };
}
