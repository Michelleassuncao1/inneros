"use server";

// Actions de la formation « IMA Talks — Utiliser l'IA dans InnerOS » (administrateurs IMA). Le quiz est corrigé
// sur le serveur : les bonnes réponses ne sont jamais envoyées au navigateur avant la correction.
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import type { EtatFormulaire } from "@/components/FormulaireAction";
import { langueValide } from "@/i18n/locale";
import { exigerAdmin } from "@/lib/auth/acces";
import { getDb } from "@/lib/db/client";
import { accuserLectureGuide, enregistrerFormation, soumettreQuiz } from "@/lib/formation/formation";

async function contexte(locale: string) {
  const langue = langueValide(locale);
  const admin = await exigerAdmin(langue);
  const t = await getTranslations({ locale: langue, namespace: "Erreurs" });
  return { langue, admin, db: getDb(), erreur: (code: string) => (t.has(code) ? t(code) : t("inattendue")) };
}

export async function actionLireGuide(locale: string): Promise<{ erreur?: string }> {
  const { langue, admin, db, erreur } = await contexte(locale);
  const r = await accuserLectureGuide(db, admin);
  if (!r.ok) return { erreur: erreur(r.erreur) };
  revalidatePath(`/${langue}/admin/formation-ia`);
  return {};
}

export type ResultatQuiz = { erreur?: string; score?: number; reussi?: boolean; details?: { id: string; juste: boolean; correcte: number; feedback: string }[] };

export async function actionQuiz(locale: string, reponses: Record<string, number>): Promise<ResultatQuiz> {
  const { langue, admin, db, erreur } = await contexte(locale);
  const lu = z.record(z.string().max(20), z.number().int().min(0).max(20)).safeParse(reponses);
  if (!lu.success) return { erreur: erreur("saisieInvalide") };
  const r = await soumettreQuiz(db, admin, lu.data);
  if (!r.ok) return { erreur: erreur(r.erreur) };
  revalidatePath(`/${langue}/admin/formation-ia`);
  return { score: r.valeur.score, reussi: r.valeur.reussi, details: r.valeur.details.map(({ id, juste, correcte, feedback }) => ({ id, juste, correcte, feedback })) };
}

export async function actionEnregistrerFormation(locale: string, _etat: EtatFormulaire, formData: FormData): Promise<EtatFormulaire> {
  const { langue, admin, db, erreur } = await contexte(locale);
  const r = await enregistrerFormation(db, admin, { date: String(formData.get("date") ?? ""), formationGenerale: String(formData.get("generale") ?? "") });
  if (!r.ok) return { erreur: erreur(r.erreur) };
  revalidatePath(`/${langue}/admin/formation-ia`);
  revalidatePath(`/${langue}/admin`);
  const t = await getTranslations({ locale: langue, namespace: "FormationIA" });
  return { succes: t("saved"), envoi: Date.now() };
}
