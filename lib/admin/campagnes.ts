// Campagnes (F4), groupes et questionnaires. Les règles de seuil sont vérifiées ici avec un
// message clair, puis une seconde fois par la base (contraintes et déclencheurs de l'étape 2).
import { and, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { journaliser } from "../audit";
import {
  campaignInstruments,
  campaignReferents,
  campaigns,
  groups,
  instruments,
  organizations,
  users,
} from "../db/schema";
import type { Db } from "../db/types";
import { LANGUES, type Resultat } from "./entreprises";

export const MANDATS = ["flash", "n1", "n2", "n3"] as const;
export const CRITERES = ["service", "department", "direction", "site", "function", "other"] as const;

// Seuil minimal de la plateforme : GROUP_MIN_SIZE, jamais moins de 10 (règle 3)
export function seuilPlateforme() {
  const valeur = Number(process.env.GROUP_MIN_SIZE);
  return Number.isInteger(valeur) && valeur > 10 ? valeur : 10;
}

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const texteOptionnel = z
  .string()
  .trim()
  .max(2000)
  .transform((s) => (s === "" ? null : s));

export const schemaCampagne = z
  .object({
    mandateType: z.enum(MANDATS),
    mandateReference: z.string().trim().min(2).max(120),
    diagnosticQuestion: texteOptionnel,
    perimeter: texteOptionnel,
    groupMinSize: z.coerce.number().int().max(1000),
    startDate: date,
    endDate: date,
    locales: z.array(z.enum(LANGUES)).min(1),
    groupingCriterion: z.enum(CRITERES),
  })
  .refine((c) => c.endDate >= c.startDate, { message: "dates", path: ["endDate"] });

export const schemaGroupe = z.object({
  label: z.string().trim().min(2).max(80),
  expectedSize: z.coerce.number().int().min(1).max(100000),
});

function erreurCampagne(e: z.ZodError) {
  return e.issues.some((i) => i.message === "dates") ? "datesIncoherentes" : "saisieInvalide";
}

export async function creerCampagne(
  db: Db,
  adminId: string,
  organizationId: string,
  saisie: unknown,
): Promise<Resultat<{ id: string }>> {
  const donnees = schemaCampagne.safeParse(saisie);
  if (!donnees.success) return { ok: false, erreur: erreurCampagne(donnees.error) };
  if (donnees.data.groupMinSize < seuilPlateforme()) return { ok: false, erreur: "seuilTropBas" };

  const [org] = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.id, organizationId));
  if (!org) return { ok: false, erreur: "introuvable" };

  const [campagne] = await db
    .insert(campaigns)
    .values({ ...donnees.data, organizationId, createdBy: adminId })
    .returning({ id: campaigns.id });
  await journaliser(db, {
    actorUserId: adminId,
    action: "campaign_created",
    targetType: "campaign",
    targetId: campagne.id,
  });
  return { ok: true, valeur: campagne };
}

async function campagneBrouillon(db: Db, campaignId: string) {
  const [campagne] = await db.select().from(campaigns).where(eq(campaigns.id, campaignId));
  if (!campagne) return { ok: false as const, erreur: "introuvable" };
  // Une fois la campagne ouverte, sa structure est figée : les réponses doivent rester comparables
  if (campagne.status !== "draft") return { ok: false as const, erreur: "campagneVerrouillee" };
  return { ok: true as const, campagne };
}

export async function modifierCampagne(
  db: Db,
  adminId: string,
  campaignId: string,
  saisie: unknown,
): Promise<Resultat> {
  const verif = await campagneBrouillon(db, campaignId);
  if (!verif.ok) return verif;
  const donnees = schemaCampagne.safeParse(saisie);
  if (!donnees.success) return { ok: false, erreur: erreurCampagne(donnees.error) };
  if (donnees.data.groupMinSize < seuilPlateforme()) return { ok: false, erreur: "seuilTropBas" };

  const groupesExistants = await db.select().from(groups).where(eq(groups.campaignId, campaignId));
  // Changer de critère avec des groupes existants mélangerait deux découpages
  if (groupesExistants.length && donnees.data.groupingCriterion !== verif.campagne.groupingCriterion) {
    return { ok: false, erreur: "critereVerrouille" };
  }
  if (groupesExistants.some((g) => g.expectedSize < donnees.data.groupMinSize)) {
    return { ok: false, erreur: "seuilAuDessusDunGroupe" };
  }

  await db.update(campaigns).set(donnees.data).where(eq(campaigns.id, campaignId));
  await journaliser(db, {
    actorUserId: adminId,
    action: "campaign_updated",
    targetType: "campaign",
    targetId: campaignId,
  });
  return { ok: true, valeur: undefined };
}

export async function ajouterGroupe(
  db: Db,
  adminId: string,
  campaignId: string,
  saisie: unknown,
): Promise<Resultat> {
  const verif = await campagneBrouillon(db, campaignId);
  if (!verif.ok) return verif;
  const donnees = schemaGroupe.safeParse(saisie);
  if (!donnees.success) return { ok: false, erreur: "saisieInvalide" };
  if (donnees.data.expectedSize < verif.campagne.groupMinSize) {
    return { ok: false, erreur: "groupeSousLeSeuil" };
  }

  const [doublon] = await db
    .select({ id: groups.id })
    .from(groups)
    .where(and(eq(groups.campaignId, campaignId), eq(groups.label, donnees.data.label)));
  if (doublon) return { ok: false, erreur: "groupeEnDouble" };

  const [groupe] = await db
    .insert(groups)
    .values({ ...donnees.data, campaignId })
    .returning({ id: groups.id });
  await journaliser(db, {
    actorUserId: adminId,
    action: "group_created",
    targetType: "group",
    targetId: groupe.id,
  });
  return { ok: true, valeur: undefined };
}

export async function supprimerGroupe(
  db: Db,
  adminId: string,
  campaignId: string,
  groupId: string,
): Promise<Resultat> {
  const verif = await campagneBrouillon(db, campaignId);
  if (!verif.ok) return verif;
  const [groupe] = await db
    .delete(groups)
    .where(and(eq(groups.id, groupId), eq(groups.campaignId, campaignId)))
    .returning({ id: groups.id });
  if (!groupe) return { ok: false, erreur: "introuvable" };
  await journaliser(db, {
    actorUserId: adminId,
    action: "group_deleted",
    targetType: "group",
    targetId: groupId,
  });
  return { ok: true, valeur: undefined };
}

export async function choisirQuestionnaires(
  db: Db,
  adminId: string,
  campaignId: string,
  instrumentIds: string[],
): Promise<Resultat> {
  const verif = await campagneBrouillon(db, campaignId);
  if (!verif.ok) return verif;
  const ids = z.array(z.string().uuid()).safeParse(instrumentIds);
  if (!ids.success) return { ok: false, erreur: "saisieInvalide" };

  const connus = ids.data.length
    ? await db
        .select({ id: instruments.id })
        .from(instruments)
        .where(inArray(instruments.id, ids.data))
    : [];
  if (connus.length !== new Set(ids.data).size) return { ok: false, erreur: "saisieInvalide" };

  await db.transaction(async (tx) => {
    await tx.delete(campaignInstruments).where(eq(campaignInstruments.campaignId, campaignId));
    if (connus.length) {
      await tx
        .insert(campaignInstruments)
        .values(connus.map((i) => ({ campaignId, instrumentId: i.id })));
    }
  });
  await journaliser(db, {
    actorUserId: adminId,
    action: "campaign_instruments_set",
    targetType: "campaign",
    targetId: campaignId,
    details: { instruments: connus.length },
  });
  return { ok: true, valeur: undefined };
}

// Référents ayant accès au rapport de la campagne (modifiable à tout moment).
// Seuls des référents actifs de l'entreprise de la campagne sont acceptés.
export async function choisirReferents(
  db: Db,
  adminId: string,
  campaignId: string,
  referentIds: string[],
): Promise<Resultat> {
  const ids = z.array(z.string().uuid()).safeParse(referentIds);
  if (!ids.success) return { ok: false, erreur: "saisieInvalide" };
  const [campagne] = await db.select().from(campaigns).where(eq(campaigns.id, campaignId));
  if (!campagne) return { ok: false, erreur: "introuvable" };

  const autorises = ids.data.length
    ? await db
        .select({ id: users.id })
        .from(users)
        .where(
          and(
            inArray(users.id, ids.data),
            eq(users.role, "referent"),
            eq(users.organizationId, campagne.organizationId),
            isNull(users.disabledAt),
          ),
        )
    : [];
  if (autorises.length !== new Set(ids.data).size) return { ok: false, erreur: "saisieInvalide" };

  await db.transaction(async (tx) => {
    await tx.delete(campaignReferents).where(eq(campaignReferents.campaignId, campaignId));
    if (autorises.length) {
      await tx.insert(campaignReferents).values(autorises.map((r) => ({ campaignId, userId: r.id })));
    }
  });
  await journaliser(db, {
    actorUserId: adminId,
    action: "campaign_referents_set",
    targetType: "campaign",
    targetId: campaignId,
    details: { referents: autorises.length },
  });
  return { ok: true, valeur: undefined };
}
