// Ateliers avec QR code (module C, décisions de Michelle du 27/10/2026, avis de l'agent juridique du 27/10/2026) :
// - le conseiller en prévention (ou IMA) crée l'atelier ; il peut demander l'appui ou un animateur IMA (facultatif) ;
// - un lien et un QR code uniques : avant l'atelier, inscription (nom, e-mail professionnel, liste d'attente),
//   puis, pendant 7 jours à partir du début, avis anonyme (questions à choix et texte libre sans modération) ;
// - l'avis n'est jamais relié à l'inscription (deux tables sans lien, date du jour seulement) ;
// - résultats visibles à partir de 5 avis, pour l'atelier entier ;
// - inscriptions supprimées 30 jours après l'atelier (seuls les nombres restent), avis supprimés après 24 mois.
// L'entreprise est responsable du traitement des inscriptions ; IMA est son sous-traitant.
import { createHash, randomBytes } from "node:crypto";
import { and, asc, count, desc, eq, gt, gte, inArray, isNotNull, isNull, lt, lte } from "drizzle-orm";
import { z } from "zod";
import { journaliser } from "../audit";
import { moisAvant } from "../confidentialite/conservation";
import { awarenessCampaigns, organizations, typeAtelier, users, workshopFeedback, workshopRegistrations, workshops } from "../db/schema";
import type { Db } from "../db/types";
import { envoyerEmail, type Email } from "../email/brevo";
import { emailIMA } from "../email/modele";
import type { Resultat } from "../rapport/rapports";
import { peutModifierRegistre } from "../risques/registre";
import { peutLireCalendrier } from "../sensibilisation/calendrier";
import { actionsPourLien } from "../sensibilisation/declencheurs";
import { traducteur } from "../traduction";

type Utilisateur = typeof users.$inferSelect;
type Atelier = typeof workshops.$inferSelect;
type Envoi = (e: Email) => Promise<void>;
type Entreprise = { name: string; country: string };

export const TYPES_ATELIER = typeAtelier.enumValues;
export const QUESTIONS_AVIS = ["utile", "clair", "appliquer", "animation", "recommander"] as const;
export const SEUIL_AVIS = 5; // résultats affichés à partir de 5 avis (décision du 27/10/2026)
export const JOURS_AVIS = 7; // avis possible pendant 7 jours à partir du début de l'atelier
const MARGE_AVIS = 5; // quelques avis de plus que de places (participants venus sans inscription)

// Fuseau horaire de l'entreprise, pour la date et l'heure de l'atelier
export const FUSEAUX: Record<string, string> = { BE: "Europe/Brussels", FR: "Europe/Paris", PT: "Europe/Lisbon", BR: "America/Sao_Paulo" };

// Créer et gérer un atelier : IMA et le conseiller en prévention (même règle que le registre, contrôlée aussi en base)
export const peutGererAteliers = peutModifierRegistre;

const sansCoordonnees = (s: string) => !/[^\s@]+@[^\s@]+\.[^\s@]+/.test(s) && !/(\+?\d[\s.-]?){8,}/.test(s);
const base = () => process.env.APP_URL ?? "http://localhost:3000";
export const lienPublic = (code: string, langue: string) => `${base()}/${langue}/atelier/${code}`;
// Cookie technique de la page publique : un même appareil ne donne qu'un avis (il ne contient que l'identifiant de l'atelier)
export const cookieAvis = (atelierId: string) => `inneros-avis-${atelierId}`;
const empreinte = (s: string) => createHash("sha256").update(s).digest("hex");
const nouveauJeton = () => randomBytes(24).toString("base64url");

// --- Dates : saisie « date + heure » dans le fuseau de l'entreprise ----------------------------------

function parties(instant: Date, fuseau: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: fuseau,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(instant)
      .map((x) => [x.type, x.value]),
  );
  return p as Record<"year" | "month" | "day" | "hour" | "minute" | "second", string>;
}

const decalage = (instant: Date, fuseau: string) => {
  const p = parties(instant, fuseau);
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - instant.getTime();
};

// Instant correspondant à « date heure » dans le fuseau (deux passes pour les changements d'heure)
export function instantLocal(date: string, heure: string, fuseau: string) {
  const naif = Date.parse(`${date}T${heure}:00Z`);
  const essai = naif - decalage(new Date(naif), fuseau);
  return new Date(naif - decalage(new Date(essai), fuseau));
}

export function dateHeureLocales(instant: Date, fuseau: string) {
  const p = parties(instant, fuseau);
  return { date: `${p.year}-${p.month}-${p.day}`, heure: `${p.hour}:${p.minute}` };
}

export const formaterQuand = (instant: Date, langue: string, fuseau: string) =>
  new Intl.DateTimeFormat(langue, { dateStyle: "full", timeStyle: "short", timeZone: fuseau }).format(instant);

// Phase de la page publique : inscription avant le début, avis pendant 7 jours, puis terminé
export function phase(a: Pick<Atelier, "startsAt" | "cancelledAt">, maintenant = new Date()) {
  if (a.cancelledAt) return "annule" as const;
  if (maintenant < a.startsAt) return "inscription" as const;
  if (maintenant.getTime() < a.startsAt.getTime() + JOURS_AVIS * 86_400_000) return "avis" as const;
  return "termine" as const;
}

// --- Création et modification -------------------------------------------------------------------

const optionnel = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((s) => s || null);

export const schemaAtelier = z.object({
  type: z.enum(TYPES_ATELIER),
  titre: z.string().trim().min(3).max(120),
  description: optionnel(1000),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  heure: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  duree: z.coerce.number().int().min(5).max(600),
  lieu: z.string().trim().min(2).max(300),
  places: z.coerce.number().int().min(1).max(500),
  animateur: optionnel(120),
  campagne: z
    .union([z.string().uuid(), z.literal("")])
    .optional()
    .transform((s) => s || null),
  action: optionnel(50),
  appui: z.boolean(),
  demandeAppui: optionnel(500),
});

async function entreprise(db: Db, organizationId: string): Promise<Entreprise | null> {
  const [o] = await db.select({ name: organizations.name, country: organizations.country }).from(organizations).where(eq(organizations.id, organizationId));
  return o ?? null;
}

async function preparer(db: Db, u: Utilisateur, organizationId: string, saisie: unknown, maintenant: Date) {
  const a = schemaAtelier.safeParse(saisie);
  if (!a.success) return { ok: false as const, erreur: "saisieInvalide" };
  const s = a.data;
  if (![s.titre, s.description ?? "", s.animateur ?? "", s.demandeAppui ?? ""].every(sansCoordonnees)) return { ok: false as const, erreur: "risqueCoordonnees" };
  const org = await entreprise(db, organizationId);
  if (!org) return { ok: false as const, erreur: "introuvable" };
  const startsAt = instantLocal(s.date, s.heure, FUSEAUX[org.country]);
  if (startsAt <= maintenant) return { ok: false as const, erreur: "atelierDatePassee" };
  if (s.campagne) {
    const [c] = await db
      .select({ id: awarenessCampaigns.id })
      .from(awarenessCampaigns)
      .where(and(eq(awarenessCampaigns.id, s.campagne), eq(awarenessCampaigns.organizationId, organizationId)));
    if (!c) return { ok: false as const, erreur: "introuvable" };
  }
  let planId: string | null = null;
  if (s.action) {
    const lien = await actionsPourLien(db, u, organizationId);
    if (!lien || !lien.actions.some((x) => x.id === s.action)) return { ok: false as const, erreur: "introuvable" };
    planId = lien.planId;
  }
  return {
    ok: true as const,
    valeurs: {
      type: s.type,
      title: s.titre,
      description: s.description,
      startsAt,
      durationMinutes: s.duree,
      place: s.lieu,
      capacity: s.places,
      facilitator: s.animateur,
      awarenessCampaignId: s.campagne,
      planId,
      planActionId: s.action,
    },
    appui: s.appui,
    demandeAppui: s.demandeAppui,
  };
}

export async function creerAtelier(
  db: Db,
  u: Utilisateur,
  organizationId: string,
  saisie: unknown,
  maintenant = new Date(),
  envoi: Envoi = envoyerEmail,
): Promise<Resultat<{ id: string }>> {
  if (!peutGererAteliers(u, organizationId)) return { ok: false, erreur: "introuvable" };
  const p = await preparer(db, u, organizationId, saisie, maintenant);
  if (!p.ok) return p;
  const [a] = await db
    .insert(workshops)
    .values({
      organizationId,
      ...p.valeurs,
      publicCode: randomBytes(16).toString("base64url"),
      supportStatus: p.appui ? "demande" : null,
      supportRequest: p.appui ? p.demandeAppui : null,
      createdBy: u.id,
      updatedBy: u.id,
    })
    .returning();
  await journaliser(db, { actorUserId: u.id, action: "workshop_created", targetType: "organization", targetId: organizationId, details: { atelier: a.id, type: a.type, appui: p.appui } });
  if (p.appui) await prevenirIma(db, a, envoi);
  return { ok: true, valeur: { id: a.id } };
}

async function atelierGerable(db: Db, u: Utilisateur, id: string) {
  if (!z.string().uuid().safeParse(id).success) return null;
  const [a] = await db.select().from(workshops).where(eq(workshops.id, id));
  if (!a || !peutGererAteliers(u, a.organizationId)) return null;
  return a;
}

async function compter(db: Db, workshopId: string, statut: "inscrit" | "attente") {
  const [r] = await db
    .select({ n: count() })
    .from(workshopRegistrations)
    .where(and(eq(workshopRegistrations.workshopId, workshopId), eq(workshopRegistrations.status, statut)));
  return r.n;
}

export async function modifierAtelier(db: Db, u: Utilisateur, id: string, saisie: unknown, maintenant = new Date(), envoi: Envoi = envoyerEmail): Promise<Resultat> {
  const a = await atelierGerable(db, u, id);
  if (!a) return { ok: false, erreur: "introuvable" };
  if (phase(a, maintenant) !== "inscription") return { ok: false, erreur: "atelierNonModifiable" };
  const p = await preparer(db, u, a.organizationId, saisie, maintenant);
  if (!p.ok) return p;
  if (p.valeurs.capacity < (await compter(db, id, "inscrit"))) return { ok: false, erreur: "atelierPlacesInsuffisantes" };
  // Demande d'appui : ajoutée, retirée tant qu'IMA n'a pas répondu, ou précisée
  const appui =
    p.appui && !a.supportStatus
      ? { supportStatus: "demande" as const, supportRequest: p.demandeAppui }
      : !p.appui && a.supportStatus === "demande"
        ? { supportStatus: null, supportRequest: null }
        : p.appui && a.supportStatus === "demande"
          ? { supportRequest: p.demandeAppui }
          : {};
  const change = p.valeurs.startsAt.getTime() !== a.startsAt.getTime() || p.valeurs.place !== a.place;
  await db
    .update(workshops)
    .set({ ...p.valeurs, ...appui, ...(change ? { reminderSentAt: null } : {}), updatedBy: u.id, updatedAt: maintenant })
    .where(eq(workshops.id, id));
  await journaliser(db, { actorUserId: u.id, action: "workshop_updated", targetType: "organization", targetId: a.organizationId, details: { atelier: id, dateOuLieu: change } });
  const apres = { ...a, ...p.valeurs };
  if (change) await prevenirTous(db, apres, "modifie", envoi);
  await promouvoir(db, apres, maintenant, envoi); // places ajoutées : la liste d'attente avance
  if ("supportStatus" in appui && appui.supportStatus === "demande") await prevenirIma(db, apres, envoi);
  return { ok: true, valeur: undefined };
}

// Les inscriptions sont effacées ; seuls les nombres restent (fin de la conservation ou atelier annulé)
async function effacerInscriptions(db: Db, a: Atelier, maintenant: Date) {
  const lignes = await db.select({ status: workshopRegistrations.status, attended: workshopRegistrations.attended }).from(workshopRegistrations).where(eq(workshopRegistrations.workshopId, a.id));
  const nombres = {
    registeredCount: lignes.filter((l) => l.status === "inscrit").length,
    waitlistCount: lignes.filter((l) => l.status === "attente").length,
    attendedCount: lignes.filter((l) => l.attended).length,
  };
  await db.transaction(async (tx) => {
    await tx.delete(workshopRegistrations).where(eq(workshopRegistrations.workshopId, a.id));
    await tx.update(workshops).set({ ...nombres, registrationsPurgedAt: maintenant }).where(eq(workshops.id, a.id));
  });
  return nombres;
}

export async function annulerAtelier(db: Db, u: Utilisateur, id: string, maintenant = new Date(), envoi: Envoi = envoyerEmail): Promise<Resultat> {
  const a = await atelierGerable(db, u, id);
  if (!a) return { ok: false, erreur: "introuvable" };
  if (phase(a, maintenant) !== "inscription") return { ok: false, erreur: "atelierNonModifiable" };
  await db.update(workshops).set({ cancelledAt: maintenant, updatedBy: u.id, updatedAt: maintenant }).where(eq(workshops.id, id));
  await prevenirTous(db, a, "annule", envoi);
  const nombres = await effacerInscriptions(db, a, maintenant);
  await journaliser(db, { actorUserId: u.id, action: "workshop_cancelled", targetType: "organization", targetId: a.organizationId, details: { atelier: id, inscrits: nombres.registeredCount } });
  return { ok: true, valeur: undefined };
}

// --- Appui d'IMA (facultatif) -------------------------------------------------------------------

async function prevenirIma(db: Db, a: Atelier, envoi: Envoi) {
  const org = await entreprise(db, a.organizationId);
  const admins = await db.select({ email: users.email, name: users.name }).from(users).where(and(eq(users.role, "admin"), isNull(users.disabledAt)));
  const t = traducteur("fr", "AteliersEmails");
  for (const d of admins) {
    try {
      await envoi(
        emailIMA("fr", d, {
          sujet: t("appuiSujet"),
          salutation: t("salutation", { name: d.name }),
          paragraphes: [t("appuiTexte", { entreprise: org?.name ?? "", quand: formaterQuand(a.startsAt, "fr", FUSEAUX[org?.country ?? "BE"]) })],
          bouton: t("ouvrirEspace"),
          lien: `${base()}/fr/admin/ateliers`,
        }),
      );
    } catch (e) {
      console.error("Demande d'appui non envoyée :", e instanceof Error ? e.message : e);
    }
  }
}

export async function repondreAppui(
  db: Db,
  admin: Utilisateur,
  id: string,
  saisie: { accepte: boolean; reponse: string; animateurId?: string },
  envoi: Envoi = envoyerEmail,
): Promise<Resultat> {
  if (admin.role !== "admin" || admin.disabledAt || !z.string().uuid().safeParse(id).success) return { ok: false, erreur: "introuvable" };
  const [a] = await db.select().from(workshops).where(eq(workshops.id, id));
  if (!a || a.supportStatus !== "demande") return { ok: false, erreur: "introuvable" };
  const reponse = saisie.reponse.trim();
  if (reponse.length > 500) return { ok: false, erreur: "saisieInvalide" };
  if (!sansCoordonnees(reponse)) return { ok: false, erreur: "risqueCoordonnees" };
  if (!saisie.accepte && reponse.length < 3) return { ok: false, erreur: "motifRefusRequis" };
  let animateur: string | null = null;
  if (saisie.accepte) {
    const id = saisie.animateurId || admin.id;
    const [x] = z.string().uuid().safeParse(id).success
      ? await db.select().from(users).where(and(eq(users.id, id), eq(users.role, "admin"), isNull(users.disabledAt)))
      : [];
    if (!x) return { ok: false, erreur: "introuvable" };
    animateur = x.id;
  }
  await db
    .update(workshops)
    .set({ supportStatus: saisie.accepte ? "accepte" : "refuse", supportReply: reponse || null, imaFacilitatorId: animateur })
    .where(eq(workshops.id, id));
  await journaliser(db, { actorUserId: admin.id, action: saisie.accepte ? "workshop_support_accepted" : "workshop_support_refused", targetType: "organization", targetId: a.organizationId, details: { atelier: id } });
  // Réponse aux conseillers en prévention de l'entreprise
  const org = await entreprise(db, a.organizationId);
  const conseillers = await db
    .select({ email: users.email, name: users.name })
    .from(users)
    .where(and(eq(users.organizationId, a.organizationId), eq(users.role, "referent"), eq(users.preventionAdvisor, true), isNull(users.disabledAt)));
  const [o] = await db.select({ locale: organizations.locale }).from(organizations).where(eq(organizations.id, a.organizationId));
  const langue = o?.locale ?? "fr";
  const t = traducteur(langue, "AteliersEmails");
  for (const d of conseillers) {
    try {
      await envoi(
        emailIMA(langue, d, {
          sujet: t(saisie.accepte ? "appuiAccepteSujet" : "appuiRefuseSujet", { titre: a.title }),
          salutation: t("salutation", { name: d.name }),
          paragraphes: [
            t(saisie.accepte ? "appuiAccepteTexte" : "appuiRefuseTexte", { titre: a.title, quand: formaterQuand(a.startsAt, langue, FUSEAUX[org?.country ?? "BE"]) }),
            ...(reponse ? [reponse] : []),
          ],
          bouton: t("ouvrirEspace"),
          lien: `${base()}/${langue}/espace/ateliers/${a.id}`,
        }),
      );
    } catch (e) {
      console.error("Réponse d'appui non envoyée :", e instanceof Error ? e.message : e);
    }
  }
  return { ok: true, valeur: undefined };
}

// --- E-mails aux participants -------------------------------------------------------------------

type Genre = "inscrit" | "attente" | "promu" | "rappel" | "modifie" | "annule";

function emailParticipant(a: Atelier, org: Entreprise, r: { name: string; email: string; locale: string }, genre: Genre, jeton?: string) {
  const t = traducteur(r.locale, "AteliersEmails");
  return emailIMA(r.locale, r, {
    sujet: t(`${genre}Sujet`, { titre: a.title }),
    salutation: t("salutation", { name: r.name }),
    paragraphes: [
      t(`${genre}Texte`, { titre: a.title, entreprise: org.name }),
      t("quand", { quand: formaterQuand(a.startsAt, r.locale, FUSEAUX[org.country]) }),
      t("lieu", { lieu: a.place }),
    ],
    bouton: t("voir"),
    lien: lienPublic(a.publicCode, r.locale),
    ...(jeton ? { secondaire: { libelle: t("desinscrire"), lien: `${lienPublic(a.publicCode, r.locale)}/desinscription#${jeton}` } } : {}),
    mention: t("mention", { jours: dureesAteliers().inscriptionsJours }),
  });
}

// Nouveau lien de désinscription : seule l'empreinte est gardée, le lien part dans l'e-mail
async function lienRenouvele(db: Db, inscriptionId: string) {
  const jeton = nouveauJeton();
  await db.update(workshopRegistrations).set({ cancelTokenHash: empreinte(jeton) }).where(eq(workshopRegistrations.id, inscriptionId));
  return jeton;
}

async function envoyerSansBloquer(envoi: Envoi, e: Email) {
  try {
    await envoi(e);
    return true;
  } catch (err) {
    console.error("E-mail d'atelier non envoyé :", err instanceof Error ? err.message : err);
    return false;
  }
}

async function prevenirTous(db: Db, a: Atelier, genre: "modifie" | "annule", envoi: Envoi) {
  const org = await entreprise(db, a.organizationId);
  if (!org) return;
  const liste = await db.select().from(workshopRegistrations).where(eq(workshopRegistrations.workshopId, a.id));
  for (const r of liste) await envoyerSansBloquer(envoi, emailParticipant(a, org, r, genre, genre === "annule" ? undefined : await lienRenouvele(db, r.id)));
}

// Places libres : les premières personnes de la liste d'attente passent inscrites et sont prévenues
async function promouvoir(db: Db, a: Atelier, maintenant: Date, envoi: Envoi) {
  if (phase(a, maintenant) !== "inscription") return;
  const libres = a.capacity - (await compter(db, a.id, "inscrit"));
  if (libres <= 0) return;
  const suivants = await db
    .select()
    .from(workshopRegistrations)
    .where(and(eq(workshopRegistrations.workshopId, a.id), eq(workshopRegistrations.status, "attente")))
    .orderBy(asc(workshopRegistrations.createdAt))
    .limit(libres);
  if (!suivants.length) return;
  const org = await entreprise(db, a.organizationId);
  for (const r of suivants) {
    const jeton = nouveauJeton();
    await db.update(workshopRegistrations).set({ status: "inscrit", cancelTokenHash: empreinte(jeton) }).where(eq(workshopRegistrations.id, r.id));
    if (org) await envoyerSansBloquer(envoi, emailParticipant(a, org, r, "promu", jeton));
  }
  await journaliser(db, { action: "workshop_waitlist_promoted", targetType: "workshop", targetId: a.id, details: { nombre: suivants.length } });
}

// --- Page publique : inscription, désinscription, avis ----------------------------------------------

const CODE = /^[A-Za-z0-9_-]{22}$/;

async function atelierParCode(db: Db, code: string) {
  if (!CODE.test(code)) return null;
  const [l] = await db
    .select({ atelier: workshops, org: { name: organizations.name, country: organizations.country } })
    .from(workshops)
    .innerJoin(organizations, eq(workshops.organizationId, organizations.id))
    .where(eq(workshops.publicCode, code));
  return l ?? null;
}

// Ce que voit le public : jamais la liste des inscrits ni les avis
export async function atelierPublic(db: Db, code: string, maintenant = new Date()) {
  const l = await atelierParCode(db, code);
  if (!l) return null;
  const { atelier: a, org } = l;
  const etat = phase(a, maintenant);
  const inscrits = etat === "inscription" ? await compter(db, a.id, "inscrit") : 0;
  const attente = etat === "inscription" ? await compter(db, a.id, "attente") : 0;
  return {
    id: a.id,
    type: a.type,
    titre: a.title,
    description: a.description,
    debut: a.startsAt,
    duree: a.durationMinutes,
    lieu: a.place,
    animateur: a.facilitator,
    entreprise: org.name,
    fuseau: FUSEAUX[org.country],
    phase: etat,
    placesRestantes: Math.max(0, a.capacity - inscrits),
    complet: inscrits >= a.capacity && attente >= a.capacity,
  };
}

export const schemaInscription = z.object({
  nom: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  langue: z.enum(["fr", "nl", "en", "pt-BR"]),
});

export async function inscrire(db: Db, code: string, saisie: unknown, maintenant = new Date(), envoi: Envoi = envoyerEmail): Promise<Resultat<{ statut: "inscrit" | "attente" }>> {
  const s = schemaInscription.safeParse(saisie);
  if (!s.success) return { ok: false, erreur: "saisieInvalide" };
  const l = await atelierParCode(db, code);
  if (!l) return { ok: false, erreur: "introuvable" };
  const { atelier: a, org } = l;
  if (phase(a, maintenant) !== "inscription") return { ok: false, erreur: "atelierFerme" };
  const jeton = nouveauJeton();
  const r = await db.transaction(async (tx) => {
    // Verrou sur l'atelier : deux inscriptions simultanées ne dépassent pas le nombre de places
    await tx.select({ id: workshops.id }).from(workshops).where(eq(workshops.id, a.id)).for("update");
    const [deja] = await tx
      .select()
      .from(workshopRegistrations)
      .where(and(eq(workshopRegistrations.workshopId, a.id), eq(workshopRegistrations.email, s.data.email)));
    if (deja) {
      // Déjà inscrit : nouvel e-mail de confirmation, sans créer de doublon
      await tx.update(workshopRegistrations).set({ name: s.data.nom, locale: s.data.langue, cancelTokenHash: empreinte(jeton) }).where(eq(workshopRegistrations.id, deja.id));
      return { statut: deja.status, nouveau: false };
    }
    let statut: "inscrit" | "attente" = "inscrit";
    if ((await compter(tx, a.id, "inscrit")) >= a.capacity) {
      if ((await compter(tx, a.id, "attente")) >= a.capacity) return null; // liste d'attente pleine
      statut = "attente";
    }
    await tx.insert(workshopRegistrations).values({ workshopId: a.id, name: s.data.nom, email: s.data.email, locale: s.data.langue, status: statut, cancelTokenHash: empreinte(jeton) });
    return { statut, nouveau: true };
  });
  if (!r) return { ok: false, erreur: "atelierComplet" };
  await envoyerSansBloquer(envoi, emailParticipant(a, org, { name: s.data.nom, email: s.data.email, locale: s.data.langue }, r.statut, jeton));
  if (r.nouveau) await journaliser(db, { action: "workshop_registration", targetType: "workshop", targetId: a.id, details: { statut: r.statut } });
  return { ok: true, valeur: { statut: r.statut } };
}

export async function desinscrire(db: Db, code: string, jeton: string, maintenant = new Date(), envoi: Envoi = envoyerEmail): Promise<Resultat> {
  const l = await atelierParCode(db, code);
  if (!l || !/^[A-Za-z0-9_-]{32}$/.test(jeton)) return { ok: false, erreur: "introuvable" };
  const [r] = await db
    .select()
    .from(workshopRegistrations)
    .where(and(eq(workshopRegistrations.workshopId, l.atelier.id), eq(workshopRegistrations.cancelTokenHash, empreinte(jeton))));
  if (!r) return { ok: false, erreur: "atelierLienInvalide" };
  if (phase(l.atelier, maintenant) !== "inscription") return { ok: false, erreur: "atelierFerme" };
  await db.delete(workshopRegistrations).where(eq(workshopRegistrations.id, r.id));
  await journaliser(db, { action: "workshop_unregistration", targetType: "workshop", targetId: l.atelier.id, details: { statut: r.status } });
  await promouvoir(db, l.atelier, maintenant, envoi);
  return { ok: true, valeur: undefined };
}

const note = z.number().int().min(1).max(5);
export const schemaAvis = z.object({
  reponses: z.object({ utile: note, clair: note, appliquer: note, animation: note, recommander: note }),
  commentaire: z.string().trim().max(1000).optional(),
});

// Avis anonyme : aucune donnée de connexion, la date du jour seulement, aucune entrée au journal
export async function donnerAvis(db: Db, code: string, saisie: unknown, maintenant = new Date()): Promise<Resultat<{ atelierId: string }>> {
  const s = schemaAvis.safeParse(saisie);
  if (!s.success) return { ok: false, erreur: "saisieInvalide" };
  const l = await atelierParCode(db, code);
  if (!l) return { ok: false, erreur: "introuvable" };
  const a = l.atelier;
  if (phase(a, maintenant) !== "avis") return { ok: false, erreur: "atelierAvisFerme" };
  const commentaire = s.data.commentaire || null;
  if (commentaire && !sansCoordonnees(commentaire)) return { ok: false, erreur: "risqueCoordonnees" };
  const [n] = await db.select({ n: count() }).from(workshopFeedback).where(eq(workshopFeedback.workshopId, a.id));
  if (n.n >= a.capacity + MARGE_AVIS) return { ok: false, erreur: "atelierAvisComplet" };
  await db.insert(workshopFeedback).values({ workshopId: a.id, submittedOn: maintenant.toISOString().slice(0, 10), answers: s.data.reponses, comment: commentaire });
  return { ok: true, valeur: { atelierId: a.id } };
}

// --- Espace du conseiller et d'IMA --------------------------------------------------------------------

export async function lireAteliers(db: Db, u: Utilisateur, organizationId: string) {
  if (!peutGererAteliers(u, organizationId)) return null;
  const liste = await db.select().from(workshops).where(eq(workshops.organizationId, organizationId)).orderBy(desc(workshops.startsAt));
  const ids = liste.map((a) => a.id);
  const inscriptions = ids.length
    ? await db
        .select({ id: workshopRegistrations.workshopId, statut: workshopRegistrations.status, n: count() })
        .from(workshopRegistrations)
        .where(inArray(workshopRegistrations.workshopId, ids))
        .groupBy(workshopRegistrations.workshopId, workshopRegistrations.status)
    : [];
  const avis = ids.length
    ? await db.select({ id: workshopFeedback.workshopId, n: count() }).from(workshopFeedback).where(inArray(workshopFeedback.workshopId, ids)).groupBy(workshopFeedback.workshopId)
    : [];
  const nombre = (id: string, statut: string) => inscriptions.find((x) => x.id === id && x.statut === statut)?.n ?? 0;
  return liste.map((a) => ({
    ...a,
    inscrits: a.registrationsPurgedAt ? (a.registeredCount ?? 0) : nombre(a.id, "inscrit"),
    attente: a.registrationsPurgedAt ? (a.waitlistCount ?? 0) : nombre(a.id, "attente"),
    avis: avis.find((x) => x.id === a.id)?.n ?? 0,
  }));
}

export async function lireAtelier(db: Db, u: Utilisateur, id: string) {
  const a = await atelierGerable(db, u, id);
  if (!a) return null;
  const org = (await entreprise(db, a.organizationId))!;
  const inscriptions = await db
    .select()
    .from(workshopRegistrations)
    .where(eq(workshopRegistrations.workshopId, id))
    .orderBy(desc(workshopRegistrations.status), asc(workshopRegistrations.createdAt)); // inscrits, puis liste d'attente
  const [animateurIma] = a.imaFacilitatorId ? await db.select({ name: users.name }).from(users).where(eq(users.id, a.imaFacilitatorId)) : [];
  return { atelier: a, org, fuseau: FUSEAUX[org.country], inscriptions, animateurIma: animateurIma?.name ?? null, resultats: await resultatsAvis(db, id) };
}

// Résultats de l'atelier entier, seulement à partir de 5 avis ; commentaires dans l'ordre alphabétique
// (l'ordre d'arrivée n'est pas conservé)
export async function resultatsAvis(db: Db, workshopId: string) {
  const lignes = await db.select({ answers: workshopFeedback.answers, comment: workshopFeedback.comment }).from(workshopFeedback).where(eq(workshopFeedback.workshopId, workshopId));
  if (lignes.length < SEUIL_AVIS) return { nombre: lignes.length, visible: false as const };
  const questions = QUESTIONS_AVIS.map((q) => {
    const notes = lignes.map((l) => (l.answers as Record<string, number>)[q]).filter((n) => Number.isInteger(n) && n >= 1 && n <= 5);
    const repartition = [1, 2, 3, 4, 5].map((v) => notes.filter((n) => n === v).length);
    const moyenne = notes.length ? Math.round((notes.reduce((s, n) => s + n, 0) / notes.length) * 10) / 10 : null;
    return { question: q, moyenne, repartition };
  });
  const commentaires = lignes
    .map((l) => l.comment)
    .filter((c): c is string => !!c)
    .sort((x, y) => x.localeCompare(y));
  return { nombre: lignes.length, visible: true as const, questions, commentaires };
}
export type ResultatsAvis = Awaited<ReturnType<typeof resultatsAvis>>;

export async function retirerInscription(db: Db, u: Utilisateur, inscriptionId: string, maintenant = new Date(), envoi: Envoi = envoyerEmail): Promise<Resultat> {
  if (!z.string().uuid().safeParse(inscriptionId).success) return { ok: false, erreur: "introuvable" };
  const [r] = await db.select().from(workshopRegistrations).where(eq(workshopRegistrations.id, inscriptionId));
  const a = r && (await atelierGerable(db, u, r.workshopId));
  if (!a) return { ok: false, erreur: "introuvable" };
  await db.delete(workshopRegistrations).where(eq(workshopRegistrations.id, r.id));
  await journaliser(db, { actorUserId: u.id, action: "workshop_registration_removed", targetType: "workshop", targetId: a.id, details: { statut: r.status } });
  await promouvoir(db, a, maintenant, envoi);
  return { ok: true, valeur: undefined };
}

// Présences cochées par le conseiller (utile comme preuve, par exemple pour une formation des managers)
export async function marquerPresences(db: Db, u: Utilisateur, id: string, presents: string[]): Promise<Resultat<{ presents: number }>> {
  const a = await atelierGerable(db, u, id);
  if (!a || a.registrationsPurgedAt) return { ok: false, erreur: "introuvable" };
  const valides = presents.filter((p) => z.string().uuid().safeParse(p).success);
  await db.transaction(async (tx) => {
    await tx.update(workshopRegistrations).set({ attended: false }).where(eq(workshopRegistrations.workshopId, id));
    if (valides.length)
      await tx
        .update(workshopRegistrations)
        .set({ attended: true })
        .where(and(eq(workshopRegistrations.workshopId, id), eq(workshopRegistrations.status, "inscrit"), inArray(workshopRegistrations.id, valides)));
  });
  const [n] = await db
    .select({ n: count() })
    .from(workshopRegistrations)
    .where(and(eq(workshopRegistrations.workshopId, id), eq(workshopRegistrations.attended, true)));
  await journaliser(db, { actorUserId: u.id, action: "workshop_attendance_saved", targetType: "workshop", targetId: id, details: { presents: n.n } });
  return { ok: true, valeur: { presents: n.n } };
}

// Liste des inscrits à exporter avant la suppression (CSV pour Excel : point-virgule et BOM)
export async function listePresencesCsv(db: Db, u: Utilisateur, id: string, langue: string) {
  const d = await lireAtelier(db, u, id);
  if (!d || d.atelier.registrationsPurgedAt) return null;
  const t = traducteur(langue, "Ateliers");
  const cellule = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const lignes = [
    [t("csvName"), t("csvEmail"), t("csvStatus"), t("csvPresent")],
    ...d.inscriptions.map((r) => [r.name, r.email, t(`statutsInscription.${r.status}`), r.attended ? t("yes") : t("no")]),
  ];
  await journaliser(db, { actorUserId: u.id, action: "workshop_attendance_exported", targetType: "workshop", targetId: id, details: { lignes: d.inscriptions.length } });
  return "﻿" + lignes.map((l) => l.map(cellule).join(";")).join("\r\n") + "\r\n";
}

// Vue d'IMA : ateliers avec une demande d'appui, les prochains d'abord
export async function ateliersAvecAppui(db: Db, admin: Utilisateur) {
  if (admin.role !== "admin" || admin.disabledAt) return null;
  return db
    .select({ atelier: workshops, entreprise: organizations.name, organizationId: organizations.id, pays: organizations.country })
    .from(workshops)
    .innerJoin(organizations, eq(workshops.organizationId, organizations.id))
    .where(isNotNull(workshops.supportStatus))
    .orderBy(asc(workshops.startsAt));
}

export async function administrateursActifs(db: Db) {
  return db.select({ id: users.id, name: users.name }).from(users).where(and(eq(users.role, "admin"), isNull(users.disabledAt))).orderBy(asc(users.name));
}

// Ateliers d'une année, pour le calendrier de sensibilisation (lisible par tous les référents de l'entreprise)
export async function ateliersDeLAnnee(db: Db, u: Utilisateur, organizationId: string, annee: number) {
  if (!peutLireCalendrier(u, organizationId)) return [];
  return db
    .select({ id: workshops.id, titre: workshops.title, type: workshops.type, debut: workshops.startsAt, annule: workshops.cancelledAt })
    .from(workshops)
    .where(
      and(
        eq(workshops.organizationId, organizationId),
        gte(workshops.startsAt, new Date(Date.UTC(annee, 0, 1))),
        lt(workshops.startsAt, new Date(Date.UTC(annee + 1, 0, 1))),
      ),
    )
    .orderBy(asc(workshops.startsAt));
}

// Ateliers liés aux actions d'un plan (page de suivi du plan)
export async function ateliersDuPlan(db: Db, planId: string) {
  const lignes = await db.select().from(workshops).where(eq(workshops.planId, planId)).orderBy(asc(workshops.startsAt));
  const parAction = new Map<string, { titre: string; debut: Date; annule: boolean; avis: number }[]>();
  for (const a of lignes) {
    if (!a.planActionId) continue;
    const [n] = await db.select({ n: count() }).from(workshopFeedback).where(eq(workshopFeedback.workshopId, a.id));
    parAction.set(a.planActionId, [...(parAction.get(a.planActionId) ?? []), { titre: a.title, debut: a.startsAt, annule: !!a.cancelledAt, avis: n.n }]);
  }
  return parAction;
}

// --- Tâches programmées : rappel de la veille, suppression ---------------------------------------------

// Une fois par nuit : rappel aux inscrits et au conseiller pour les ateliers des 36 prochaines heures
export async function envoyerRappelsAteliers(db: Db, maintenant = new Date(), envoi: Envoi = envoyerEmail) {
  const liste = await db
    .select()
    .from(workshops)
    .where(
      and(
        isNull(workshops.cancelledAt),
        isNull(workshops.reminderSentAt),
        gt(workshops.startsAt, maintenant),
        lte(workshops.startsAt, new Date(maintenant.getTime() + 36 * 3_600_000)),
      ),
    );
  let envoyes = 0;
  for (const a of liste) {
    const org = await entreprise(db, a.organizationId);
    if (!org) continue;
    const inscrits = await db
      .select()
      .from(workshopRegistrations)
      .where(and(eq(workshopRegistrations.workshopId, a.id), eq(workshopRegistrations.status, "inscrit")));
    for (const r of inscrits) {
      if (await envoyerSansBloquer(envoi, emailParticipant(a, org, r, "rappel", await lienRenouvele(db, r.id)))) envoyes++;
      await db.update(workshopRegistrations).set({ reminderSentAt: maintenant }).where(eq(workshopRegistrations.id, r.id));
    }
    // Conseillers en prévention : des nombres seulement, jamais de noms
    const conseillers = await db
      .select({ email: users.email, name: users.name })
      .from(users)
      .where(and(eq(users.organizationId, a.organizationId), eq(users.role, "referent"), eq(users.preventionAdvisor, true), isNull(users.disabledAt)));
    const [o] = await db.select({ locale: organizations.locale }).from(organizations).where(eq(organizations.id, a.organizationId));
    const langue = o?.locale ?? "fr";
    const t = traducteur(langue, "AteliersEmails");
    for (const d of conseillers) {
      const ok = await envoyerSansBloquer(
        envoi,
        emailIMA(langue, d, {
          sujet: t("rappelConseillerSujet", { titre: a.title }),
          salutation: t("salutation", { name: d.name }),
          paragraphes: [
            t("rappelConseillerTexte", { titre: a.title, quand: formaterQuand(a.startsAt, langue, FUSEAUX[org.country]), inscrits: inscrits.length, attente: await compter(db, a.id, "attente") }),
          ],
          bouton: t("ouvrirEspace"),
          lien: `${base()}/${langue}/espace/ateliers/${a.id}`,
        }),
      );
      if (ok) envoyes++;
    }
    await db.update(workshops).set({ reminderSentAt: maintenant }).where(eq(workshops.id, a.id));
    await journaliser(db, { action: "workshop_reminder_sent", targetType: "workshop", targetId: a.id, details: { inscrits: inscrits.length, conseillers: conseillers.length } });
  }
  return envoyes;
}

const entier = (nom: string, defaut: number) => {
  const v = Number(process.env[nom]);
  return Number.isInteger(v) && v > 0 ? v : defaut;
};

// Durées réglables dans .env.local, à confirmer dans l'AIPD et le contrat de sous-traitance
export function dureesAteliers() {
  return { inscriptionsJours: entier("WORKSHOP_REGISTRATIONS_RETENTION_DAYS", 30), avisMois: entier("WORKSHOP_FEEDBACK_RETENTION_MONTHS", 24) };
}

export async function purgerAteliers(db: Db, maintenant = new Date()) {
  const d = dureesAteliers();
  const limiteInscriptions = new Date(maintenant.getTime() - d.inscriptionsJours * 86_400_000);
  const aEffacer = await db
    .select()
    .from(workshops)
    .where(and(isNull(workshops.registrationsPurgedAt), lte(workshops.startsAt, limiteInscriptions)));
  for (const a of aEffacer) {
    const nombres = await effacerInscriptions(db, a, maintenant);
    await journaliser(db, { action: "workshop_registrations_deleted", targetType: "workshop", targetId: a.id, details: { inscrits: nombres.registeredCount, presents: nombres.attendedCount } });
  }
  const avisAEffacer = await db
    .select({ id: workshops.id })
    .from(workshops)
    .where(and(isNull(workshops.feedbackPurgedAt), lte(workshops.startsAt, moisAvant(maintenant, d.avisMois))));
  for (const a of avisAEffacer) {
    await db.transaction(async (tx) => {
      await tx.delete(workshopFeedback).where(eq(workshopFeedback.workshopId, a.id));
      await tx.update(workshops).set({ feedbackPurgedAt: maintenant }).where(eq(workshops.id, a.id));
    });
    await journaliser(db, { action: "workshop_feedback_deleted", targetType: "workshop", targetId: a.id });
  }
  return { inscriptions: aEffacer.length, avis: avisAEffacer.length };
}
