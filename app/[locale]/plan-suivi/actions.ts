"use server";

// Actions du suivi du plan de prévention (module A3) : adoption par l'entreprise, avancement des actions.
// L'utilisateur est revérifié à chaque appel ; les droits sont contrôlés par lib/plan/suivi et par la base.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import type { EtatFormulaire } from "@/components/FormulaireAction";
import { langueValide } from "@/i18n/locale";
import { utilisateurConnecte } from "@/lib/auth/acces";
import { getDb } from "@/lib/db/client";
import { adopterPlan, majAvancement } from "@/lib/plan/suivi";

const uuid = z.string().uuid();

async function contexte(locale: string) {
  const langue = langueValide(locale);
  const u = await utilisateurConnecte();
  if (!u) redirect(`/${langue}`);
  const t = await getTranslations({ locale: langue, namespace: "Erreurs" });
  const tp = await getTranslations({ locale: langue, namespace: "Plan" });
  return { langue, u, db: getDb(), tp, erreur: (code: string) => ({ erreur: t.has(code) ? t(code) : t("inattendue") }) };
}

const chemin = (langue: string, role: string, organizationId: string | null) =>
  role === "admin" ? `/${langue}/admin/entreprises/${organizationId}/plan` : `/${langue}/espace/plan`;

export async function actionAdopterPlan(locale: string, planId: string, _etat: EtatFormulaire, formData: FormData): Promise<EtatFormulaire> {
  const { langue, u, db, tp, erreur } = await contexte(locale);
  if (!uuid.safeParse(planId).success) return erreur("introuvable");
  const r = await adopterPlan(db, u, planId, {
    adopteLe: String(formData.get("adopteLe") ?? ""),
    organe: String(formData.get("organe") ?? ""),
    avisLe: String(formData.get("avisLe") ?? ""),
  });
  if (!r.ok) return erreur(r.erreur);
  revalidatePath(chemin(langue, u.role, u.organizationId));
  return { succes: tp("adoptedDone"), envoi: Date.now() };
}

export async function actionAvancement(
  locale: string,
  organizationId: string,
  planId: string,
  actionId: string,
  _etat: EtatFormulaire,
  formData: FormData,
): Promise<EtatFormulaire> {
  const { langue, u, db, tp, erreur } = await contexte(locale);
  if (!uuid.safeParse(planId).success || !z.string().max(40).safeParse(actionId).success) return erreur("introuvable");
  const r = await majAvancement(db, u, planId, actionId, {
    statut: String(formData.get("statut") ?? ""),
    realiseeLe: String(formData.get("realiseeLe") ?? ""),
    commentaire: String(formData.get("commentaire") ?? ""),
  });
  if (!r.ok) return erreur(r.erreur);
  revalidatePath(chemin(langue, u.role, organizationId));
  return { succes: tp("progressSaved"), envoi: Date.now() };
}
