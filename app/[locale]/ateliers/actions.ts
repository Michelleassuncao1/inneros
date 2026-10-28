"use server";

// Actions des ateliers (module C), communes à IMA et au conseiller en prévention.
// L'utilisateur est revérifié à chaque appel ; les droits sont contrôlés par lib/ateliers et par la base.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import type { EtatFormulaire } from "@/components/FormulaireAction";
import { langueValide } from "@/i18n/locale";
import { annulerAtelier, creerAtelier, marquerPresences, modifierAtelier, repondreAppui, retirerInscription } from "@/lib/ateliers/ateliers";
import { utilisateurConnecte } from "@/lib/auth/acces";
import { getDb } from "@/lib/db/client";

async function contexte(locale: string) {
  const langue = langueValide(locale);
  const u = await utilisateurConnecte();
  if (!u) redirect(`/${langue}`);
  const t = await getTranslations({ locale: langue, namespace: "Erreurs" });
  const ta = await getTranslations({ locale: langue, namespace: "Ateliers" });
  return { langue, u, db: getDb(), ta, erreur: (code: string) => ({ erreur: t.has(code) ? t(code) : t("inattendue") }) };
}

const chemin = (langue: string, role: string, organizationId: string) =>
  role === "admin" ? `/${langue}/admin/entreprises/${organizationId}/ateliers` : `/${langue}/espace/ateliers`;

const saisie = (formData: FormData) => ({
  type: String(formData.get("type") ?? ""),
  titre: String(formData.get("titre") ?? ""),
  description: String(formData.get("description") ?? ""),
  date: String(formData.get("date") ?? ""),
  heure: String(formData.get("heure") ?? ""),
  duree: String(formData.get("duree") ?? ""),
  lieu: String(formData.get("lieu") ?? ""),
  places: String(formData.get("places") ?? ""),
  animateur: String(formData.get("animateur") ?? ""),
  campagne: String(formData.get("campagne") ?? ""),
  action: String(formData.get("action") ?? ""),
  appui: formData.get("appui") === "on",
  demandeAppui: String(formData.get("demandeAppui") ?? ""),
});

export async function actionCreerAtelier(locale: string, organizationId: string, _etat: EtatFormulaire, formData: FormData): Promise<EtatFormulaire> {
  const { langue, u, db, ta, erreur } = await contexte(locale);
  const r = await creerAtelier(db, u, organizationId, saisie(formData));
  if (!r.ok) return erreur(r.erreur);
  revalidatePath(chemin(langue, u.role, organizationId));
  return { succes: ta("created"), envoi: Date.now() };
}

export async function actionModifierAtelier(locale: string, organizationId: string, id: string, _etat: EtatFormulaire, formData: FormData): Promise<EtatFormulaire> {
  const { langue, u, db, ta, erreur } = await contexte(locale);
  const r = await modifierAtelier(db, u, id, saisie(formData));
  if (!r.ok) return erreur(r.erreur);
  revalidatePath(`${chemin(langue, u.role, organizationId)}/${id}`);
  return { succes: ta("saved"), envoi: Date.now() };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function actionAnnulerAtelier(locale: string, organizationId: string, id: string, _etat: EtatFormulaire): Promise<EtatFormulaire> {
  const { langue, u, db, ta, erreur } = await contexte(locale);
  const r = await annulerAtelier(db, u, id);
  if (!r.ok) return erreur(r.erreur);
  revalidatePath(`${chemin(langue, u.role, organizationId)}/${id}`);
  return { succes: ta("cancelled"), envoi: Date.now() };
}

export async function actionPresences(locale: string, organizationId: string, id: string, _etat: EtatFormulaire, formData: FormData): Promise<EtatFormulaire> {
  const { langue, u, db, ta, erreur } = await contexte(locale);
  const r = await marquerPresences(db, u, id, formData.getAll("present").map(String));
  if (!r.ok) return erreur(r.erreur);
  revalidatePath(`${chemin(langue, u.role, organizationId)}/${id}`);
  return { succes: ta("presenceSaved", { n: r.valeur.presents }), envoi: Date.now() };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function actionRetirerInscription(locale: string, organizationId: string, id: string, inscriptionId: string, _etat: EtatFormulaire): Promise<EtatFormulaire> {
  const { langue, u, db, ta, erreur } = await contexte(locale);
  const r = await retirerInscription(db, u, inscriptionId);
  if (!r.ok) return erreur(r.erreur);
  revalidatePath(`${chemin(langue, u.role, organizationId)}/${id}`);
  return { succes: ta("removed"), envoi: Date.now() };
}

export async function actionRepondreAppui(locale: string, id: string, accepte: boolean, _etat: EtatFormulaire, formData: FormData): Promise<EtatFormulaire> {
  const { langue, u, db, ta, erreur } = await contexte(locale);
  const r = await repondreAppui(db, u, id, { accepte, reponse: String(formData.get("reponse") ?? ""), animateurId: String(formData.get("animateur") ?? "") });
  if (!r.ok) return erreur(r.erreur);
  revalidatePath(`/${langue}/admin/ateliers`);
  return { succes: ta(accepte ? "accepted" : "refused"), envoi: Date.now() };
}
