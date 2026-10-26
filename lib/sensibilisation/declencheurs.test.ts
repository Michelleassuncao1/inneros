// Module B3 : propositions de campagnes déclenchées par le registre, les comportements signalés, les événements
// déclarés et les alertes réglementaires d'IMA ; acceptation, refus, avance d'une campagne prévue ; lien avec
// le plan de prévention.
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { creerCampagne } from "../admin/campagnes";
import { ajouterReferent, creerEntreprise } from "../admin/entreprises";
import { awarenessCampaigns, awarenessSuggestions, preventionPlans, risks, users } from "../db/schema";
import { creerBaseDeTest } from "../db/test-db";
import type { Email } from "../email/brevo";
import { planVide } from "../plan/contenu";
import { designerConseillerPrevention } from "../risques/registre";
import { ajouterCampagne, lireCalendrier } from "./calendrier";
import type { Kit } from "./contenu";
import {
  accepterProposition,
  actualiserPropositions,
  actionsPourLien,
  campagnesDuPlan,
  causesAcceptees,
  creerAlerte,
  decesRecent,
  declarerEvenement,
  lierActionPlan,
  lirePropositions,
  refuserProposition,
  retirerAlerte,
} from "./declencheurs";
import { creerTheme, enregistrerKit, validerTheme } from "./themes";

beforeAll(() => {
  process.env.AUTH_SECRET = randomBytes(32).toString("base64");
});

const kit = (titre: string): Kit => ({
  titre,
  objectif: "Objectif",
  article: "Article",
  message_court: "Message",
  affiche: { titre: "Affiche", texte: "Texte" },
  questions: ["Question ?"],
  email_managers: { objet: "Objet", texte: "Texte" },
  fiche_animation: { duree_minutes: 15, deroule: ["Étape 1"], conseils: ["Conseil"] },
});

const MAINTENANT = new Date("2027-03-10T10:00:00Z"); // propositions pour avril 2027

async function preparer() {
  const { db } = await creerBaseDeTest();
  const [admin] = await db
    .insert(users)
    .values({ email: "admin@ima.test", name: "Admin", role: "admin", passwordHash: "x", aiLiteracyAt: "2026-10-01" })
    .returning();
  // Thèmes validés : charge (échelle « charge »), respect (comportements), changements (réorganisation)
  const themes: Record<string, string> = {};
  for (const [code, echelles, evenements, mois] of [
    ["charge", ["charge"], [], 10],
    ["respect", ["harcelement"], ["agression"], 11],
    ["changements", [], ["reorganisation"], 7],
  ] as const) {
    const r = await creerTheme(db, admin.id, {
      fiche: { code, mois, journee: null, niveau_mindset: null, echelles, sensible: false, pays: null, evenements },
      titre: code,
      objectif: "",
    });
    if (!r.ok) throw new Error(r.erreur);
    await enregistrerKit(db, admin.id, r.valeur.id, "fr", kit(`Kit ${code}`));
    expect((await validerTheme(db, admin.id, r.valeur.id)).ok).toBe(true);
    themes[code] = r.valeur.id;
  }
  const org = await creerEntreprise(db, admin.id, { name: "Atelier Fictif", country: "FR", locale: "fr", sector: "Industrie", sizeBand: "50-249" });
  if (!org.ok) throw new Error(org.erreur);
  const orgId = org.valeur.id;
  for (const [nom, email] of [["Conseillère", "cp@atelier.test"], ["Autre référent", "rh@atelier.test"]]) {
    const r = await ajouterReferent(db, admin.id, orgId, { name: nom, email });
    if (!r.ok) throw new Error(r.erreur);
  }
  const [cp0] = await db.select().from(users).where(eq(users.email, "cp@atelier.test"));
  await designerConseillerPrevention(db, admin.id, orgId, cp0.id, true);
  const [conseiller] = await db.select().from(users).where(eq(users.email, "cp@atelier.test"));
  const [autre] = await db.select().from(users).where(eq(users.email, "rh@atelier.test"));
  const risque = async (v: Partial<typeof risks.$inferInsert>) =>
    (
      await db
        .insert(risks)
        .values({ organizationId: orgId, source: "echelle", title: "Risque", probability: "3", exposure: "6", gravity: "7", updatedBy: admin.id, ...v })
        .returning()
    )[0];
  return { db, admin, orgId, conseiller, autre, themes, risque };
}

describe("Propositions déclenchées par le registre des risques", () => {
  it("propose le thème de l'échelle d'un risque « important » ou plus, une seule fois, au conseiller seulement", async () => {
    const { db, admin, orgId, conseiller, autre, themes, risque } = await preparer();
    await risque({ scaleId: "charge", title: "Charge de travail" }); // 3 × 6 × 7 = 126 : important
    await risque({ scaleId: "charge", title: "Petit risque", probability: "1", exposure: "6", gravity: "7" }); // 42 : possible
    // Risque d'une campagne dont le rapport n'est pas validé : ignoré
    const c = await creerCampagne(db, admin.id, orgId, {
      mandateType: "n1", mandateReference: "M-1", diagnosticQuestion: "", perimeter: "", groupMinSize: 10,
      startDate: "2027-01-01", endDate: "2027-01-31", locales: ["fr"], groupingCriterion: "service",
    });
    if (!c.ok) throw new Error(c.erreur);
    await risque({ scaleId: "charge", title: "Non validé", probability: "10", campaignId: c.valeur.id });

    expect(await actualiserPropositions(db, orgId, MAINTENANT)).toBe(1);
    expect(await actualiserPropositions(db, orgId, MAINTENANT)).toBe(0);
    expect(await lirePropositions(db, autre, orgId)).toEqual([]);
    const [p] = await lirePropositions(db, conseiller, orgId);
    expect([p.themeId, p.origin, p.year, p.month, p.priority, p.existante]).toEqual([themes.charge, "registre", 2027, 4, false, null]);
    expect(p.cause).toEqual({ type: "registre", risque: "Charge de travail", classe: "important" });

    expect(await accepterProposition(db, autre, p.id, { mois: 5 }, MAINTENANT)).toEqual({ ok: false, erreur: "introuvable" });
    const r = await accepterProposition(db, conseiller, p.id, { mois: 5 }, MAINTENANT);
    if (!r.ok) throw new Error(r.erreur);
    const cal = (await lireCalendrier(db, autre, orgId, 2027))!;
    expect(cal.map((x) => `${x.month}:${x.origin}`)).toEqual(["5:registre"]);
    expect(await lirePropositions(db, conseiller, orgId)).toEqual([]);
    expect(await accepterProposition(db, conseiller, p.id, { mois: 5 }, MAINTENANT)).toEqual({ ok: false, erreur: "introuvable" });
  });

  it("avance la campagne déjà prévue cette année au lieu de créer un doublon", async () => {
    const { db, orgId, conseiller, themes, risque } = await preparer();
    const prevue = await ajouterCampagne(db, conseiller, orgId, { themeId: themes.charge, annee: 2027, mois: 10 });
    if (!prevue.ok) throw new Error(prevue.erreur);
    await risque({ scaleId: "charge", title: "Charge de travail", probability: "6" }); // 252 : élevé, prioritaire
    await actualiserPropositions(db, orgId, MAINTENANT);
    const [p] = await lirePropositions(db, conseiller, orgId);
    expect([p.priority, p.existante?.month]).toEqual([true, 10]);
    expect((await accepterProposition(db, conseiller, p.id, { mois: 4 }, MAINTENANT)).ok).toBe(true);
    const lignes = await db.select().from(awarenessCampaigns).where(eq(awarenessCampaigns.organizationId, orgId));
    expect(lignes.map((l) => `${l.month}:${l.origin}`)).toEqual(["4:manuelle"]);
    expect((await causesAcceptees(db, conseiller, orgId)).get(prevue.valeur.id)).toEqual([{ type: "registre", risque: "Charge de travail", classe: "eleve" }]);
  });
});

describe("Comportements signalés et événements", () => {
  it("propose une campagne prioritaire sans aucun chiffre, et un refus motivé n'est pas reproposé", async () => {
    const { db, orgId, conseiller, themes, risque } = await preparer();
    await risque({ source: "comportement", scaleId: "harcelement", title: "Harcèlement", probability: "1", exposure: "1", gravity: "7" });
    await actualiserPropositions(db, orgId, MAINTENANT);
    const [p] = await lirePropositions(db, conseiller, orgId);
    expect([p.themeId, p.origin, p.priority, p.cause]).toEqual([themes.respect, "comportement", true, { type: "comportement" }]);
    expect(await refuserProposition(db, conseiller, p.id, "")).toEqual({ ok: false, erreur: "motifRefusRequis" });
    expect(await refuserProposition(db, conseiller, p.id, "Voir rh@atelier.fr")).toEqual({ ok: false, erreur: "risqueCoordonnees" });
    expect((await refuserProposition(db, conseiller, p.id, "Campagne menée en interne en février")).ok).toBe(true);
    expect(await actualiserPropositions(db, orgId, MAINTENANT)).toBe(0);
    const [ligne] = await db.select().from(awarenessSuggestions).where(eq(awarenessSuggestions.id, p.id));
    expect([ligne.status, ligne.refusalReason]).toEqual(["refusee", "Campagne menée en interne en février"]);
  });

  it("propose les thèmes liés à un événement déclaré ; un décès ne déclenche aucune campagne", async () => {
    const { db, orgId, conseiller, autre, themes } = await preparer();
    expect(await declarerEvenement(db, autre, orgId, { type: "reorganisation", date: "2027-03-01" }, MAINTENANT)).toEqual({ ok: false, erreur: "introuvable" });
    expect(await declarerEvenement(db, conseiller, orgId, { type: "reorganisation", date: "2027-04-01" }, MAINTENANT)).toEqual({ ok: false, erreur: "evenementDate" });
    expect(await declarerEvenement(db, conseiller, orgId, { type: "inconnu", date: "2027-03-01" }, MAINTENANT)).toEqual({ ok: false, erreur: "saisieInvalide" });
    expect(await declarerEvenement(db, conseiller, orgId, { type: "reorganisation", date: "2027-03-01" }, MAINTENANT)).toEqual({ ok: true, valeur: { deces: false, propositions: 1 } });
    const [p] = await lirePropositions(db, conseiller, orgId);
    expect([p.themeId, p.origin, p.priority, p.cause]).toEqual([themes.changements, "evenement", false, { type: "evenement", evenement: "reorganisation", date: "2027-03-01" }]);

    expect(await decesRecent(db, orgId, MAINTENANT)).toBe(false);
    expect(await declarerEvenement(db, conseiller, orgId, { type: "deces", date: "2027-03-05" }, MAINTENANT)).toEqual({ ok: true, valeur: { deces: true, propositions: 0 } });
    expect(await decesRecent(db, orgId, MAINTENANT)).toBe(true);
    expect(await decesRecent(db, orgId, new Date("2027-12-01T10:00:00Z"))).toBe(false);
  });
});

describe("Alertes réglementaires d'IMA", () => {
  it("cible les entreprises par pays et secteur, prévient le conseiller, et se retire", async () => {
    const { db, admin, orgId, conseiller, themes } = await preparer();
    const autreOrg = await creerEntreprise(db, admin.id, { name: "Clinique Fictive", country: "FR", locale: "fr", sector: "Santé", sizeBand: "50-249" });
    if (!autreOrg.ok) throw new Error(autreOrg.erreur);
    const envoyes: Email[] = [];
    const envoi = async (e: Email) => void envoyes.push(e);
    const saisie = { titre: "Nouvelle obligation", message: "Texte de l'alerte", pays: ["FR"], secteurs: ["industrie "], themeIds: [themes.charge], annee: 2027, mois: 6 };
    expect(await creerAlerte(db, conseiller, saisie, MAINTENANT, envoi)).toEqual({ ok: false, erreur: "introuvable" });
    const r = await creerAlerte(db, admin, saisie, MAINTENANT, envoi);
    if (!r.ok) throw new Error(r.erreur);
    expect(r.valeur.entreprises).toBe(1); // « Industrie » seulement, pas la clinique
    expect(envoyes.map((e) => e.to.email)).toEqual(["cp@atelier.test"]);
    expect(JSON.stringify(envoyes[0])).toContain("Nouvelle obligation");
    const [p] = await lirePropositions(db, conseiller, orgId);
    expect([p.origin, p.month, p.priority, p.cause?.type]).toEqual(["alerte", 6, true, "alerte"]);
    expect((await retirerAlerte(db, admin, r.valeur.id, MAINTENANT)).ok).toBe(true);
    expect(await lirePropositions(db, conseiller, orgId)).toEqual([]);
    expect(await actualiserPropositions(db, orgId, MAINTENANT)).toBe(0);
  });
});

describe("Lien avec le plan de prévention", () => {
  it("relie une campagne à une action du plan validé et la montre dans le suivi du plan", async () => {
    const { db, admin, orgId, conseiller, autre, themes } = await preparer();
    const action = { id: "a1", titre: "Former les managers", description: "", risques: [], niveau_prevention: "primaire" as const, responsable: "Direction", trimestre: 2, effort: "simple" as const, budget: "", indicateur: "" };
    const [plan] = await db
      .insert(preventionPlans)
      .values({ organizationId: orgId, status: "validated", country: "FR", language: "fr", startYear: 2027, actionYear: 2027, content: { ...planVide(), actions: [action] }, validatedBy: admin.id, validatedAt: new Date() })
      .returning();
    const c = await ajouterCampagne(db, conseiller, orgId, { themeId: themes.charge, annee: 2027, mois: 4 });
    if (!c.ok) throw new Error(c.erreur);
    expect((await actionsPourLien(db, conseiller, orgId))?.actions.map((a) => a.id)).toEqual(["a1"]);
    expect(await actionsPourLien(db, autre, orgId)).toBeNull();
    expect(await lierActionPlan(db, conseiller, c.valeur.id, "a9")).toEqual({ ok: false, erreur: "introuvable" });
    expect(await lierActionPlan(db, autre, c.valeur.id, "a1")).toEqual({ ok: false, erreur: "introuvable" });
    expect((await lierActionPlan(db, conseiller, c.valeur.id, "a1")).ok).toBe(true);
    expect((await campagnesDuPlan(db, plan.id)).get("a1")).toEqual([{ titre: "Kit charge", statut: "prevue", mois: 4, annee: 2027, diffuseeLe: null }]);
    expect((await lierActionPlan(db, conseiller, c.valeur.id, null)).ok).toBe(true);
    expect((await campagnesDuPlan(db, plan.id)).size).toBe(0);
  });
});
