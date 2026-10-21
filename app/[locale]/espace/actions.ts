"use server";

// Actions du référent (étape 8B) : acceptation du rapport ou demande de correction.
// Le référent est revérifié à chaque appel ; les règles sont aussi imposées par la base.
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import type { EtatFormulaire } from "@/components/FormulaireAction";
import { langueValide } from "@/i18n/locale";
import { exigerReferent } from "@/lib/auth/acces";
import { getDb } from "@/lib/db/client";
import { accepterRapport, definirDelegation, demanderCorrection } from "@/lib/rapport/entreprise";

const uuid = z.string().uuid();

async function contexte(locale: string) {
  const langue = langueValide(locale);
  const referent = await exigerReferent(langue);
  const t = await getTranslations({ locale: langue, namespace: "Erreurs" });
  const te = await getTranslations({ locale: langue, namespace: "EspaceRapport" });
  return { langue, referent, db: getDb(), te, erreur: (code: string) => ({ erreur: t(code) }) };
}

export async function actionAccepterRapport(
  locale: string,
  campaignId: string,
  reportId: string,
  _etat: EtatFormulaire,
  formData: FormData,
): Promise<EtatFormulaire> {
  const { langue, referent, db, te, erreur } = await contexte(locale);
  if (!uuid.safeParse(reportId).success) return erreur("introuvable");
  const liste = { perimetre: formData.get("perimetre") === "oui", effectifs: formData.get("effectifs") === "oui" };
  const r = await accepterRapport(db, referent.id, reportId, liste);
  if (!r.ok) return erreur(r.erreur);
  revalidatePath(`/${langue}/espace/campagnes/${campaignId}`);
  return { succes: te("acceptedDone"), envoi: Date.now() };
}

export async function actionDemanderCorrection(
  locale: string,
  campaignId: string,
  reportId: string,
  _etat: EtatFormulaire,
  formData: FormData,
): Promise<EtatFormulaire> {
  const { langue, referent, db, te, erreur } = await contexte(locale);
  if (!uuid.safeParse(reportId).success) return erreur("introuvable");
  const r = await demanderCorrection(db, referent.id, reportId, String(formData.get("commentaire") ?? ""));
  if (!r.ok) return erreur(r.erreur);
  revalidatePath(`/${langue}/espace/campagnes/${campaignId}`);
  return { succes: te("correctionDone"), envoi: Date.now() };
}

// Le signataire délègue (ou reprend) au conseiller en prévention l'acceptation du rapport et l'adoption du plan
export async function actionDefinirDelegation(locale: string, campaignId: string, _etat: EtatFormulaire, formData: FormData): Promise<EtatFormulaire> {
  const { langue, referent, db, te, erreur } = await contexte(locale);
  if (!uuid.safeParse(campaignId).success) return erreur("introuvable");
  const r = await definirDelegation(db, referent.id, campaignId, formData.get("delegation") === "oui");
  if (!r.ok) return erreur(r.erreur);
  revalidatePath(`/${langue}/espace/campagnes/${campaignId}`);
  return { succes: te("delegationDone"), envoi: Date.now() };
}
