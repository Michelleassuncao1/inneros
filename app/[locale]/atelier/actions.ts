"use server";

// Actions de la page publique d'un atelier (lien et QR code) : inscription, désinscription, avis anonyme.
// Aucune donnée de connexion n'est enregistrée. Un cookie technique (l'identifiant de l'atelier, rien d'autre)
// évite qu'un même appareil donne deux avis.
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import type { EtatFormulaire } from "@/components/FormulaireAction";
import { langueValide } from "@/i18n/locale";
import { cookieAvis, desinscrire, donnerAvis, inscrire, QUESTIONS_AVIS } from "@/lib/ateliers/ateliers";
import { getDb } from "@/lib/db/client";

async function textes(locale: string) {
  const langue = langueValide(locale);
  const t = await getTranslations({ locale: langue, namespace: "Erreurs" });
  const tp = await getTranslations({ locale: langue, namespace: "AtelierPublic" });
  return { langue, tp, erreur: (code: string) => ({ erreur: t.has(code) ? t(code) : t("inattendue") }) };
}

export async function actionInscrire(locale: string, code: string, _etat: EtatFormulaire, formData: FormData): Promise<EtatFormulaire> {
  const { langue, tp, erreur } = await textes(locale);
  if (String(formData.get("site") ?? "")) return erreur("saisieInvalide"); // champ piège invisible (robots)
  const r = await inscrire(getDb(), code, { nom: String(formData.get("nom") ?? ""), email: String(formData.get("email") ?? ""), langue });
  if (!r.ok) return erreur(r.erreur);
  return { succes: tp(r.valeur.statut === "inscrit" ? "registered" : "waitlisted"), envoi: Date.now() };
}

export async function actionDesinscrire(locale: string, code: string, jeton: string): Promise<EtatFormulaire> {
  const { tp, erreur } = await textes(locale);
  const r = await desinscrire(getDb(), code, jeton);
  if (!r.ok) return erreur(r.erreur);
  return { succes: tp("unsubscribed"), envoi: Date.now() };
}

export async function actionAvis(locale: string, code: string, atelierId: string, _etat: EtatFormulaire, formData: FormData): Promise<EtatFormulaire> {
  const { tp, erreur } = await textes(locale);
  const pot = await cookies();
  if (pot.get(cookieAvis(atelierId))) return erreur("atelierAvisDejaDonne");
  const reponses = Object.fromEntries(QUESTIONS_AVIS.map((q) => [q, Number(formData.get(q))]));
  const r = await donnerAvis(getDb(), code, { reponses, commentaire: String(formData.get("commentaire") ?? "") });
  if (!r.ok) return erreur(r.erreur);
  pot.set(cookieAvis(r.valeur.atelierId), "1", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 30 * 86_400, path: "/" });
  return { succes: tp("thanks"), envoi: Date.now() };
}
