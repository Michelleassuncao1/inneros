"use server";

// Actions de la bibliothèque de thèmes de sensibilisation (module B1), réservées aux administrateurs IMA.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import type { EtatFormulaire } from "@/components/FormulaireAction";
import { langueValide } from "@/i18n/locale";
import { exigerAdmin } from "@/lib/auth/acces";
import { getDb } from "@/lib/db/client";
import { creerAlerte, retirerAlerte } from "@/lib/sensibilisation/declencheurs";
import { archiverTheme, creerTheme, enregistrerKit, genererKitIA, modifierFiche, validerTheme } from "@/lib/sensibilisation/themes";

const uuid = z.string().uuid();
const lignes = (v: FormDataEntryValue | null) =>
  String(v ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

async function contexte(locale: string) {
  const langue = langueValide(locale);
  const admin = await exigerAdmin(langue);
  const t = await getTranslations({ locale: langue, namespace: "Erreurs" });
  const ts = await getTranslations({ locale: langue, namespace: "Sensibilisation" });
  return {
    langue,
    admin,
    db: getDb(),
    ts,
    erreur: (code: string) => ({ erreur: t.has(code) ? t(code) : t("inattendue") }),
  };
}

function lireFiche(f: FormData) {
  const mois = Number(f.get("mois"));
  const pays = f.getAll("pays").map(String);
  const evenements = f.getAll("evenements").map(String);
  return {
    code: String(f.get("code") ?? "").trim(),
    mois: mois >= 1 && mois <= 12 ? mois : null,
    journee: String(f.get("journee") ?? "").trim() || null,
    niveau_mindset: String(f.get("niveau") ?? "") || null,
    echelles: String(f.get("echelles") ?? "")
      .split(/[\s,;]+/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
    sensible: f.get("sensible") === "oui",
    pays: pays.length ? pays : null,
    evenements,
  };
}

export async function actionCreerTheme(locale: string, _etat: EtatFormulaire, formData: FormData): Promise<EtatFormulaire> {
  const { langue, admin, db, erreur } = await contexte(locale);
  const r = await creerTheme(db, admin.id, { fiche: lireFiche(formData), titre: String(formData.get("titre") ?? ""), objectif: String(formData.get("objectif") ?? "") });
  if (!r.ok) return erreur(r.erreur);
  redirect(`/${langue}/admin/sensibilisation/${r.valeur.id}`);
}

export async function actionFiche(locale: string, id: string, _etat: EtatFormulaire, formData: FormData): Promise<EtatFormulaire> {
  const { langue, admin, db, ts, erreur } = await contexte(locale);
  if (!uuid.safeParse(id).success) return erreur("introuvable");
  const r = await modifierFiche(db, admin.id, id, lireFiche(formData));
  if (!r.ok) return erreur(r.erreur);
  revalidatePath(`/${langue}/admin/sensibilisation/${id}`);
  return { succes: ts("saved"), envoi: Date.now() };
}

export async function actionKit(locale: string, id: string, langueKit: string, _etat: EtatFormulaire, formData: FormData): Promise<EtatFormulaire> {
  const { langue, admin, db, ts, erreur } = await contexte(locale);
  if (!uuid.safeParse(id).success) return erreur("introuvable");
  const champ = (n: string) => String(formData.get(n) ?? "").trim();
  const kit = {
    titre: champ("titre"),
    objectif: champ("objectif"),
    article: champ("article"),
    message_court: champ("message_court"),
    affiche: { titre: champ("affiche_titre"), texte: champ("affiche_texte") },
    questions: lignes(formData.get("questions")),
    email_managers: { objet: champ("email_objet"), texte: champ("email_texte") },
    fiche_animation: {
      duree_minutes: Number(formData.get("duree")) || 15,
      deroule: lignes(formData.get("deroule")),
      conseils: lignes(formData.get("conseils")),
    },
  };
  const r = await enregistrerKit(db, admin.id, id, langueKit, kit);
  if (!r.ok) return erreur(r.erreur);
  revalidatePath(`/${langue}/admin/sensibilisation/${id}`);
  return { succes: ts("saved"), envoi: Date.now() };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function actionGenererKit(locale: string, id: string, langueKit: string, _etat: EtatFormulaire): Promise<EtatFormulaire> {
  const { langue, admin, db, ts, erreur } = await contexte(locale);
  if (!uuid.safeParse(id).success) return erreur("introuvable");
  const r = await genererKitIA(db, admin.id, id, langueKit);
  if (!r.ok) return erreur(r.erreur);
  revalidatePath(`/${langue}/admin/sensibilisation/${id}`);
  return { succes: ts("generated"), envoi: Date.now() };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function actionValiderTheme(locale: string, id: string, _etat: EtatFormulaire): Promise<EtatFormulaire> {
  const { langue, admin, db, ts, erreur } = await contexte(locale);
  if (!uuid.safeParse(id).success) return erreur("introuvable");
  const r = await validerTheme(db, admin.id, id);
  if (!r.ok) return erreur(r.erreur);
  revalidatePath(`/${langue}/admin/sensibilisation/${id}`);
  return { succes: ts("validated"), envoi: Date.now() };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function actionArchiverTheme(locale: string, id: string, _etat: EtatFormulaire): Promise<EtatFormulaire> {
  const { langue, admin, db, erreur } = await contexte(locale);
  if (!uuid.safeParse(id).success) return erreur("introuvable");
  const r = await archiverTheme(db, admin.id, id);
  if (!r.ok) return erreur(r.erreur);
  redirect(`/${langue}/admin/sensibilisation`);
}

// --- Alertes réglementaires (module B3) -------------------------------------------------------------

export async function actionCreerAlerte(locale: string, _etat: EtatFormulaire, formData: FormData): Promise<EtatFormulaire> {
  const { langue, admin, db, ts, erreur } = await contexte(locale);
  const secteurs = formData.getAll("secteurs").map(String);
  const r = await creerAlerte(db, admin, {
    titre: String(formData.get("titre") ?? ""),
    message: String(formData.get("message") ?? ""),
    pays: formData.getAll("pays").map(String),
    secteurs: secteurs.length ? secteurs : null,
    themeIds: formData.getAll("themes").map(String),
    annee: Number(formData.get("annee")),
    mois: Number(formData.get("mois")),
  });
  if (!r.ok) return erreur(r.erreur);
  revalidatePath(`/${langue}/admin/sensibilisation/alertes`);
  return { succes: ts("alertCreated", { n: r.valeur.entreprises }), envoi: Date.now() };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function actionRetirerAlerte(locale: string, id: string, _etat: EtatFormulaire): Promise<EtatFormulaire> {
  const { langue, admin, db, ts, erreur } = await contexte(locale);
  if (!uuid.safeParse(id).success) return erreur("introuvable");
  const r = await retirerAlerte(db, admin, id);
  if (!r.ok) return erreur(r.erreur);
  revalidatePath(`/${langue}/admin/sensibilisation/alertes`);
  return { succes: ts("alertWithdrawn"), envoi: Date.now() };
}
