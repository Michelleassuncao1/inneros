// Étape 9 (F12) : suppression programmée, selon les durées de conservation (cahier, section 7).
// - Réponses brutes (responses + answers) : 12 mois après l'acceptation du rapport par l'entreprise ;
//   par sécurité, 18 mois après la clôture si le rapport n'est jamais accepté (décisions du 14/10/2026).
//   Les agrégats et le rapport sont conservés.
// - Journal d'audit : 24 mois.
// Durées réglables dans .env.local, à confirmer dans l'AIPD. Une simulation montre ce qui serait supprimé.
import { and, count, eq, inArray, isNotNull, isNull, lte } from "drizzle-orm";
import { journaliser } from "../audit";
import { auditLog, campaigns, reports, responses } from "../db/schema";
import type { Db } from "../db/types";

const mois = (nom: string, defaut: number) => {
  const v = Number(process.env[nom]);
  return Number.isInteger(v) && v > 0 ? v : defaut;
};

export function dureesConservation() {
  return {
    reponsesApresAcceptation: mois("RAW_RESPONSES_RETENTION_MONTHS", 12),
    reponsesApresCloture: mois("RAW_RESPONSES_FALLBACK_MONTHS", 18),
    journal: mois("AUDIT_LOG_RETENTION_MONTHS", 24),
  };
}

// Date située « n » mois avant la date donnée (fin de mois respectée : 31 mars - 1 mois = 28/29 février)
export function moisAvant(date: Date, n: number) {
  const d = new Date(date);
  const jour = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - n);
  const dernier = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(jour, dernier));
  return d;
}

export type CampagneAPurger = { campaignId: string; reponses: number; motif: "acceptation" | "cloture" };

// Campagnes clôturées dont les réponses brutes doivent être supprimées à cette date
export async function campagnesAPurger(db: Db, maintenant = new Date()): Promise<CampagneAPurger[]> {
  const d = dureesConservation();
  const limiteAcceptation = moisAvant(maintenant, d.reponsesApresAcceptation);
  const limiteCloture = moisAvant(maintenant, d.reponsesApresCloture);

  const candidates = await db
    .select({ id: campaigns.id, closedAt: campaigns.closedAt })
    .from(campaigns)
    .where(and(eq(campaigns.status, "closed"), isNull(campaigns.rawDeletedAt)));
  if (!candidates.length) return [];

  const acceptees = await db
    .select({ campaignId: reports.campaignId })
    .from(reports)
    .where(
      and(
        inArray(reports.campaignId, candidates.map((c) => c.id)),
        isNotNull(reports.acceptedAt),
        lte(reports.acceptedAt, limiteAcceptation),
      ),
    );
  const parAcceptation = new Set(acceptees.map((a) => a.campaignId));

  const resultat: CampagneAPurger[] = [];
  for (const c of candidates) {
    const motif = parAcceptation.has(c.id) ? "acceptation" : c.closedAt && c.closedAt <= limiteCloture ? "cloture" : null;
    if (!motif) continue;
    const [r] = await db.select({ n: count() }).from(responses).where(eq(responses.campaignId, c.id));
    resultat.push({ campaignId: c.id, reponses: r.n, motif });
  }
  return resultat;
}

export async function purgerDonnees(db: Db, options: { maintenant?: Date; simulation?: boolean } = {}) {
  const maintenant = options.maintenant ?? new Date();
  const campagnes = await campagnesAPurger(db, maintenant);
  const limiteJournal = moisAvant(maintenant, dureesConservation().journal);
  const [journal] = await db.select({ n: count() }).from(auditLog).where(lte(auditLog.at, limiteJournal));

  if (options.simulation) return { campagnes, journal: journal.n, simulation: true };

  for (const c of campagnes) {
    await db.transaction(async (tx) => {
      // Les items (answers) sont supprimés en cascade avec chaque réponse
      await tx.delete(responses).where(eq(responses.campaignId, c.campaignId));
      await tx.update(campaigns).set({ rawDeletedAt: maintenant }).where(eq(campaigns.id, c.campaignId));
      await journaliser(tx, {
        actorUserId: null, // tâche programmée
        action: "raw_responses_deleted",
        targetType: "campaign",
        targetId: c.campaignId,
        details: { reponses: c.reponses, motif: c.motif },
      });
    });
  }
  if (journal.n) {
    await db.delete(auditLog).where(lte(auditLog.at, limiteJournal));
    await journaliser(db, { action: "audit_log_purged", details: { entrees: journal.n } });
  }
  return { campagnes, journal: journal.n, simulation: false };
}
