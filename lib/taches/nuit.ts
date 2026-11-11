// Tâches de nuit (étape 10), lancées chaque nuit par Vercel via /api/cron/purge (voir vercel.json).
// Chaque étape est indépendante : si l'une échoue (Brevo en panne, par exemple), les suivantes se font quand même.
// Chaque passage est noté dans le carnet de bord (cron_runs) : noms d'étapes et nombres seulement, jamais de donnée.
// L'accueil de l'espace IMA affiche une alerte si aucun passage réussi depuis 36 h, ou si une étape a échoué.
import { desc, eq, lt } from "drizzle-orm";
import { envoyerRappelsAteliers, purgerAteliers } from "../ateliers/ateliers";
import { purgerDonnees } from "../confidentialite/conservation";
import { cronRuns } from "../db/schema";
import { purgerErreurs } from "../erreurs/journal";
import type { Db } from "../db/types";
import { envoyerRappelsTrimestriels } from "../plan/suivi";
import { purgerCompteurs } from "../securite/limite-requetes";
import { envoyerRappelsSensibilisation } from "../sensibilisation/calendrier";
import { actualiserToutesPropositions } from "../sensibilisation/declencheurs";

const HEURE = 3_600_000;
export const RETARD_ALERTE_MS = 36 * HEURE;
export const CONSERVATION_CARNET_JOURS = 90;

export type NomEtape =
  | "suppressions"
  | "ateliers"
  | "compteurs"
  | "propositions"
  | "rappelsPlan"
  | "rappelsSensibilisation"
  | "rappelsAteliers"
  | "erreurs"
  | "carnet";

export type ResultatEtape = { etape: NomEtape; ok: boolean; nombre: number };
export type Etape = { etape: NomEtape; lancer: (db: Db, maintenant: Date) => Promise<number> };

// Ordre : suppressions d'abord, propositions de campagnes avant le rappel mensuel de sensibilisation.
export const ETAPES: Etape[] = [
  {
    etape: "suppressions",
    lancer: async (db, maintenant) => {
      const r = await purgerDonnees(db, { maintenant });
      return r.campagnes.reduce((s, c) => s + c.reponses, 0) + r.journal;
    },
  },
  {
    etape: "ateliers",
    lancer: async (db, maintenant) => {
      const r = await purgerAteliers(db, maintenant);
      return r.inscriptions + r.avis;
    },
  },
  { etape: "compteurs", lancer: (db, maintenant) => purgerCompteurs(db, maintenant) },
  { etape: "propositions", lancer: (db, maintenant) => actualiserToutesPropositions(db, maintenant) },
  { etape: "rappelsPlan", lancer: (db, maintenant) => envoyerRappelsTrimestriels(db, maintenant) },
  { etape: "rappelsSensibilisation", lancer: (db, maintenant) => envoyerRappelsSensibilisation(db, maintenant) },
  { etape: "rappelsAteliers", lancer: (db, maintenant) => envoyerRappelsAteliers(db, maintenant) },
  { etape: "erreurs", lancer: (db, maintenant) => purgerErreurs(db, maintenant) },
  { etape: "carnet", lancer: (db, maintenant) => purgerCarnet(db, maintenant) },
];

export async function executerTachesNuit(db: Db, maintenant = new Date(), etapes: Etape[] = ETAPES) {
  const [passage] = await db.insert(cronRuns).values({ startedAt: maintenant }).returning({ id: cronRuns.id });
  const resultats: ResultatEtape[] = [];
  for (const e of etapes) {
    try {
      resultats.push({ etape: e.etape, ok: true, nombre: Number(await e.lancer(db, maintenant)) || 0 });
    } catch (erreur) {
      // Seulement le nom de l'étape et le type d'erreur : un message d'erreur peut contenir une adresse e-mail
      console.error(`Tâche de nuit « ${e.etape} » en échec (${erreur instanceof Error ? erreur.name : "erreur"}).`);
      resultats.push({ etape: e.etape, ok: false, nombre: 0 });
    }
  }
  await db.update(cronRuns).set({ finishedAt: new Date(), steps: resultats }).where(eq(cronRuns.id, passage.id));
  return resultats;
}

// Les passages de plus de 90 jours sont supprimés (environ 90 passages gardés).
export async function purgerCarnet(db: Db, maintenant = new Date()) {
  const supprimes = await db
    .delete(cronRuns)
    .where(lt(cronRuns.startedAt, new Date(maintenant.getTime() - CONSERVATION_CARNET_JOURS * 24 * HEURE)))
    .returning({ id: cronRuns.id });
  return supprimes.length;
}

export type EtatTachesNuit = {
  dernierPassage: Date | null; // dernier passage terminé
  derniereReussite: Date | null; // dernier passage où toutes les étapes ont réussi
  enRetard: boolean; // aucune réussite depuis 36 h (ou jamais)
  etapesEchouees: NomEtape[]; // au dernier passage terminé
};

// État affiché à l'accueil de l'espace IMA (les 40 derniers passages suffisent : un par nuit).
export async function etatTachesNuit(db: Db, maintenant = new Date()): Promise<EtatTachesNuit> {
  const passages = await db.select().from(cronRuns).orderBy(desc(cronRuns.startedAt)).limit(40);
  const termines = passages.filter((p) => p.finishedAt);
  const etapes = (p: (typeof passages)[number]) => p.steps as ResultatEtape[];
  const dernier = termines[0];
  const reussi = termines.find((p) => etapes(p).every((e) => e.ok));
  const derniereReussite = reussi?.startedAt ?? null;
  return {
    dernierPassage: dernier?.startedAt ?? null,
    derniereReussite,
    enRetard: !derniereReussite || maintenant.getTime() - derniereReussite.getTime() > RETARD_ALERTE_MS,
    etapesEchouees: dernier ? etapes(dernier).filter((e) => !e.ok).map((e) => e.etape) : [],
  };
}
