// Soutien proposé aux répondants, par campagne (décision de Michelle du 12 octobre 2026) :
// A. contacts internes à l'organisation (personne de confiance, médecin du travail…) ;
// B. contact IMA pour les questions sur la démarche (texte fixe, voir messages « Kit.contact ») ;
// C. accompagnement IMA facultatif, avec avertissements (pas un service d'urgence, aucun lien
//    avec les réponses, rien n'est transmis à l'employeur). À valider dans l'AIPD avant usage réel.
import { eq } from "drizzle-orm";
import { z } from "zod";
import { journaliser } from "../audit";
import { campaigns } from "../db/schema";
import type { Db } from "../db/types";
import type { Resultat } from "./entreprises";

export const ROLES_CONTACT = [
  "personneConfiance",
  "conseillerPrevention",
  "medecinTravail",
  "servicePrevention",
  "sesmt",
  "cipa",
  "psychologue",
  "rh",
  "autre",
] as const;
export const CONTACTS_MAXIMUM = 6;

const texte = (max: number) => z.string().trim().max(max);

export const schemaContact = z
  .object({
    role: z.enum(ROLES_CONTACT),
    libelle: texte(80).optional(), // obligatoire pour « autre »
    coordonnees: texte(200).min(2),
  })
  .refine((c) => c.role !== "autre" || (c.libelle?.length ?? 0) >= 2, { message: "libelle" });

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
  // Les lignes laissées vides dans le formulaire sont ignorées
  const lignes = saisie.contacts.filter(
    (c) => c && typeof c === "object" && String((c as { coordonnees?: unknown }).coordonnees ?? "").trim() !== "",
  );
  const contacts = z.array(schemaContact).max(CONTACTS_MAXIMUM).safeParse(lignes);
  if (!contacts.success) return { ok: false, erreur: "soutienContactInvalide" };
  const ima = schemaSoutienIma.safeParse(saisie.ima);
  if (!ima.success) return { ok: false, erreur: "soutienImaInvalide" };

  const [campagne] = await db.select().from(campaigns).where(eq(campaigns.id, campaignId));
  if (!campagne) return { ok: false, erreur: "introuvable" };
  if (campagne.status === "closed") return { ok: false, erreur: "campagneCloturee" };

  await db
    .update(campaigns)
    .set({
      supportContacts: contacts.data.map((c) => ({ ...c, libelle: c.role === "autre" ? c.libelle : undefined })),
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
