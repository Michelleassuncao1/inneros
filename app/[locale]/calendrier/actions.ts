"use server";

// Actions du calendrier de sensibilisation (modules B2 et B3), communes à IMA et au conseiller en prévention.
// L'utilisateur est revérifié à chaque appel ; les droits sont contrôlés par lib/sensibilisation et par la base.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import type { EtatFormulaire } from "@/components/FormulaireAction";
import { langueValide } from "@/i18n/locale";
import { utilisateurConnecte } from "@/lib/auth/acces";
import { getDb } from "@/lib/db/client";
import { ajouterCampagne, majCampagne, proposerCalendrier } from "@/lib/sensibilisation/calendrier";
import { accepterProposition, declarerEvenement, lierActionPlan, refuserProposition } from "@/lib/sensibilisation/declencheurs";

const uuid = z.string().uuid();

async function contexte(locale: string) {
  const langue = langueValide(locale);
  const u = await utilisateurConnecte();
  if (!u) redirect(`/${langue}`);
  const t = await getTranslations({ locale: langue, namespace: "Erreurs" });
  const tc = await getTranslations({ locale: langue, namespace: "Calendrier" });
  return { langue, u, db: getDb(), tc, erreur: (code: string) => ({ erreur: t.has(code) ? t(code) : t("inattendue") }) };
}

const chemin = (langue: string, role: string, organizationId: string) =>
  role === "admin" ? `/${langue}/admin/entreprises/${organizationId}/sensibilisation` : `/${langue}/espace/sensibilisation`;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function actionProposerCalendrier(locale: string, organizationId: string, annee: number, _etat: EtatFormulaire): Promise<EtatFormulaire> {
  const { langue, u, db, tc, erreur } = await contexte(locale);
  if (!uuid.safeParse(organizationId).success) return erreur("introuvable");
  const r = await proposerCalendrier(db, u, organizationId, Number(annee));
  if (!r.ok) return erreur(r.erreur);
  revalidatePath(chemin(langue, u.role, organizationId));
  return { succes: tc("proposed", { n: r.valeur.nombre }), envoi: Date.now() };
}

export async function actionAjouterCampagne(locale: string, organizationId: string, annee: number, _etat: EtatFormulaire, formData: FormData): Promise<EtatFormulaire> {
  const { langue, u, db, tc, erreur } = await contexte(locale);
  if (!uuid.safeParse(organizationId).success) return erreur("introuvable");
  const r = await ajouterCampagne(db, u, organizationId, { themeId: String(formData.get("theme") ?? ""), annee: Number(annee), mois: Number(formData.get("mois")) });
  if (!r.ok) return erreur(r.erreur);
  revalidatePath(chemin(langue, u.role, organizationId));
  return { succes: tc("added"), envoi: Date.now() };
}

export async function actionMajCampagne(locale: string, organizationId: string, id: string, _etat: EtatFormulaire, formData: FormData): Promise<EtatFormulaire> {
  const { langue, u, db, tc, erreur } = await contexte(locale);
  if (!uuid.safeParse(id).success) return erreur("introuvable");
  const r = await majCampagne(db, u, id, {
    mois: Number(formData.get("mois")),
    statut: String(formData.get("statut") ?? ""),
    diffuseeLe: String(formData.get("diffuseeLe") ?? ""),
    commentaire: String(formData.get("commentaire") ?? ""),
  });
  if (!r.ok) return erreur(r.erreur);
  revalidatePath(chemin(langue, u.role, organizationId));
  return { succes: tc("saved"), envoi: Date.now() };
}

// --- Module B3 : propositions, événements, lien avec le plan ---------------------------------------

export async function actionAccepterProposition(locale: string, organizationId: string, id: string, _etat: EtatFormulaire, formData: FormData): Promise<EtatFormulaire> {
  const { langue, u, db, tc, erreur } = await contexte(locale);
  if (!uuid.safeParse(id).success) return erreur("introuvable");
  const r = await accepterProposition(db, u, id, { mois: Number(formData.get("mois")) });
  if (!r.ok) return erreur(r.erreur);
  revalidatePath(chemin(langue, u.role, organizationId));
  return { succes: tc("accepted"), envoi: Date.now() };
}

export async function actionRefuserProposition(locale: string, organizationId: string, id: string, _etat: EtatFormulaire, formData: FormData): Promise<EtatFormulaire> {
  const { langue, u, db, tc, erreur } = await contexte(locale);
  if (!uuid.safeParse(id).success) return erreur("introuvable");
  const r = await refuserProposition(db, u, id, String(formData.get("motif") ?? ""));
  if (!r.ok) return erreur(r.erreur);
  revalidatePath(chemin(langue, u.role, organizationId));
  return { succes: tc("refused"), envoi: Date.now() };
}

export async function actionDeclarerEvenement(locale: string, organizationId: string, _etat: EtatFormulaire, formData: FormData): Promise<EtatFormulaire> {
  const { langue, u, db, tc, erreur } = await contexte(locale);
  if (!uuid.safeParse(organizationId).success) return erreur("introuvable");
  const r = await declarerEvenement(db, u, organizationId, { type: String(formData.get("type") ?? ""), date: String(formData.get("date") ?? "") });
  if (!r.ok) return erreur(r.erreur);
  revalidatePath(chemin(langue, u.role, organizationId));
  return { succes: r.valeur.deces ? tc("declaredDeces") : tc("declared", { n: r.valeur.propositions }), envoi: Date.now() };
}

export async function actionLierAction(locale: string, organizationId: string, id: string, _etat: EtatFormulaire, formData: FormData): Promise<EtatFormulaire> {
  const { langue, u, db, tc, erreur } = await contexte(locale);
  if (!uuid.safeParse(id).success) return erreur("introuvable");
  const r = await lierActionPlan(db, u, id, String(formData.get("action") ?? "") || null);
  if (!r.ok) return erreur(r.erreur);
  revalidatePath(chemin(langue, u.role, organizationId));
  return { succes: tc("linked"), envoi: Date.now() };
}
