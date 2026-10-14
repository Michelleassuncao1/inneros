"use server";

// Actions de l'écran du rapport (étape 8A). Chaque action revérifie l'administrateur.
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import type { EtatFormulaire } from "@/components/FormulaireAction";
import { langueValide } from "@/i18n/locale";
import { exigerAdmin } from "@/lib/auth/acces";
import { getDb } from "@/lib/db/client";
import {
  changerIACampagne,
  creerRapportManuel,
  enregistrerContenu,
  genererBrouillonIA,
  refuserRapport,
  validerRapport,
} from "@/lib/rapport/rapports";

const uuid = z.string().uuid();

async function contexte(locale: string) {
  const langue = langueValide(locale);
  const admin = await exigerAdmin(langue);
  const t = await getTranslations({ locale: langue, namespace: "Erreurs" });
  const tr = await getTranslations({ locale: langue, namespace: "Rapport" });
  return { langue, admin, db: getDb(), tr, erreur: (code: string) => ({ erreur: t(code) }) };
}

const chemin = (langue: string, id: string) => `/${langue}/admin/campagnes/${id}/rapport`;

export async function actionGenererBrouillon(locale: string, campaignId: string, _etat: EtatFormulaire, formData: FormData): Promise<EtatFormulaire> {
  const { langue, admin, db, tr, erreur } = await contexte(locale);
  if (!uuid.safeParse(campaignId).success) return erreur("introuvable");
  const r = await genererBrouillonIA(db, admin.id, campaignId, String(formData.get("langue") ?? ""));
  if (!r.ok) return erreur(r.erreur);
  revalidatePath(chemin(langue, campaignId));
  return { succes: tr("generated"), envoi: Date.now() };
}

export async function actionRapportManuel(locale: string, campaignId: string, _etat: EtatFormulaire, formData: FormData): Promise<EtatFormulaire> {
  const { langue, admin, db, tr, erreur } = await contexte(locale);
  if (!uuid.safeParse(campaignId).success) return erreur("introuvable");
  const r = await creerRapportManuel(db, admin.id, campaignId, String(formData.get("langue") ?? ""));
  if (!r.ok) return erreur(r.erreur);
  revalidatePath(chemin(langue, campaignId));
  return { succes: tr("created"), envoi: Date.now() };
}

export async function actionInterrupteurIA(locale: string, campaignId: string, active: boolean): Promise<EtatFormulaire> {
  const { langue, admin, db, erreur } = await contexte(locale);
  if (!uuid.safeParse(campaignId).success) return erreur("introuvable");
  await changerIACampagne(db, admin.id, campaignId, active);
  revalidatePath(chemin(langue, campaignId));
  return { envoi: Date.now() };
}

export async function actionRefuserRapport(
  locale: string,
  campaignId: string,
  reportId: string,
  _etat: EtatFormulaire,
  formData: FormData,
): Promise<EtatFormulaire> {
  const { langue, admin, db, tr, erreur } = await contexte(locale);
  if (!uuid.safeParse(reportId).success) return erreur("introuvable");
  const r = await refuserRapport(db, admin.id, reportId, String(formData.get("motif") ?? ""));
  if (!r.ok) return erreur(r.erreur);
  revalidatePath(chemin(langue, campaignId));
  return { succes: tr("rejected"), envoi: Date.now() };
}

// Appelées par l'éditeur (composant client) avec le contenu complet du rapport
export async function actionEnregistrerRapport(locale: string, campaignId: string, reportId: string, contenu: unknown): Promise<EtatFormulaire> {
  const { langue, admin, db, tr, erreur } = await contexte(locale);
  if (!uuid.safeParse(reportId).success) return erreur("introuvable");
  const r = await enregistrerContenu(db, admin.id, reportId, contenu);
  if (!r.ok) return erreur(r.erreur);
  revalidatePath(chemin(langue, campaignId));
  return { succes: tr("saved"), envoi: Date.now() };
}

export async function actionValiderRapport(
  locale: string,
  campaignId: string,
  reportId: string,
  contenu: unknown,
  liste: unknown,
): Promise<EtatFormulaire> {
  const { langue, admin, db, erreur } = await contexte(locale);
  if (!uuid.safeParse(reportId).success) return erreur("introuvable");
  const r = await validerRapport(db, admin.id, reportId, { contenu, liste });
  if (!r.ok) return erreur(r.erreur);
  revalidatePath(chemin(langue, campaignId));
  return { envoi: Date.now() };
}
