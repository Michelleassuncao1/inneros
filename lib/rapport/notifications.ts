// Notifications par e-mail liées au rapport (étape 8B, décision 3 du 14/10/2026).
// Aucun contenu du rapport dans les e-mails : seulement un lien vers InnerOS.
// Un échec d'envoi n'empêche jamais l'action elle-même (validation, acceptation, correction).
import { and, eq, isNull } from "drizzle-orm";
import { campaignReferents, campaigns, organizations, reports, users } from "../db/schema";
import type { Db } from "../db/types";
import { envoyerEmail, type Email } from "../email/brevo";
import { emailIMA } from "../email/modele";
import { traducteur } from "../traduction";

const base = () => process.env.APP_URL ?? "http://localhost:3000";

async function envoyerSansBloquer(email: Email, envoi: (e: Email) => Promise<void> = envoyerEmail) {
  try {
    await envoi(email);
  } catch (e) {
    console.error("Notification non envoyée :", e instanceof Error ? e.message : e);
  }
}

// Après validation IMA : chaque référent ayant accès au rapport de la campagne
export async function notifierRapportDisponible(db: Db, campaignId: string, envoi?: (e: Email) => Promise<void>) {
  const [ligne] = await db
    .select({ reference: campaigns.mandateReference, locale: organizations.locale })
    .from(campaigns)
    .innerJoin(organizations, eq(campaigns.organizationId, organizations.id))
    .where(eq(campaigns.id, campaignId));
  if (!ligne) return;
  const destinataires = await db
    .select({ email: users.email, name: users.name })
    .from(campaignReferents)
    .innerJoin(users, eq(campaignReferents.userId, users.id))
    .where(and(eq(campaignReferents.campaignId, campaignId), isNull(users.disabledAt)));
  const t = traducteur(ligne.locale, "Notifications");
  for (const d of destinataires) {
    await envoyerSansBloquer(
      emailIMA(ligne.locale, d, {
        sujet: t("disponibleSujet"),
        salutation: t("salutation", { name: d.name }),
        paragraphes: [t("disponibleTexte", { reference: ligne.reference })],
        bouton: t("ouvrirEspace"),
        lien: `${base()}/${ligne.locale}/espace`,
        mention: t("sansContenu"),
      }),
      envoi,
    );
  }
}

// Après acceptation ou demande de correction : le praticien IMA qui a validé le rapport
export async function notifierIMA(db: Db, reportId: string, evenement: "accepte" | "correction", envoi?: (e: Email) => Promise<void>) {
  const [ligne] = await db
    .select({ campaignId: reports.campaignId, validatedBy: reports.validatedBy, reference: campaigns.mandateReference })
    .from(reports)
    .innerJoin(campaigns, eq(reports.campaignId, campaigns.id))
    .where(eq(reports.id, reportId));
  if (!ligne?.validatedBy) return;
  const [praticien] = await db.select({ email: users.email, name: users.name }).from(users).where(eq(users.id, ligne.validatedBy));
  if (!praticien) return;
  const locale = "fr"; // langue de travail d'IMA
  const t = traducteur(locale, "Notifications");
  await envoyerSansBloquer(
    emailIMA(locale, praticien, {
      sujet: t(evenement === "accepte" ? "accepteSujet" : "correctionSujet", { reference: ligne.reference }),
      salutation: t("salutation", { name: praticien.name }),
      paragraphes: [t(evenement === "accepte" ? "accepteTexte" : "correctionTexte", { reference: ligne.reference })],
      bouton: t("ouvrirRapport"),
      lien: `${base()}/${locale}/admin/campagnes/${ligne.campaignId}/rapport`,
      mention: t("sansContenu"),
    }),
    envoi,
  );
}
