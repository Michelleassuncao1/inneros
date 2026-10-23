// Module B2 : calendrier de sensibilisation (droits, calendrier proposé, suivi, kit avec ressources d'aide,
// PDF, rappel mensuel).
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { ajouterReferent, creerEntreprise } from "../admin/entreprises";
import { awarenessCampaigns, awarenessThemes, campaigns, users } from "../db/schema";
import { creerBaseDeTest } from "../db/test-db";
import type { Email } from "../email/brevo";
import { pdfAffiche, pdfFicheAnimation } from "../pdf/sensibilisation";
import { designerConseillerPrevention } from "../risques/registre";
import { creerCampagne } from "../admin/campagnes";
import type { Kit } from "./contenu";
import { ajouterCampagne, envoyerRappelsSensibilisation, kitDeCampagne, lireCalendrier, majCampagne, proposerCalendrier } from "./calendrier";
import { creerTheme, enregistrerKit, validerTheme } from "./themes";

beforeAll(() => {
  process.env.AUTH_SECRET = randomBytes(32).toString("base64");
});

const kit = (titre: string): Kit => ({
  titre,
  objectif: "Objectif",
  article: "Article",
  message_court: "Message",
  affiche: { titre: "Affiche", texte: "Texte de l'affiche" },
  questions: ["Question ?"],
  email_managers: { objet: "Objet", texte: "Texte" },
  fiche_animation: { duree_minutes: 15, deroule: ["Étape 1"], conseils: ["Conseil"] },
});

async function preparer() {
  const { db } = await creerBaseDeTest();
  const [admin] = await db
    .insert(users)
    .values({ email: "admin@ima.test", name: "Admin", role: "admin", passwordHash: "x", aiLiteracyAt: "2026-10-01" })
    .returning();
  // Deux thèmes validés : février (tous pays) et octobre (Belgique seulement)
  const ids: string[] = [];
  for (const [code, mois, pays] of [["sommeil", 2, null], ["octobre-be", 10, ["BE"]]] as const) {
    const r = await creerTheme(db, admin.id, { fiche: { code, mois, journee: null, niveau_mindset: null, echelles: [], sensible: false, pays }, titre: code, objectif: "" });
    if (!r.ok) throw new Error(r.erreur);
    await enregistrerKit(db, admin.id, r.valeur.id, "fr", kit(`Kit ${code}`));
    expect((await validerTheme(db, admin.id, r.valeur.id)).ok).toBe(true);
    ids.push(r.valeur.id);
  }
  const org = await creerEntreprise(db, admin.id, { name: "Atelier Fictif", country: "FR", locale: "fr", sector: "Industrie", sizeBand: "50-249" });
  if (!org.ok) throw new Error(org.erreur);
  const orgId = org.valeur.id;
  // Campagne de diagnostic avec une personne de soutien
  const c = await creerCampagne(db, admin.id, orgId, {
    mandateType: "n1", mandateReference: "M-1", diagnosticQuestion: "", perimeter: "", groupMinSize: 10,
    startDate: "2026-11-01", endDate: "2026-11-30", locales: ["fr"], groupingCriterion: "service",
  });
  if (!c.ok) throw new Error(c.erreur);
  await db.update(campaigns).set({ supportContacts: [{ role: "referentHarcelement", nom: "Référente fictive", telephone: "01 00 00 00 00" }] }).where(eq(campaigns.id, c.valeur.id));
  for (const [nom, email] of [["Conseillère", "cp@atelier.test"], ["Autre référent", "rh@atelier.test"]]) {
    const r = await ajouterReferent(db, admin.id, orgId, { name: nom, email });
    if (!r.ok) throw new Error(r.erreur);
  }
  const [cp0] = await db.select().from(users).where(eq(users.email, "cp@atelier.test"));
  await designerConseillerPrevention(db, admin.id, orgId, cp0.id, true);
  const [conseiller] = await db.select().from(users).where(eq(users.email, "cp@atelier.test"));
  const [autre] = await db.select().from(users).where(eq(users.email, "rh@atelier.test"));
  return { db, admin, orgId, conseiller, autre, themes: ids };
}

describe("Calendrier de sensibilisation", () => {
  it("propose le calendrier annuel avec les thèmes validés du pays, une seule fois", async () => {
    const { db, orgId, conseiller, autre } = await preparer();
    expect(await proposerCalendrier(db, conseiller, orgId, 2027)).toEqual({ ok: true, valeur: { nombre: 1 } }); // thème belge exclu
    expect(await proposerCalendrier(db, conseiller, orgId, 2027)).toEqual({ ok: true, valeur: { nombre: 0 } });
    const cal = (await lireCalendrier(db, autre, orgId, 2027))!; // les autres référents consultent
    expect(cal.map((c) => `${c.month}:${c.origin}:${c.status}`)).toEqual(["2:programmee:prevue"]);
    // Un référent qui n'est pas conseiller en prévention ne modifie rien ; la base refuse aussi
    expect(await proposerCalendrier(db, autre, orgId, 2028)).toEqual({ ok: false, erreur: "introuvable" });
    await expect(
      db.insert(awarenessCampaigns).values({ organizationId: orgId, themeId: cal[0].themeId, year: 2029, month: 3, origin: "manuelle", updatedBy: autre.id }),
    ).rejects.toThrow();
  });

  it("ajoute, déplace et suit une campagne (diffusée, réalisée), sans coordonnées dans le commentaire", async () => {
    const { db, orgId, conseiller, themes } = await preparer();
    const r = await ajouterCampagne(db, conseiller, orgId, { themeId: themes[0], annee: 2027, mois: 5 });
    if (!r.ok) throw new Error(r.erreur);
    expect(await ajouterCampagne(db, conseiller, orgId, { themeId: themes[0], annee: 2027, mois: 6 })).toEqual({ ok: false, erreur: "campagneSensibDejaPrevue" });
    expect(await ajouterCampagne(db, conseiller, orgId, { themeId: themes[1], annee: 2027, mois: 6 })).toEqual({ ok: false, erreur: "introuvable" }); // thème belge
    const maintenant = new Date("2027-05-20T10:00:00Z");
    expect((await majCampagne(db, conseiller, r.valeur.id, { mois: 5, statut: "diffusee", diffuseeLe: "2027-05-15", commentaire: "Intranet et affichage" }, maintenant)).ok).toBe(true);
    expect(await majCampagne(db, conseiller, r.valeur.id, { mois: 5, statut: "realisee", diffuseeLe: "2027-06-01" }, maintenant)).toEqual({ ok: false, erreur: "adoptionDates" });
    expect(await majCampagne(db, conseiller, r.valeur.id, { mois: 5, statut: "realisee", commentaire: "rh@atelier.fr" }, maintenant)).toEqual({ ok: false, erreur: "risqueCoordonnees" });
    const [c] = await db.select().from(awarenessCampaigns).where(eq(awarenessCampaigns.id, r.valeur.id));
    expect([c.status, c.diffusedOn, c.origin]).toEqual(["diffusee", "2027-05-15", "manuelle"]);
  });

  it("fournit le kit avec les personnes de soutien de l'entreprise et les numéros d'aide du pays, et ses PDF", async () => {
    const { db, orgId, conseiller, autre } = await preparer();
    await proposerCalendrier(db, conseiller, orgId, 2027);
    const [c] = (await lireCalendrier(db, conseiller, orgId, 2027))!;
    const k = (await kitDeCampagne(db, autre, c.id, "nl"))!; // pas de kit néerlandais : repli sur le français
    expect([k.langue, k.kit.titre]).toEqual(["fr", "Kit sommeil"]);
    expect(k.aide.contacts).toEqual([{ role: "Référent harcèlement", nom: "Référente fictive", telephone: "01 00 00 00 00", email: null }]);
    expect(k.aide.aides.some((a) => a.numero === "3114")).toBe(true);
    for (const pdf of [await pdfAffiche(k.kit, k.aide, k.langue), await pdfFicheAnimation(k.kit, k.aide, k.langue)]) expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    // Thème repassé en brouillon : le kit n'est plus servi
    await db.update(awarenessThemes).set({ status: "draft" }).where(eq(awarenessThemes.id, c.themeId));
    expect(await kitDeCampagne(db, autre, c.id)).toBeNull();
  }, 60000);

  it("envoie le rappel mensuel une fois, au conseiller en prévention, s'il reste des campagnes prévues", async () => {
    const { db, orgId, conseiller } = await preparer();
    await proposerCalendrier(db, conseiller, orgId, 2027);
    const envoyes: Email[] = [];
    const envoi = async (e: Email) => void envoyes.push(e);
    expect(await envoyerRappelsSensibilisation(db, new Date("2027-01-15T03:00:00Z"), envoi)).toBe(0); // rien en janvier
    expect(await envoyerRappelsSensibilisation(db, new Date("2027-02-01T03:00:00Z"), envoi)).toBe(1);
    expect(await envoyerRappelsSensibilisation(db, new Date("2027-02-02T03:00:00Z"), envoi)).toBe(0); // déjà envoyé ce mois
    expect(envoyes[0].to.email).toBe("cp@atelier.test");
    expect(JSON.stringify(envoyes[0])).not.toContain("Kit sommeil");
  });
});
