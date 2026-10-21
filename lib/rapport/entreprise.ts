// Côté entreprise (étape 8B, décisions du 14/10/2026) :
// - IMA désigne un seul référent signataire par campagne ;
// - les référents ne voient le rapport qu'une fois validé par IMA (jamais un brouillon) ;
// - le signataire (ou le conseiller en prévention, si le signataire lui a délégué : décision du 21/10/2026)
//   accepte le rapport (faits conformes au contrat) ou demande une correction motivée.
//   Il vérifie les faits, il ne modifie pas l'analyse (indépendance méthodologique MINDSET®).
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { journaliser } from "../audit";
import { campaignReferents, campaigns, reports, users } from "../db/schema";
import type { Db } from "../db/types";
import type { Email } from "../email/brevo";
import { notifierIMA } from "./notifications";
import { rapportCourant, type Resultat } from "./rapports";

export async function designerSignataire(db: Db, adminId: string, campaignId: string, referentId: string | null): Promise<Resultat> {
  if (referentId !== null && !z.string().uuid().safeParse(referentId).success) return { ok: false, erreur: "saisieInvalide" };
  if (referentId) {
    const [acces] = await db
      .select({ id: users.id })
      .from(campaignReferents)
      .innerJoin(users, eq(campaignReferents.userId, users.id))
      .where(and(eq(campaignReferents.campaignId, campaignId), eq(campaignReferents.userId, referentId), isNull(users.disabledAt)));
    if (!acces) return { ok: false, erreur: "signataireSansAcces" };
  }
  await db.update(campaigns).set({ signatoryReferentId: referentId }).where(eq(campaigns.id, campaignId));
  await journaliser(db, { actorUserId: adminId, action: "campaign_signatory_set", targetType: "campaign", targetId: campaignId, details: { designe: !!referentId } });
  return { ok: true, valeur: undefined };
}

// Ce qu'un référent peut voir d'une campagne : rien s'il n'y a pas accès ; le rapport seulement s'il est validé
export async function rapportPourReferent(db: Db, referentId: string, campaignId: string) {
  const [acces] = await db
    .select({ campagne: campaigns })
    .from(campaignReferents)
    .innerJoin(campaigns, eq(campaignReferents.campaignId, campaigns.id))
    .where(and(eq(campaignReferents.campaignId, campaignId), eq(campaignReferents.userId, referentId)));
  if (!acces) return null;
  const [moi] = await db.select().from(users).where(eq(users.id, referentId));
  const estSignataire = acces.campagne.signatoryReferentId === referentId;
  // Délégation du signataire au conseiller en prévention (une seule case, décision du 21/10/2026)
  const parDelegation = !estSignataire && acces.campagne.advisorDelegation && !!moi?.preventionAdvisor && !moi.disabledAt;
  const rapport = await rapportCourant(db, campaignId);
  const etat: "indisponible" | "disponible" | "enCorrection" =
    rapport?.status === "validated" ? "disponible" : rapport?.status === "correction_requested" ? "enCorrection" : "indisponible";
  return {
    campagne: acces.campagne,
    etat,
    // Le contenu n'est transmis que pour un rapport validé
    rapport: etat === "disponible" ? rapport : null,
    estSignataire,
    parDelegation,
    peutSigner: estSignataire || parDelegation,
  };
}

// Le signataire délègue (ou reprend) au conseiller en prévention l'acceptation du rapport et l'adoption du plan
export async function definirDelegation(db: Db, referentId: string, campaignId: string, valeur: boolean): Promise<Resultat> {
  const vue = await rapportPourReferent(db, referentId, campaignId);
  if (!vue) return { ok: false, erreur: "introuvable" };
  if (!vue.estSignataire) return { ok: false, erreur: "signataireRequis" };
  await db.update(campaigns).set({ advisorDelegation: valeur }).where(eq(campaigns.id, campaignId));
  await journaliser(db, {
    actorUserId: referentId,
    action: valeur ? "advisor_delegation_granted" : "advisor_delegation_revoked",
    targetType: "campaign",
    targetId: campaignId,
  });
  return { ok: true, valeur: undefined };
}

async function rapportValidePourSignataire(db: Db, referentId: string, reportId: string) {
  const [r] = await db.select().from(reports).where(eq(reports.id, reportId));
  if (!r) return { ok: false as const, erreur: "introuvable" };
  const vue = await rapportPourReferent(db, referentId, r.campaignId);
  if (!vue || vue.etat !== "disponible" || vue.rapport?.id !== reportId) return { ok: false as const, erreur: "introuvable" };
  if (!vue.peutSigner) return { ok: false as const, erreur: "signataireRequis" };
  if (r.acceptedAt) return { ok: false as const, erreur: "rapportDejaAccepte" };
  return { ok: true as const, rapport: r };
}

export const schemaAcceptation = z.object({ perimetre: z.literal(true), effectifs: z.literal(true) });

export async function accepterRapport(
  db: Db,
  referentId: string,
  reportId: string,
  liste: unknown,
  maintenant = new Date(),
  envoi?: (e: Email) => Promise<void>,
): Promise<Resultat> {
  const verif = await rapportValidePourSignataire(db, referentId, reportId);
  if (!verif.ok) return verif;
  if (!schemaAcceptation.safeParse(liste).success) return { ok: false, erreur: "acceptationIncomplete" };
  await db.update(reports).set({ acceptedBy: referentId, acceptedAt: maintenant, updatedAt: maintenant }).where(eq(reports.id, reportId));
  await journaliser(db, { actorUserId: referentId, action: "report_accepted", targetType: "campaign", targetId: verif.rapport.campaignId });
  await notifierIMA(db, reportId, "accepte", envoi);
  return { ok: true, valeur: undefined };
}

export async function demanderCorrection(
  db: Db,
  referentId: string,
  reportId: string,
  commentaire: string,
  maintenant = new Date(),
  envoi?: (e: Email) => Promise<void>,
): Promise<Resultat> {
  const verif = await rapportValidePourSignataire(db, referentId, reportId);
  if (!verif.ok) return verif;
  const texte = commentaire.trim();
  if (texte.length < 10 || texte.length > 2000) return { ok: false, erreur: "correctionMotifRequis" };
  await db
    .update(reports)
    .set({
      status: "correction_requested",
      correctionComment: texte,
      correctionRequestedAt: maintenant,
      correctionRequestedBy: referentId,
      updatedAt: maintenant,
    })
    .where(eq(reports.id, reportId));
  await journaliser(db, {
    actorUserId: referentId,
    action: "report_correction_requested",
    targetType: "campaign",
    targetId: verif.rapport.campaignId,
    details: { commentaire: texte },
  });
  await notifierIMA(db, reportId, "correction", envoi);
  return { ok: true, valeur: undefined };
}

// Campagnes visibles par un référent, avec la participation globale et l'état du rapport
export async function campagnesDuReferent(db: Db, referentId: string) {
  const liste = await db
    .select({ campagne: campaigns })
    .from(campaignReferents)
    .innerJoin(campaigns, eq(campaignReferents.campaignId, campaigns.id))
    .where(eq(campaignReferents.userId, referentId));
  return Promise.all(
    liste.map(async ({ campagne }) => ({
      campagne,
      vue: await rapportPourReferent(db, referentId, campagne.id),
    })),
  );
}
