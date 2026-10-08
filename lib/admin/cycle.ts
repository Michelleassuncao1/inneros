// Ouverture et clôture d'une campagne. Une campagne ne s'ouvre jamais d'elle-même :
// il faut la date de validation du mandat (porte P1) et la confirmation de l'administrateur.
import { count, eq } from "drizzle-orm";
import { z } from "zod";
import { journaliser } from "../audit";
import { campaignInstruments, campaignReferents, campaigns, groups, tokens } from "../db/schema";
import type { Db } from "../db/types";
import type { Resultat } from "./entreprises";

const schemaOuverture = z.object({
  mandateValidatedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  confirmation: z.literal("oui"),
});

function aujourdhui(maintenant: Date) {
  return maintenant.toISOString().slice(0, 10);
}

export async function ouvrirCampagne(
  db: Db,
  adminId: string,
  campaignId: string,
  saisie: unknown,
  maintenant = new Date(),
): Promise<Resultat> {
  const donnees = schemaOuverture.safeParse(saisie);
  if (!donnees.success) return { ok: false, erreur: "ouvertureIncomplete" };
  if (donnees.data.mandateValidatedOn > aujourdhui(maintenant)) return { ok: false, erreur: "dateMandatFuture" };

  const [campagne] = await db.select().from(campaigns).where(eq(campaigns.id, campaignId));
  if (!campagne) return { ok: false, erreur: "introuvable" };
  if (campagne.status !== "draft") return { ok: false, erreur: "campagneVerrouillee" };

  const [[g], [i], [r]] = await Promise.all([
    db.select({ n: count() }).from(groups).where(eq(groups.campaignId, campaignId)),
    db.select({ n: count() }).from(campaignInstruments).where(eq(campaignInstruments.campaignId, campaignId)),
    db.select({ n: count() }).from(campaignReferents).where(eq(campaignReferents.campaignId, campaignId)),
  ]);
  if (!g.n) return { ok: false, erreur: "ouvertureSansGroupe" };
  if (!i.n) return { ok: false, erreur: "ouvertureSansQuestionnaire" };
  if (!r.n) return { ok: false, erreur: "ouvertureSansReferent" };

  await db
    .update(campaigns)
    .set({ status: "open", mandateValidatedOn: donnees.data.mandateValidatedOn })
    .where(eq(campaigns.id, campaignId));
  await journaliser(db, {
    actorUserId: adminId,
    action: "campaign_opened",
    targetType: "campaign",
    targetId: campaignId,
    details: { mandateValidatedOn: donnees.data.mandateValidatedOn },
  });
  return { ok: true, valeur: undefined };
}

// Clôture : la collecte s'arrête et tous les jetons sont supprimés (cahier des charges, section 7)
export async function cloturerCampagne(
  db: Db,
  adminId: string,
  campaignId: string,
  maintenant = new Date(),
): Promise<Resultat<{ jetonsSupprimes: number }>> {
  const [campagne] = await db.select().from(campaigns).where(eq(campaigns.id, campaignId));
  if (!campagne) return { ok: false, erreur: "introuvable" };
  if (campagne.status !== "open") return { ok: false, erreur: "campagneNonOuverte" };

  const supprimes = await db.transaction(async (tx) => {
    const liste = await tx.delete(tokens).where(eq(tokens.campaignId, campaignId)).returning({ id: tokens.id });
    await tx.update(campaigns).set({ status: "closed", closedAt: maintenant }).where(eq(campaigns.id, campaignId));
    return liste.length;
  });
  await journaliser(db, {
    actorUserId: adminId,
    action: "campaign_closed",
    targetType: "campaign",
    targetId: campaignId,
    details: { jetonsSupprimes: supprimes },
  });
  return { ok: true, valeur: { jetonsSupprimes: supprimes } };
}
