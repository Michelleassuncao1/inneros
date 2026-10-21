"use server";

// Actions du registre des risques RPS (module A1), communes à IMA et au conseiller en prévention.
// L'utilisateur est revérifié à chaque appel ; les droits sont contrôlés par lib/risques et par la base.
// L'adresse de retour est déduite du rôle, jamais reçue du navigateur.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import type { EtatFormulaire } from "@/components/FormulaireAction";
import { langueValide } from "@/i18n/locale";
import { exigerAdmin, utilisateurConnecte } from "@/lib/auth/acces";
import { getDb } from "@/lib/db/client";
import { creerRisque, designerConseillerPrevention, importerCampagne, modifierRisque, supprimerRisque, type SaisieRisque } from "@/lib/risques/registre";
import { risks } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const uuid = z.string().uuid();
const origine = z.object({ campaignId: uuid, instrumentId: uuid, scaleId: z.string().regex(/^[a-z0-9]{1,20}$/) });

async function contexte(locale: string) {
  const langue = langueValide(locale);
  const u = await utilisateurConnecte();
  if (!u) redirect(`/${langue}`);
  const t = await getTranslations({ locale: langue, namespace: "Erreurs" });
  const tr = await getTranslations({ locale: langue, namespace: "Risques" });
  return { langue, u, db: getDb(), tr, erreur: (code: string) => ({ erreur: t.has(code) ? t(code) : t("inattendue") }) };
}

const chemin = (langue: string, role: string, organizationId: string) =>
  role === "admin" ? `/${langue}/admin/entreprises/${organizationId}/risques` : `/${langue}/espace/risques`;

function lireSaisie(f: FormData): SaisieRisque {
  const champ = (n: string) => String(f.get(n) ?? "");
  return {
    titre: champ("titre"),
    description: champ("description"),
    niveau: (champ("niveau") || null) as SaisieRisque["niveau"],
    groupes: f.getAll("groupes").map(String),
    p: champ("p") as unknown as number,
    e: champ("e") as unknown as number,
    g: champ("g") as unknown as number,
    justification: champ("justification"),
    statut: (champ("statut") || "ouvert") as SaisieRisque["statut"],
  };
}

export async function actionCreerRisque(
  locale: string,
  organizationId: string,
  source: unknown,
  _etat: EtatFormulaire,
  formData: FormData,
): Promise<EtatFormulaire> {
  const { langue, u, db, tr, erreur } = await contexte(locale);
  if (!uuid.safeParse(organizationId).success) return erreur("introuvable");
  const o = source === null ? null : origine.safeParse(source);
  if (o && !o.success) return erreur("introuvable");
  const r = await creerRisque(db, u, organizationId, lireSaisie(formData), o?.data, langue);
  if (!r.ok) return erreur(r.erreur);
  revalidatePath(chemin(langue, u.role, organizationId));
  return { succes: tr("added"), envoi: Date.now() };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function actionImporterCampagne(locale: string, organizationId: string, campaignId: string, _etat: EtatFormulaire): Promise<EtatFormulaire> {
  const { langue, u, db, tr, erreur } = await contexte(locale);
  if (!uuid.safeParse(organizationId).success || !uuid.safeParse(campaignId).success) return erreur("introuvable");
  const r = await importerCampagne(db, u, organizationId, campaignId, langue);
  if (!r.ok) return erreur(r.erreur);
  revalidatePath(chemin(langue, u.role, organizationId));
  return { succes: tr("imported", { n: r.valeur.nombre }), envoi: Date.now() };
}

export async function actionModifierRisque(locale: string, riskId: string, _etat: EtatFormulaire, formData: FormData): Promise<EtatFormulaire> {
  const { langue, u, db, erreur } = await contexte(locale);
  if (!uuid.safeParse(riskId).success) return erreur("introuvable");
  const r = await modifierRisque(db, u, riskId, lireSaisie(formData), langue);
  if (!r.ok) return erreur(r.erreur);
  const [ligne] = await db.select({ organizationId: risks.organizationId }).from(risks).where(eq(risks.id, riskId));
  redirect(chemin(langue, u.role, ligne.organizationId));
}

// (l'état précédent du formulaire est imposé par useActionState, sans utilité ici)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function actionSupprimerRisque(locale: string, riskId: string, _etat: EtatFormulaire): Promise<EtatFormulaire> {
  const { langue, u, db, erreur } = await contexte(locale);
  if (!uuid.safeParse(riskId).success) return erreur("introuvable");
  const [ligne] = await db.select({ organizationId: risks.organizationId }).from(risks).where(eq(risks.id, riskId));
  const r = await supprimerRisque(db, u, riskId);
  if (!r.ok) return erreur(r.erreur);
  redirect(chemin(langue, u.role, ligne.organizationId));
}

// IMA : désigner ou retirer le conseiller en prévention parmi les référents de l'entreprise
export async function actionConseillerPrevention(locale: string, organizationId: string, referentId: string, valeur: boolean) {
  const langue = langueValide(locale);
  const admin = await exigerAdmin(langue);
  if (!uuid.safeParse(referentId).success) return;
  await designerConseillerPrevention(getDb(), admin.id, organizationId, referentId, valeur);
  revalidatePath(`/${langue}/admin/entreprises/${organizationId}`);
}
