"use server";

// Actions de l'espace administrateur. Chaque action revérifie l'administrateur :
// une action serveur peut être appelée directement, sans passer par la page.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import type { EtatFormulaire } from "@/components/FormulaireAction";
import { langueValide } from "@/i18n/locale";
import {
  ajouterGroupe,
  choisirQuestionnaires,
  choisirReferents,
  creerCampagne,
  modifierCampagne,
  supprimerGroupe,
} from "@/lib/admin/campagnes";
import {
  ajouterReferent,
  changerEtatReferent,
  creerEntreprise,
  modifierEntreprise,
  modifierReferent,
  supprimerReferent,
} from "@/lib/admin/entreprises";
import { cloturerCampagne, ouvrirCampagne } from "@/lib/admin/cycle";
import { genererJetons, revoquerJetonsNonUtilises } from "@/lib/admin/jetons";
import { exigerAdmin } from "@/lib/auth/acces";
import { getDb } from "@/lib/db/client";

const uuid = z.string().uuid();

async function contexte(locale: string) {
  const langue = langueValide(locale);
  const admin = await exigerAdmin(langue);
  const t = await getTranslations({ locale: langue, namespace: "Erreurs" });
  return { langue, admin, db: getDb(), erreur: (code: string) => ({ erreur: t(code) }) };
}

function champs(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

function saisieCampagne(formData: FormData) {
  return { ...champs(formData), locales: formData.getAll("locales") };
}

// ─── Entreprises ─────────────────────────────────────────────────────────────

export async function actionCreerEntreprise(
  locale: string,
  _etat: EtatFormulaire,
  formData: FormData,
): Promise<EtatFormulaire> {
  const { langue, admin, db, erreur } = await contexte(locale);
  const r = await creerEntreprise(db, admin.id, champs(formData));
  if (!r.ok) return erreur(r.erreur);
  redirect(`/${langue}/admin/entreprises/${r.valeur.id}`);
}

export async function actionModifierEntreprise(
  locale: string,
  id: string,
  _etat: EtatFormulaire,
  formData: FormData,
): Promise<EtatFormulaire> {
  const { langue, admin, db, erreur } = await contexte(locale);
  if (!uuid.safeParse(id).success) return erreur("introuvable");
  const r = await modifierEntreprise(db, admin.id, id, champs(formData));
  if (!r.ok) return erreur(r.erreur);
  revalidatePath(`/${langue}/admin/entreprises`);
  const t = await getTranslations({ locale: langue, namespace: "Entreprises" });
  return { succes: t("saved"), envoi: Date.now() };
}

export async function actionAjouterReferent(
  locale: string,
  organizationId: string,
  _etat: EtatFormulaire,
  formData: FormData,
): Promise<EtatFormulaire> {
  const { langue, admin, db, erreur } = await contexte(locale);
  if (!uuid.safeParse(organizationId).success) return erreur("introuvable");
  const r = await ajouterReferent(db, admin.id, organizationId, champs(formData));
  if (!r.ok) return erreur(r.erreur);
  revalidatePath(`/${langue}/admin/entreprises/${organizationId}`);
  const t = await getTranslations({ locale: langue, namespace: "Entreprises" });
  return { succes: t("referentAdded"), envoi: Date.now() };
}

export async function actionModifierReferent(
  locale: string,
  organizationId: string,
  referentId: string,
  _etat: EtatFormulaire,
  formData: FormData,
): Promise<EtatFormulaire> {
  const { langue, admin, db, erreur } = await contexte(locale);
  if (!uuid.safeParse(referentId).success) return erreur("introuvable");
  const r = await modifierReferent(db, admin.id, referentId, champs(formData));
  if (!r.ok) return erreur(r.erreur);
  revalidatePath(`/${langue}/admin/entreprises/${organizationId}`);
  const t = await getTranslations({ locale: langue, namespace: "Entreprises" });
  return { succes: t("referentUpdated"), envoi: Date.now() };
}

export async function actionEtatReferent(
  locale: string,
  organizationId: string,
  referentId: string,
  actif: boolean,
) {
  const { langue, admin, db } = await contexte(locale);
  if (!uuid.safeParse(referentId).success) return;
  await changerEtatReferent(db, admin.id, referentId, actif);
  revalidatePath(`/${langue}/admin/entreprises/${organizationId}`);
}

export async function actionSupprimerReferent(locale: string, organizationId: string, referentId: string) {
  const { langue, admin, db } = await contexte(locale);
  if (!uuid.safeParse(referentId).success) return;
  await supprimerReferent(db, admin.id, referentId);
  revalidatePath(`/${langue}/admin/entreprises/${organizationId}`);
}

// ─── Campagnes ───────────────────────────────────────────────────────────────

export async function actionCreerCampagne(
  locale: string,
  organizationId: string,
  _etat: EtatFormulaire,
  formData: FormData,
): Promise<EtatFormulaire> {
  const { langue, admin, db, erreur } = await contexte(locale);
  if (!uuid.safeParse(organizationId).success) return erreur("introuvable");
  const r = await creerCampagne(db, admin.id, organizationId, saisieCampagne(formData));
  if (!r.ok) return erreur(r.erreur);
  redirect(`/${langue}/admin/campagnes/${r.valeur.id}`);
}

export async function actionModifierCampagne(
  locale: string,
  id: string,
  _etat: EtatFormulaire,
  formData: FormData,
): Promise<EtatFormulaire> {
  const { langue, admin, db, erreur } = await contexte(locale);
  if (!uuid.safeParse(id).success) return erreur("introuvable");
  const r = await modifierCampagne(db, admin.id, id, saisieCampagne(formData));
  if (!r.ok) return erreur(r.erreur);
  revalidatePath(`/${langue}/admin/campagnes/${id}`);
  const t = await getTranslations({ locale: langue, namespace: "Campagnes" });
  return { succes: t("saved"), envoi: Date.now() };
}

export async function actionQuestionnaires(
  locale: string,
  id: string,
  _etat: EtatFormulaire,
  formData: FormData,
): Promise<EtatFormulaire> {
  const { langue, admin, db, erreur } = await contexte(locale);
  if (!uuid.safeParse(id).success) return erreur("introuvable");
  const ids = formData.getAll("instruments").map(String);
  const r = await choisirQuestionnaires(db, admin.id, id, ids);
  if (!r.ok) return erreur(r.erreur);
  revalidatePath(`/${langue}/admin/campagnes/${id}`);
  const t = await getTranslations({ locale: langue, namespace: "Campagnes" });
  return { succes: t("saved"), envoi: Date.now() };
}

export async function actionReferentsCampagne(
  locale: string,
  id: string,
  _etat: EtatFormulaire,
  formData: FormData,
): Promise<EtatFormulaire> {
  const { langue, admin, db, erreur } = await contexte(locale);
  if (!uuid.safeParse(id).success) return erreur("introuvable");
  const r = await choisirReferents(db, admin.id, id, formData.getAll("referents").map(String));
  if (!r.ok) return erreur(r.erreur);
  revalidatePath(`/${langue}/admin/campagnes/${id}`);
  const t = await getTranslations({ locale: langue, namespace: "Campagnes" });
  return { succes: t("saved"), envoi: Date.now() };
}

export async function actionAjouterGroupe(
  locale: string,
  id: string,
  _etat: EtatFormulaire,
  formData: FormData,
): Promise<EtatFormulaire> {
  const { langue, admin, db, erreur } = await contexte(locale);
  if (!uuid.safeParse(id).success) return erreur("introuvable");
  const r = await ajouterGroupe(db, admin.id, id, champs(formData));
  if (!r.ok) return erreur(r.erreur);
  revalidatePath(`/${langue}/admin/campagnes/${id}`);
  const t = await getTranslations({ locale: langue, namespace: "Campagnes" });
  return { succes: t("groupAdded"), envoi: Date.now() };
}

export async function actionSupprimerGroupe(locale: string, id: string, groupId: string) {
  const { langue, admin, db } = await contexte(locale);
  if (!uuid.safeParse(id).success || !uuid.safeParse(groupId).success) return;
  await supprimerGroupe(db, admin.id, id, groupId);
  revalidatePath(`/${langue}/admin/campagnes/${id}`);
}

// ─── Jetons, ouverture, clôture ──────────────────────────────────────────────

export type EtatJetons = { erreur?: string; codes?: string[]; envoi?: number };

// Les codes reviennent une seule fois vers le navigateur de l'administrateur ; ils ne sont pas stockés
export async function actionGenererJetons(
  locale: string,
  id: string,
  _etat: EtatJetons,
  formData: FormData,
): Promise<EtatJetons> {
  const { langue, admin, db, erreur } = await contexte(locale);
  if (!uuid.safeParse(id).success) return erreur("introuvable");
  const r = await genererJetons(db, admin.id, id, formData.get("nombre"));
  if (!r.ok) return erreur(r.erreur);
  revalidatePath(`/${langue}/admin/campagnes/${id}`);
  return { codes: r.valeur.codes, envoi: Date.now() };
}

export async function actionRevoquerJetons(locale: string, id: string) {
  const { langue, admin, db } = await contexte(locale);
  if (!uuid.safeParse(id).success) return;
  await revoquerJetonsNonUtilises(db, admin.id, id);
  revalidatePath(`/${langue}/admin/campagnes/${id}`);
}

export async function actionOuvrirCampagne(
  locale: string,
  id: string,
  _etat: EtatFormulaire,
  formData: FormData,
): Promise<EtatFormulaire> {
  const { langue, admin, db, erreur } = await contexte(locale);
  if (!uuid.safeParse(id).success) return erreur("introuvable");
  const r = await ouvrirCampagne(db, admin.id, id, champs(formData));
  if (!r.ok) return erreur(r.erreur);
  revalidatePath(`/${langue}/admin/campagnes/${id}`);
  const t = await getTranslations({ locale: langue, namespace: "Campagnes" });
  return { succes: t("saved"), envoi: Date.now() };
}

export async function actionCloturerCampagne(locale: string, id: string) {
  const { langue, admin, db } = await contexte(locale);
  if (!uuid.safeParse(id).success) return;
  await cloturerCampagne(db, admin.id, id);
  revalidatePath(`/${langue}/admin/campagnes/${id}`);
}
