// Soutien proposé aux répondants, par campagne (décision de Michelle du 12 octobre 2026) :
// A. contacts internes à l'organisation (personne de confiance, médecin du travail…) ;
// B. contact IMA pour les questions sur la démarche (texte fixe, voir messages « Kit.contact ») ;
// C. accompagnement IMA facultatif, avec avertissements (pas un service d'urgence, aucun lien
//    avec les réponses, rien n'est transmis à l'employeur). À valider dans l'AIPD avant usage réel.
import { eq } from "drizzle-orm";
import { z } from "zod";
import { journaliser } from "../audit";
import { campaigns, organizations } from "../db/schema";
import type { Db } from "../db/types";
import type { CodePays } from "../pays";
import type { Resultat } from "./entreprises";

// Rôles proposés selon le pays de l'entreprise (tableau d'équivalences validé par Michelle le 12 octobre 2026).
// Les comités sans personne à contacter (CPPT, CSSCT) sont exclus.
export const ROLES_PAR_PAYS = {
  BE: ["personneConfiance", "conseillerPrevention", "cpap", "medecinTravail", "sipp", "sepp", "psychologue", "rh", "autre"],
  BR: ["medecinTravail", "sesmt", "cipa", "psychologue", "canalSignalement", "rh", "autre"],
  PT: ["servicoSst", "medecinTravail", "psychologue", "representantsTravailleurs", "rh", "autre"],
  FR: ["referentHarcelement", "medecinTravail", "preventeur", "cse", "psychologue", "rh", "autre"],
} as const satisfies Record<CodePays, readonly string[]>;
export type RoleContact = (typeof ROLES_PAR_PAYS)[CodePays][number];
export const ROLES_CONTACT: readonly RoleContact[] = [...new Set(Object.values(ROLES_PAR_PAYS).flat())];
export const rolesDuPays = (pays: string): readonly RoleContact[] => ROLES_PAR_PAYS[pays as CodePays] ?? [];
export const CONTACTS_MAXIMUM = 6;

const texte = (max: number) => z.string().trim().max(max);
// Un champ laissé vide dans le formulaire vaut « non renseigné »
const facultatif = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), schema.optional());

export const schemaContact = z
  .object({
    role: z.enum(ROLES_CONTACT as [RoleContact, ...RoleContact[]]),
    fonction: facultatif(texte(80)), // obligatoire pour « autre »
    nom: facultatif(texte(80)),
    telephone: facultatif(texte(40).min(4)),
    email: facultatif(z.string().trim().email().max(254)),
  })
  .refine((c) => c.role !== "autre" || (c.fonction?.length ?? 0) >= 2, { message: "fonction" })
  .refine((c) => !!(c.telephone || c.email), { message: "joignable" });

export const schemaSoutienIma = z
  .object({
    actif: z.boolean(),
    telephone: texte(40).optional(),
    email: z.union([z.literal(""), z.string().trim().email().max(254)]).optional(),
    lien: z.union([z.literal(""), z.string().trim().url().max(300).startsWith("https://")]).optional(),
    horaires: texte(120).optional(),
  })
  .refine((s) => !s.actif || !!(s.telephone || s.email || s.lien), { message: "canal" });

export type Contact = z.infer<typeof schemaContact>;
export type SoutienIma = z.infer<typeof schemaSoutienIma>;

export async function enregistrerSoutien(
  db: Db,
  adminId: string,
  campaignId: string,
  saisie: { contacts: unknown[]; ima: unknown },
): Promise<Resultat> {
  // Les lignes laissées vides dans le formulaire (ni fonction, ni nom, ni téléphone, ni e-mail) sont ignorées
  const remplie = (c: unknown) =>
    !!c &&
    typeof c === "object" &&
    ["fonction", "nom", "telephone", "email"].some((k) => String((c as Record<string, unknown>)[k] ?? "").trim() !== "");
  const contacts = z.array(schemaContact).max(CONTACTS_MAXIMUM).safeParse(saisie.contacts.filter(remplie));
  if (!contacts.success) return { ok: false, erreur: "soutienContactInvalide" };
  const ima = schemaSoutienIma.safeParse(saisie.ima);
  if (!ima.success) return { ok: false, erreur: "soutienImaInvalide" };

  const [ligne] = await db
    .select({ campagne: campaigns, pays: organizations.country })
    .from(campaigns)
    .innerJoin(organizations, eq(campaigns.organizationId, organizations.id))
    .where(eq(campaigns.id, campaignId));
  if (!ligne) return { ok: false, erreur: "introuvable" };
  if (ligne.campagne.status === "closed") return { ok: false, erreur: "campagneCloturee" };
  // Seuls les rôles du pays de l'entreprise sont acceptés
  if (contacts.data.some((c) => !rolesDuPays(ligne.pays).includes(c.role)))
    return { ok: false, erreur: "soutienContactInvalide" };

  await db
    .update(campaigns)
    .set({
      supportContacts: contacts.data.map((c) => ({ ...c, fonction: c.role === "autre" ? c.fonction : undefined })),
      imaSupport: ima.data.actif ? ima.data : null,
    })
    .where(eq(campaigns.id, campaignId));
  await journaliser(db, {
    actorUserId: adminId,
    action: "campaign_support_set",
    targetType: "campaign",
    targetId: campaignId,
    details: { contacts: contacts.data.length, ima: ima.data.actif },
  });
  return { ok: true, valeur: undefined };
}

// Lecture sûre de ce qui est enregistré en base
export function lireSoutien(campagne: { supportContacts: unknown; imaSupport: unknown }) {
  const contacts = z.array(schemaContact).safeParse(campagne.supportContacts);
  const ima = schemaSoutienIma.safeParse(campagne.imaSupport);
  return {
    contacts: contacts.success ? contacts.data : [],
    ima: ima.success && ima.data.actif ? ima.data : null,
  };
}

