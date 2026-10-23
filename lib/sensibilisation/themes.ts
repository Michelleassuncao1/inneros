// Bibliothèque de thèmes de sensibilisation (module B1) : création, modification, brouillon par l'IA,
// validation par un praticien IMA formé à l'IA, archivage. Contenu générique : aucune donnée d'entreprise
// n'est envoyée à l'IA. Toutes les écritures sont journalisées.
import path from "node:path";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { journaliser } from "../audit";
import { awarenessThemes, instruments, users } from "../db/schema";
import type { Db } from "../db/types";
import { definitionPour } from "../instruments/chargement";
import { appelStructure, type ResultatStructure } from "../rapport/ia";
import { iaActiveGlobalement, type Resultat } from "../rapport/rapports";
import { kitComplet, kitVide, LANGUES_THEME, lireKits, schemaFicheTheme, schemaKit, type FicheTheme, type Kit, type LangueTheme } from "./contenu";

export const FICHIER_PROMPT_THEME = path.join(process.cwd(), "prompts", "theme-sensibilisation.system.md");

type Ligne = typeof awarenessThemes.$inferSelect;

export function lireTheme(l: Ligne) {
  const fiche = schemaFicheTheme.safeParse(l.sheet);
  return { ...l, fiche: fiche.success ? fiche.data : null, kitsLus: lireKits(l.kits) };
}
export type Theme = ReturnType<typeof lireTheme>;

export async function listerThemes(db: Db) {
  return (await db.select().from(awarenessThemes).orderBy(asc(awarenessThemes.code))).map(lireTheme);
}

export async function themeParId(db: Db, id: string) {
  const [l] = await db.select().from(awarenessThemes).where(eq(awarenessThemes.id, id));
  return l ? lireTheme(l) : null;
}

const sansCoordonnees = (s: string) => !/[^\s@"]+@[^\s@"]+\.[^\s@"]+/.test(s) && !/(\+?\d[\s.-]?){8,}/.test(s);

// --- Création et modification -----------------------------------------------------------------

export async function creerTheme(
  db: Db,
  adminId: string,
  saisie: { fiche: unknown; titre: string; objectif: string },
): Promise<Resultat<{ id: string }>> {
  const fiche = schemaFicheTheme.safeParse(saisie.fiche);
  const titre = saisie.titre.trim();
  const objectif = saisie.objectif.trim();
  if (!fiche.success || !titre || titre.length > 120 || objectif.length > 500) return { ok: false, erreur: "saisieInvalide" };
  const [deja] = await db.select({ id: awarenessThemes.id }).from(awarenessThemes).where(eq(awarenessThemes.code, fiche.data.code));
  if (deja) return { ok: false, erreur: "themeCodeExistant" };
  const [l] = await db
    .insert(awarenessThemes)
    .values({ code: fiche.data.code, sheet: fiche.data, kits: { fr: { ...kitVide(), titre, objectif } }, createdBy: adminId })
    .returning({ id: awarenessThemes.id });
  await journaliser(db, { actorUserId: adminId, action: "theme_created", targetType: "theme", targetId: l.id, details: { code: fiche.data.code } });
  return { ok: true, valeur: { id: l.id } };
}

// Toute modification d'un thème validé le repasse en brouillon : il devra être revalidé
async function modifier(db: Db, adminId: string, id: string, valeurs: Partial<typeof awarenessThemes.$inferInsert>, action: string, details?: object) {
  const [l] = await db.select().from(awarenessThemes).where(eq(awarenessThemes.id, id));
  if (!l || l.status === "archived") return { ok: false as const, erreur: "introuvable" };
  await db
    .update(awarenessThemes)
    .set({ ...valeurs, status: "draft", validatedBy: null, validatedAt: null, updatedAt: new Date() })
    .where(eq(awarenessThemes.id, id));
  await journaliser(db, { actorUserId: adminId, action, targetType: "theme", targetId: id, details: { ...details, etaitValide: l.status === "validated" } });
  return { ok: true as const, valeur: undefined };
}

export async function modifierFiche(db: Db, adminId: string, id: string, fiche: unknown): Promise<Resultat> {
  const f = schemaFicheTheme.safeParse(fiche);
  if (!f.success) return { ok: false, erreur: "saisieInvalide" };
  const [autre] = await db.select({ id: awarenessThemes.id }).from(awarenessThemes).where(eq(awarenessThemes.code, f.data.code));
  if (autre && autre.id !== id) return { ok: false, erreur: "themeCodeExistant" };
  return modifier(db, adminId, id, { code: f.data.code, sheet: f.data }, "theme_sheet_saved");
}

export async function enregistrerKit(db: Db, adminId: string, id: string, langue: string, kit: unknown): Promise<Resultat> {
  const lg = z.enum(LANGUES_THEME).safeParse(langue);
  const k = schemaKit.safeParse(kit);
  if (!lg.success || !k.success) return { ok: false, erreur: "saisieInvalide" };
  if (!sansCoordonnees(JSON.stringify(k.data))) return { ok: false, erreur: "themeCoordonnees" };
  const t = await themeParId(db, id);
  if (!t) return { ok: false, erreur: "introuvable" };
  return modifier(db, adminId, id, { kits: { ...t.kitsLus, [lg.data]: k.data } }, "theme_kit_saved", { langue: lg.data });
}

// --- Brouillon par l'IA -----------------------------------------------------------------------

export const schemaChargeTheme = z
  .object({
    theme: z
      .object({
        titre: z.string().max(120),
        objectif: z.string().max(500),
        mois: z.number().int().nullable(),
        journee: z.string().max(120).nullable(),
        niveau_mindset: z.string().max(20).nullable(),
        echelles: z.array(z.string().max(200)),
        sensible: z.boolean(),
        pays: z.array(z.string()).nullable(),
      })
      .strict(),
    langue: z.enum(LANGUES_THEME),
  })
  .strict();
export type ChargeTheme = z.infer<typeof schemaChargeTheme>;

export type AppelTheme = (charge: ChargeTheme) => Promise<ResultatStructure<Kit>>;
export const appelClaudeTheme: AppelTheme = (charge) => appelStructure(FICHIER_PROMPT_THEME, schemaKit, charge);

// Noms lisibles des échelles visées (questionnaires chargés), dans la langue du kit
async function nomsEchelles(db: Db, ids: string[], langue: string) {
  if (!ids.length) return [];
  const noms = new Map<string, string>();
  for (const i of await db.select({ definitions: instruments.definitions }).from(instruments)) {
    const d = definitionPour(i.definitions, langue) ?? definitionPour(i.definitions, "fr");
    for (const dim of d?.dimensions ?? []) if (ids.includes(dim.id) && !noms.has(dim.id)) noms.set(dim.id, dim.nom);
  }
  return ids.map((id) => noms.get(id) ?? id);
}

export async function genererKitIA(db: Db, adminId: string, id: string, langue: string, appel: AppelTheme = appelClaudeTheme): Promise<Resultat> {
  const lg = z.enum(LANGUES_THEME).safeParse(langue);
  if (!lg.success) return { ok: false, erreur: "saisieInvalide" };
  if (!iaActiveGlobalement()) return { ok: false, erreur: "iaDesactivee" };
  const t = await themeParId(db, id);
  if (!t || !t.fiche || t.status === "archived") return { ok: false, erreur: "introuvable" };
  // Brief : titre et objectif de la langue demandée, sinon du français
  const source = t.kitsLus[lg.data] ?? t.kitsLus.fr ?? kitVide();
  const charge: ChargeTheme = {
    theme: {
      titre: source.titre || t.code,
      objectif: source.objectif,
      mois: t.fiche.mois,
      journee: t.fiche.journee,
      niveau_mindset: t.fiche.niveau_mindset,
      echelles: await nomsEchelles(db, t.fiche.echelles, lg.data),
      sensible: t.fiche.sensible,
      pays: t.fiche.pays,
    },
    langue: lg.data,
  };
  // Contrôle avant envoi : uniquement le brief générique d'IMA, sans coordonnées
  if (!schemaChargeTheme.safeParse(charge).success || !sansCoordonnees(JSON.stringify(charge))) {
    await journaliser(db, { actorUserId: adminId, action: "theme_ai_blocked", targetType: "theme", targetId: id });
    return { ok: false, erreur: "iaEnvoiBloque" };
  }
  const r = await appel(charge);
  if (!r.ok) {
    await journaliser(db, { actorUserId: adminId, action: "theme_ai_failed", targetType: "theme", targetId: id, details: { erreur: r.erreur } });
    return { ok: false, erreur: r.erreur, detail: r.detail };
  }
  // Le brouillon de l'IA ne doit pas contenir de coordonnées (elles sont ajoutées par InnerOS)
  if (!sansCoordonnees(JSON.stringify(r.contenu))) return { ok: false, erreur: "themeCoordonnees" };
  const m = await modifier(
    db,
    adminId,
    id,
    { kits: { ...t.kitsLus, [lg.data]: r.contenu }, aiModel: r.modele, aiPromptVersion: r.versionPrompt },
    "theme_ai_generated",
    { langue: lg.data, modele: r.modele, prompt: r.versionPrompt, jetonsEntree: r.jetonsEntree, jetonsSortie: r.jetonsSortie },
  );
  return m;
}

// --- Validation et archivage ------------------------------------------------------------------

export async function validerTheme(db: Db, adminId: string, id: string, maintenant = new Date()): Promise<Resultat> {
  const t = await themeParId(db, id);
  if (!t || !t.fiche || t.status === "archived") return { ok: false, erreur: "introuvable" };
  const [admin] = await db.select().from(users).where(eq(users.id, adminId));
  if (!admin?.aiLiteracyAt) return { ok: false, erreur: "rapportFormationIARequise" };
  // Le français est obligatoire ; chaque langue présente doit être complète
  const langues = Object.keys(t.kitsLus) as LangueTheme[];
  if (!kitComplet(t.kitsLus.fr) || langues.some((lg) => !kitComplet(t.kitsLus[lg]))) return { ok: false, erreur: "themeIncomplet" };
  await db.update(awarenessThemes).set({ status: "validated", validatedBy: adminId, validatedAt: maintenant, updatedAt: maintenant }).where(eq(awarenessThemes.id, id));
  await journaliser(db, { actorUserId: adminId, action: "theme_validated", targetType: "theme", targetId: id, details: { langues } });
  return { ok: true, valeur: undefined };
}

export async function archiverTheme(db: Db, adminId: string, id: string): Promise<Resultat> {
  const [l] = await db.update(awarenessThemes).set({ status: "archived", updatedAt: new Date() }).where(eq(awarenessThemes.id, id)).returning({ id: awarenessThemes.id });
  if (!l) return { ok: false, erreur: "introuvable" };
  await journaliser(db, { actorUserId: adminId, action: "theme_archived", targetType: "theme", targetId: id });
  return { ok: true, valeur: undefined };
}

// Thèmes validés proposés aux entreprises d'un pays (module B2)
export async function themesValides(db: Db, pays: string) {
  return (await listerThemes(db)).filter((t) => t.status === "validated" && t.fiche && (!t.fiche.pays || t.fiche.pays.includes(pays as never)));
}

export type { FicheTheme, Kit };
