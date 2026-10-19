"use server";

// Actions du plan de prévention RPS (module A2), réservées aux administrateurs IMA (revérifiés à chaque appel).
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import type { EtatFormulaire } from "@/components/FormulaireAction";
import { langueValide } from "@/i18n/locale";
import { exigerAdmin } from "@/lib/auth/acces";
import { getDb } from "@/lib/db/client";
import type { ContenuPlan } from "@/lib/plan/contenu";
import { creerPlanManuel, enregistrerPlan, genererPlanIA, refuserPlan, validerPlan } from "@/lib/plan/plans";

const uuid = z.string().uuid();

async function contexte(locale: string, organizationId: string) {
  const langue = langueValide(locale);
  const admin = await exigerAdmin(langue);
  const t = await getTranslations({ locale: langue, namespace: "Erreurs" });
  const tp = await getTranslations({ locale: langue, namespace: "Plan" });
  const chemin = `/${langue}/admin/entreprises/${organizationId}/plan`;
  const erreur = (code: string, detail?: string) => ({
    erreur: `${t.has(code) ? t(code) : t("inattendue")}${detail ? ` ${detail}` : ""}`,
  });
  return { admin, db: getDb(), tp, chemin, erreur, valide: uuid.safeParse(organizationId).success };
}

export async function actionGenererPlan(locale: string, organizationId: string, _etat: EtatFormulaire, formData: FormData): Promise<EtatFormulaire> {
  const { admin, db, chemin, erreur, valide } = await contexte(locale, organizationId);
  if (!valide) return erreur("introuvable");
  const r = await genererPlanIA(db, admin.id, organizationId, String(formData.get("langue") ?? ""), formData.get("annee"));
  if (!r.ok) return erreur(r.erreur, r.erreur === "iaEnvoiBloque" ? r.detail : undefined);
  revalidatePath(chemin);
  return { envoi: Date.now() };
}

export async function actionPlanManuel(
  locale: string,
  organizationId: string,
  depuisValide: boolean,
  _etat: EtatFormulaire,
  formData: FormData,
): Promise<EtatFormulaire> {
  const { admin, db, chemin, erreur, valide } = await contexte(locale, organizationId);
  if (!valide) return erreur("introuvable");
  const r = await creerPlanManuel(db, admin.id, organizationId, String(formData.get("langue") ?? ""), formData.get("annee"), depuisValide === true);
  if (!r.ok) return erreur(r.erreur);
  revalidatePath(chemin);
  return { envoi: Date.now() };
}

export async function actionEnregistrerPlan(locale: string, organizationId: string, planId: string, contenu: ContenuPlan): Promise<EtatFormulaire> {
  const { admin, db, tp, chemin, erreur } = await contexte(locale, organizationId);
  if (!uuid.safeParse(planId).success) return erreur("introuvable");
  const r = await enregistrerPlan(db, admin.id, planId, contenu);
  if (!r.ok) return erreur(r.erreur);
  revalidatePath(chemin);
  return { succes: tp("saved"), envoi: Date.now() };
}

export async function actionValiderPlan(
  locale: string,
  organizationId: string,
  planId: string,
  contenu: ContenuPlan,
  liste: Record<string, boolean>,
): Promise<EtatFormulaire> {
  const { admin, db, tp, chemin, erreur } = await contexte(locale, organizationId);
  if (!uuid.safeParse(planId).success) return erreur("introuvable");
  const r = await validerPlan(db, admin.id, planId, { contenu, liste });
  if (!r.ok) return erreur(r.erreur, "detail" in r ? r.detail : undefined);
  revalidatePath(chemin);
  return { succes: tp("validated"), envoi: Date.now() };
}

export async function actionRefuserPlan(
  locale: string,
  organizationId: string,
  planId: string,
  _etat: EtatFormulaire,
  formData: FormData,
): Promise<EtatFormulaire> {
  const { admin, db, chemin, erreur } = await contexte(locale, organizationId);
  if (!uuid.safeParse(planId).success) return erreur("introuvable");
  const r = await refuserPlan(db, admin.id, planId, String(formData.get("motif") ?? ""));
  if (!r.ok) return erreur(r.erreur);
  revalidatePath(chemin);
  return { envoi: Date.now() };
}
