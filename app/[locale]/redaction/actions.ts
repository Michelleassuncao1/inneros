"use server";

// Aide à la rédaction (module D2) : préparation du brouillon. Rien n'est enregistré, sauf la ligne du journal.
import { getTranslations } from "next-intl/server";
import { langueValide } from "@/i18n/locale";
import { utilisateurConnecte } from "@/lib/auth/acces";
import { getDb } from "@/lib/db/client";
import { preparerBrouillon, type Brouillon } from "@/lib/redaction/aide";

export type EtatRedaction = { erreur?: string; brouillon?: Brouillon };

export async function actionPreparerBrouillon(locale: string, saisie: { type: string; langue: string; notes: string; sansDonneesPersonnelles: boolean }): Promise<EtatRedaction> {
  const langue = langueValide(locale);
  const t = await getTranslations({ locale: langue, namespace: "Erreurs" });
  const erreur = (code: string) => ({ erreur: t.has(code) ? t(code) : t("inattendue") });
  const u = await utilisateurConnecte();
  if (!u) return erreur("introuvable");
  const r = await preparerBrouillon(getDb(), u, saisie);
  if (!r.ok) return erreur(r.erreur);
  return { brouillon: r.valeur };
}
