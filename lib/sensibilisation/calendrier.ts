// Calendrier de sensibilisation d'une entreprise (module B2, décisions de Michelle du 23/10/2026) :
// - le conseiller en prévention (et IMA) planifie les campagnes : calendrier annuel proposé à partir des thèmes
//   validés (un par mois), ajout, déplacement, retrait ; suivi « prévue → diffusée → réalisée » ;
// - les autres référents de l'entreprise consultent le calendrier ;
// - le kit est complété automatiquement par les personnes de soutien de l'entreprise et les numéros d'aide du pays ;
// - rappel mensuel par e-mail au conseiller (aucun contenu sensible).
import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { journaliser } from "../audit";
import { lireSoutien } from "../admin/soutien";
import { auditLog, awarenessCampaigns, awarenessSuggestions, campaigns, organizations, users } from "../db/schema";
import type { Db } from "../db/types";
import { envoyerEmail, type Email } from "../email/brevo";
import { emailIMA } from "../email/modele";
import { aidesPour } from "../pays";
import type { Resultat } from "../rapport/rapports";
import { peutModifierRegistre } from "../risques/registre";
import { traducteur } from "../traduction";
import { LANGUES_THEME, type Kit, type LangueTheme } from "./contenu";
import { themeParId, themesValides, type Theme } from "./themes";

type Utilisateur = typeof users.$inferSelect;
type Campagne = typeof awarenessCampaigns.$inferSelect;

export const STATUTS_SENSIB = ["prevue", "diffusee", "realisee", "retiree"] as const;

// Lecture : IMA, et tout référent actif de l'entreprise ; écriture : IMA et le conseiller en prévention
export function peutLireCalendrier(u: Utilisateur, organizationId: string) {
  if (u.disabledAt) return false;
  return u.role === "admin" || (u.role === "referent" && u.organizationId === organizationId);
}
export const peutModifierCalendrier = peutModifierRegistre;

const sansCoordonnees = (s: string) => !/[^\s@]+@[^\s@]+\.[^\s@]+/.test(s) && !/(\+?\d[\s.-]?){8,}/.test(s);

// --- Lecture ----------------------------------------------------------------------------------

export async function lireCalendrier(db: Db, u: Utilisateur, organizationId: string, annee: number) {
  if (!peutLireCalendrier(u, organizationId)) return null;
  const lignes = await db
    .select()
    .from(awarenessCampaigns)
    .where(and(eq(awarenessCampaigns.organizationId, organizationId), eq(awarenessCampaigns.year, annee)));
  const themes = new Map<string, Theme>();
  for (const l of lignes) if (!themes.has(l.themeId)) themes.set(l.themeId, (await themeParId(db, l.themeId))!);
  return lignes
    .map((c) => ({ ...c, theme: themes.get(c.themeId)! }))
    .sort((a, b) => a.month - b.month || a.createdAt.getTime() - b.createdAt.getTime());
}

async function paysDe(db: Db, organizationId: string) {
  const [o] = await db.select({ country: organizations.country, locale: organizations.locale }).from(organizations).where(eq(organizations.id, organizationId));
  return o ?? null;
}

// Thèmes validés disponibles pour l'entreprise (pays), avec ceux déjà au calendrier de l'année
export async function themesDisponibles(db: Db, organizationId: string, annee: number) {
  const org = await paysDe(db, organizationId);
  if (!org) return [];
  const deja = new Set(
    (await db.select({ themeId: awarenessCampaigns.themeId }).from(awarenessCampaigns).where(and(eq(awarenessCampaigns.organizationId, organizationId), eq(awarenessCampaigns.year, annee)))).map(
      (c) => c.themeId,
    ),
  );
  return (await themesValides(db, org.country)).map((t) => ({ ...t, dejaPrevu: deja.has(t.id) }));
}

// --- Écriture ---------------------------------------------------------------------------------

const annee = z.number().int().min(2020).max(2100);
const mois = z.number().int().min(1).max(12);

// Calendrier annuel proposé : chaque thème validé qui a un mois, s'il n'est pas déjà prévu cette année
export async function proposerCalendrier(db: Db, u: Utilisateur, organizationId: string, anneeSaisie: number): Promise<Resultat<{ nombre: number }>> {
  if (!peutModifierCalendrier(u, organizationId)) return { ok: false, erreur: "introuvable" };
  const a = annee.safeParse(anneeSaisie);
  if (!a.success) return { ok: false, erreur: "saisieInvalide" };
  const aAjouter = (await themesDisponibles(db, organizationId, a.data)).filter((t) => !t.dejaPrevu && t.fiche?.mois);
  if (aAjouter.length)
    await db.insert(awarenessCampaigns).values(
      aAjouter.map((t) => ({
        organizationId,
        themeId: t.id,
        year: a.data,
        month: t.fiche!.mois!,
        origin: "programmee" as const,
        createdBy: u.id,
        updatedBy: u.id,
      })),
    );
  await journaliser(db, { actorUserId: u.id, action: "awareness_calendar_proposed", targetType: "organization", targetId: organizationId, details: { annee: a.data, nombre: aAjouter.length } });
  return { ok: true, valeur: { nombre: aAjouter.length } };
}

export async function ajouterCampagne(
  db: Db,
  u: Utilisateur,
  organizationId: string,
  saisie: { themeId: string; annee: number; mois: number },
  origine: { origin: Campagne["origin"]; originRef?: string | null } = { origin: "manuelle" },
): Promise<Resultat<{ id: string }>> {
  if (!peutModifierCalendrier(u, organizationId)) return { ok: false, erreur: "introuvable" };
  const a = annee.safeParse(saisie.annee);
  const m = mois.safeParse(saisie.mois);
  if (!a.success || !m.success || !z.string().uuid().safeParse(saisie.themeId).success) return { ok: false, erreur: "saisieInvalide" };
  const theme = (await themesDisponibles(db, organizationId, a.data)).find((t) => t.id === saisie.themeId);
  if (!theme) return { ok: false, erreur: "introuvable" };
  if (theme.dejaPrevu) return { ok: false, erreur: "campagneSensibDejaPrevue" };
  const [c] = await db
    .insert(awarenessCampaigns)
    .values({ organizationId, themeId: theme.id, year: a.data, month: m.data, origin: origine.origin, originRef: origine.originRef ?? null, createdBy: u.id, updatedBy: u.id })
    .returning({ id: awarenessCampaigns.id });
  await journaliser(db, { actorUserId: u.id, action: "awareness_campaign_added", targetType: "organization", targetId: organizationId, details: { theme: theme.code, mois: m.data, origine: origine.origin } });
  return { ok: true, valeur: { id: c.id } };
}

async function campagneModifiable(db: Db, u: Utilisateur, id: string) {
  const [c] = await db.select().from(awarenessCampaigns).where(eq(awarenessCampaigns.id, id));
  if (!c || !peutModifierCalendrier(u, c.organizationId)) return null;
  return c;
}

export async function majCampagne(
  db: Db,
  u: Utilisateur,
  id: string,
  saisie: { mois: number; statut: string; diffuseeLe?: string; commentaire?: string },
  maintenant = new Date(),
): Promise<Resultat> {
  const c = await campagneModifiable(db, u, id);
  if (!c) return { ok: false, erreur: "introuvable" };
  const m = mois.safeParse(saisie.mois);
  const s = z.enum(STATUTS_SENSIB).safeParse(saisie.statut);
  const commentaire = (saisie.commentaire ?? "").trim();
  if (!m.success || !s.success || commentaire.length > 500) return { ok: false, erreur: "saisieInvalide" };
  if (!sansCoordonnees(commentaire)) return { ok: false, erreur: "risqueCoordonnees" };
  let diffuseeLe: string | null = null;
  if (s.data === "diffusee" || s.data === "realisee") {
    const aujourdhui = maintenant.toISOString().slice(0, 10);
    const d = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).safeParse(saisie.diffuseeLe || aujourdhui);
    if (!d.success || d.data > aujourdhui) return { ok: false, erreur: "adoptionDates" };
    diffuseeLe = d.data;
  }
  await db
    .update(awarenessCampaigns)
    .set({ month: m.data, status: s.data, diffusedOn: diffuseeLe, comment: commentaire || null, updatedBy: u.id, updatedAt: maintenant })
    .where(eq(awarenessCampaigns.id, id));
  await journaliser(db, {
    actorUserId: u.id,
    action: "awareness_campaign_updated",
    targetType: "organization",
    targetId: c.organizationId,
    details: { avant: c.status, apres: s.data, mois: m.data },
  });
  return { ok: true, valeur: undefined };
}

// --- Kit prêt à diffuser ----------------------------------------------------------------------

// Personnes de soutien : celles de la campagne de diagnostic la plus récente qui en a ; numéros d'aide du pays
export async function ressourcesAide(db: Db, organizationId: string, langue: string) {
  const org = await paysDe(db, organizationId);
  const liste = await db
    .select({ supportContacts: campaigns.supportContacts, imaSupport: campaigns.imaSupport })
    .from(campaigns)
    .where(eq(campaigns.organizationId, organizationId))
    .orderBy(desc(campaigns.createdAt));
  const soutien = liste.map((c) => lireSoutien(c)).find((s) => s.contacts.length) ?? { contacts: [], ima: null };
  const tp = traducteur(langue, "Pays");
  const ts = traducteur(langue, "Soutien");
  return {
    contacts: soutien.contacts.map((c) => ({
      role: c.role === "autre" ? (c.fonction ?? "") : ts(`roles.${c.role}`),
      nom: c.nom ?? null,
      telephone: c.telephone ?? null,
      email: c.email ?? null,
    })),
    aides: org ? aidesPour(org.country, langue).map((a) => ({ numero: a.numero, libelle: tp(`${org.country}.aides.${a.cle}`) })) : [],
  };
}
export type RessourcesAide = Awaited<ReturnType<typeof ressourcesAide>>;

// Kit d'une campagne dans la langue demandée (sinon la langue de l'entreprise, sinon le français)
export async function kitDeCampagne(db: Db, u: Utilisateur, campagneId: string, langueDemandee?: string) {
  const [c] = await db.select().from(awarenessCampaigns).where(eq(awarenessCampaigns.id, campagneId));
  if (!c || !peutLireCalendrier(u, c.organizationId)) return null;
  const theme = await themeParId(db, c.themeId);
  if (!theme || theme.status !== "validated") return null;
  const org = await paysDe(db, c.organizationId);
  const disponibles = LANGUES_THEME.filter((lg) => theme.kitsLus[lg]);
  const langue: LangueTheme =
    [langueDemandee, org?.locale, "fr"].find((lg): lg is LangueTheme => !!lg && disponibles.includes(lg as LangueTheme)) ?? disponibles[0];
  const kit = theme.kitsLus[langue] as Kit;
  return { campagne: c, theme, langue, disponibles, kit, aide: await ressourcesAide(db, c.organizationId, langue) };
}

// --- Rappel mensuel ---------------------------------------------------------------------------

const base = () => process.env.APP_URL ?? "http://localhost:3000";

// Appelé chaque nuit : au plus un rappel par entreprise et par mois, aux conseillers en prévention,
// s'il reste des campagnes « prévues » ce mois-ci ou des propositions à examiner (module B3)
export async function envoyerRappelsSensibilisation(db: Db, maintenant = new Date(), envoi: (e: Email) => Promise<void> = envoyerEmail) {
  const a = maintenant.getUTCFullYear();
  const m = maintenant.getUTCMonth() + 1;
  const cle = `${a}-${String(m).padStart(2, "0")}`;
  const prevues = await db
    .select({ organizationId: awarenessCampaigns.organizationId, locale: organizations.locale })
    .from(awarenessCampaigns)
    .innerJoin(organizations, eq(awarenessCampaigns.organizationId, organizations.id))
    .where(and(eq(awarenessCampaigns.year, a), eq(awarenessCampaigns.month, m), eq(awarenessCampaigns.status, "prevue")));
  const parOrg = new Map<string, { locale: string; nombre: number; propositions: number }>();
  const ligne = (id: string, locale: string) => parOrg.get(id) ?? { locale, nombre: 0, propositions: 0 };
  for (const p of prevues) parOrg.set(p.organizationId, { ...ligne(p.organizationId, p.locale), nombre: ligne(p.organizationId, p.locale).nombre + 1 });
  const enAttente = await db
    .select({ organizationId: awarenessSuggestions.organizationId, locale: organizations.locale })
    .from(awarenessSuggestions)
    .innerJoin(organizations, eq(awarenessSuggestions.organizationId, organizations.id))
    .where(eq(awarenessSuggestions.status, "en_attente"));
  for (const p of enAttente)
    parOrg.set(p.organizationId, { ...ligne(p.organizationId, p.locale), propositions: ligne(p.organizationId, p.locale).propositions + 1 });
  const deja = new Set(
    (await db.select({ targetId: auditLog.targetId, details: auditLog.details }).from(auditLog).where(eq(auditLog.action, "awareness_reminder_sent")))
      .filter((l) => (l.details as { mois?: string } | null)?.mois === cle)
      .map((l) => l.targetId),
  );
  let envoyes = 0;
  for (const [orgId, { locale, nombre, propositions }] of parOrg) {
    if (deja.has(orgId)) continue;
    const conseillers = await db
      .select({ email: users.email, name: users.name })
      .from(users)
      .where(and(eq(users.organizationId, orgId), eq(users.role, "referent"), eq(users.preventionAdvisor, true), isNull(users.disabledAt)));
    const t = traducteur(locale, "Notifications");
    for (const d of conseillers) {
      try {
        await envoi(
          emailIMA(locale, d, {
            sujet: t("rappelSensibSujet"),
            salutation: t("salutation", { name: d.name }),
            paragraphes: [
              ...(nombre ? [t("rappelSensibTexte", { nombre })] : []),
              ...(propositions ? [t("rappelSensibPropositions", { nombre: propositions })] : []),
            ],
            bouton: t("ouvrirEspace"),
            lien: `${base()}/${locale}/espace/sensibilisation`,
            mention: t("sansContenu"),
          }),
        );
        envoyes++;
      } catch (e) {
        console.error("Rappel non envoyé :", e instanceof Error ? e.message : e);
      }
    }
    await journaliser(db, { action: "awareness_reminder_sent", targetType: "organization", targetId: orgId, details: { mois: cle, destinataires: conseillers.length } });
  }
  return envoyes;
}
