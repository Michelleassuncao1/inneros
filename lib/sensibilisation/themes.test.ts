// Module B1 : bibliothèque de thèmes de sensibilisation (création, kit, brouillon IA simulé, validation).
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { awarenessThemes, users } from "../db/schema";
import { creerBaseDeTest } from "../db/test-db";
import { lirePrompt } from "../rapport/ia";
import { kitComplet, schemaFicheTheme, type Kit } from "./contenu";
import { creerTheme, enregistrerKit, FICHIER_PROMPT_THEME, genererKitIA, themeParId, themesValides, validerTheme, type ChargeTheme } from "./themes";

beforeAll(() => {
  process.env.AUTH_SECRET = randomBytes(32).toString("base64");
});

const fiche = { code: "sommeil-recuperation", mois: 2, journee: null, niveau_mindset: "organisation", echelles: ["wf"], sensible: false, pays: ["BE"] };
const kitPlein = (titre: string): Kit => ({
  titre,
  objectif: "Objectif",
  article: "Article",
  message_court: "Message",
  affiche: { titre: "Affiche", texte: "Texte" },
  questions: ["Question ?"],
  email_managers: { objet: "Objet", texte: "Texte" },
  fiche_animation: { duree_minutes: 15, deroule: ["Étape"], conseils: ["Conseil"] },
});

async function preparer() {
  const { db } = await creerBaseDeTest();
  const [admin] = await db
    .insert(users)
    .values({ email: "admin@ima.test", name: "Admin", role: "admin", passwordHash: "x", aiLiteracyAt: "2026-10-01" })
    .returning();
  const r = await creerTheme(db, admin.id, { fiche, titre: "Récupérer entre deux journées", objectif: "Faire le lien avec l'organisation" });
  if (!r.ok) throw new Error(r.erreur);
  return { db, admin, id: r.valeur.id };
}

describe("Thèmes de sensibilisation", () => {
  it("les 12 thèmes initiaux ont une fiche valide, un par mois, et le prompt est versionné", () => {
    const themes = JSON.parse(readFileSync("data/sensibilisation/themes-initiaux.json", "utf8")) as { fiche: unknown; titre: string }[];
    expect(themes).toHaveLength(12);
    const fiches = themes.map((t) => schemaFicheTheme.parse(t.fiche));
    expect(fiches.map((f) => f.mois)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(fiches.filter((f) => f.sensible).map((f) => f.code)).toEqual(["prevention-suicide", "respect-harcelement"]);
    expect(lirePrompt(FICHIER_PROMPT_THEME).version).toBe("theme-v1.0");
  });

  it("refuse un code en double et un kit contenant des coordonnées", async () => {
    const { db, admin, id } = await preparer();
    expect(await creerTheme(db, admin.id, { fiche, titre: "Autre", objectif: "" })).toEqual({ ok: false, erreur: "themeCodeExistant" });
    expect(await enregistrerKit(db, admin.id, id, "fr", { ...kitPlein("Titre"), message_court: "Appelez le 0800 32 123" })).toEqual({ ok: false, erreur: "themeCoordonnees" });
    expect(await enregistrerKit(db, admin.id, id, "de", kitPlein("Titel"))).toEqual({ ok: false, erreur: "saisieInvalide" });
  });

  it("rédige un kit avec l'IA à partir de la seule fiche du thème", async () => {
    const { db, admin, id } = await preparer();
    const recus: ChargeTheme[] = [];
    const ia = async (c: ChargeTheme) => {
      recus.push(c);
      return { ok: true as const, contenu: kitPlein("Bien récupérer"), modele: "claude-sonnet-5-5", versionPrompt: "theme-v1.0", jetonsEntree: 1, jetonsSortie: 1 };
    };
    expect((await genererKitIA(db, admin.id, id, "nl", ia)).ok).toBe(true);
    expect(recus[0]).toMatchObject({ langue: "nl", theme: { titre: "Récupérer entre deux journées", mois: 2, sensible: false } });
    const t = (await themeParId(db, id))!;
    expect(t.kitsLus.nl?.titre).toBe("Bien récupérer");
    expect(t.aiModel).toBe("claude-sonnet-5-5");
    // Un brouillon de l'IA avec un numéro de téléphone est refusé
    const ia2 = async () => ({ ok: true as const, contenu: { ...kitPlein("x"), article: "Appelez le 0800 32 123" }, modele: "m", versionPrompt: "v", jetonsEntree: 1, jetonsSortie: 1 });
    expect(await genererKitIA(db, admin.id, id, "en", ia2)).toEqual({ ok: false, erreur: "themeCoordonnees" });
  });

  it("valide un thème complet (français obligatoire) ; toute modification le repasse en brouillon", async () => {
    const { db, admin, id } = await preparer();
    expect(await validerTheme(db, admin.id, id)).toEqual({ ok: false, erreur: "themeIncomplet" });
    await enregistrerKit(db, admin.id, id, "fr", kitPlein("Récupérer"));
    await enregistrerKit(db, admin.id, id, "nl", { ...kitPlein("Herstellen"), article: "" });
    expect(await validerTheme(db, admin.id, id)).toEqual({ ok: false, erreur: "themeIncomplet" }); // néerlandais commencé mais incomplet
    await enregistrerKit(db, admin.id, id, "nl", kitPlein("Herstellen"));
    await db.update(users).set({ aiLiteracyAt: null }).where(eq(users.id, admin.id));
    expect(await validerTheme(db, admin.id, id)).toEqual({ ok: false, erreur: "rapportFormationIARequise" });
    await db.update(users).set({ aiLiteracyAt: "2026-10-01" }).where(eq(users.id, admin.id));
    expect((await validerTheme(db, admin.id, id)).ok).toBe(true);
    expect((await themesValides(db, "BE")).map((t) => t.id)).toEqual([id]);
    expect(await themesValides(db, "FR")).toEqual([]); // thème réservé à la Belgique
    expect(kitComplet((await themeParId(db, id))!.kitsLus.fr)).toBe(true);

    await enregistrerKit(db, admin.id, id, "fr", kitPlein("Récupérer mieux"));
    const [l] = await db.select().from(awarenessThemes).where(eq(awarenessThemes.id, id));
    expect([l.status, l.validatedAt]).toEqual(["draft", null]);
  });
});
