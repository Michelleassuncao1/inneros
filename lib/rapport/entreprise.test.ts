// Étape 8B : signataire, visibilité côté entreprise, acceptation, demande de correction, notifications.
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { choisirReferents } from "../admin/campagnes";
import { ajouterReferent, creerEntreprise } from "../admin/entreprises";
import { campaignReferents, campaigns, reports, users } from "../db/schema";
import { chargerQuestionnaireDeTest, creerBaseDeTest } from "../db/test-db";
import type { Email } from "../email/brevo";
import { creerCampagneDemo } from "../resultats/demo";
import { contenuVide } from "./contenu";
import { accepterRapport, demanderCorrection, designerSignataire, rapportPourReferent } from "./entreprise";
import { notifierRapportDisponible } from "./notifications";
import { creerRapportManuel, validerRapport } from "./rapports";

const LISTE = { sources: true, seuil: true, langage: true, limites: true };
const CONTENU = { ...contenuVide(), synthese: "Synthèse confidentielle du rapport de test." };

beforeAll(() => {
  process.env.AUTH_SECRET = randomBytes(32).toString("base64");
});

async function base() {
  const { db } = await creerBaseDeTest();
  const [admin] = await db
    .insert(users)
    .values({ email: "praticienne@ima.test", name: "Praticienne", role: "admin", passwordHash: "x", aiLiteracyAt: "2026-10-01" })
    .returning();
  const campagneId = await creerCampagneDemo(db, {
    adminId: admin.id,
    instrumentIds: [await chargerQuestionnaireDeTest(db, ["fr"])],
    groupes: [{ libelle: "Soins", attendus: 15, repondants: 12 }],
    maintenant: new Date("2026-11-10T10:00:00Z"),
  });
  const [campagne] = await db.select().from(campaigns).where(eq(campaigns.id, campagneId));
  const [{ userId: signataire }] = await db.select().from(campaignReferents).where(eq(campaignReferents.campaignId, campagneId));
  const r = await ajouterReferent(db, admin.id, campagne.organizationId, { name: "Autre référent", email: "autre@client.test" });
  if (!r.ok) throw new Error(r.erreur);
  const [autre] = await db.select().from(users).where(eq(users.email, "autre@client.test"));
  await choisirReferents(db, admin.id, campagneId, [signataire, autre.id]);

  const envoyes: Email[] = [];
  const envoi = async (e: Email) => {
    envoyes.push(e);
  };
  const manuel = await creerRapportManuel(db, admin.id, campagneId, "fr");
  if (!manuel.ok) throw new Error(manuel.erreur);
  const valider = () =>
    validerRapport(db, admin.id, manuel.valeur.reportId, { contenu: CONTENU, liste: LISTE }, new Date(), (d, id) => notifierRapportDisponible(d, id, envoi));
  // Référent d'une autre entreprise, sans accès à cette campagne
  const externe = async (email: string) => {
    const o = await creerEntreprise(db, admin.id, { name: `Autre ${email}`, country: "BE", locale: "fr", sector: "Services", sizeBand: "50-249" });
    if (!o.ok) throw new Error(o.erreur);
    const a = await ajouterReferent(db, admin.id, o.valeur.id, { name: "Externe", email });
    if (!a.ok) throw new Error(a.erreur);
    return (await db.select().from(users).where(eq(users.email, email)))[0];
  };
  return { db, admin, campagneId, signataire, autre: autre.id, reportId: manuel.valeur.reportId, envoyes, envoi, valider, externe };
}

describe("Signataire", () => {
  it("doit être un référent ayant accès à la campagne", async () => {
    const { db, admin, campagneId, signataire, externe } = await base();
    const x = await externe("x@ailleurs.test");
    expect(await designerSignataire(db, admin.id, campagneId, x.id)).toMatchObject({ ok: false, erreur: "signataireSansAcces" });
    expect((await designerSignataire(db, admin.id, campagneId, signataire)).ok).toBe(true);
  });
});

describe("Visibilité pour l'entreprise", () => {
  it("aucun référent ne voit le rapport avant la validation IMA ; ensuite tous sont prévenus, sans contenu", async () => {
    const { db, campagneId, signataire, autre, envoyes, valider } = await base();
    expect(await rapportPourReferent(db, autre, campagneId)).toMatchObject({ etat: "indisponible", rapport: null });

    expect((await valider()).ok).toBe(true);
    const vue = await rapportPourReferent(db, autre, campagneId);
    expect(vue?.etat).toBe("disponible");
    expect(vue?.rapport?.finalText).toContain("Synthèse confidentielle");
    // Un e-mail par référent, sans le contenu du rapport
    expect(envoyes.map((e) => e.to.email).sort()).toHaveLength(2);
    expect(envoyes.every((e) => !e.html.includes("confidentielle") && !e.text.includes("confidentielle"))).toBe(true);
    expect((await rapportPourReferent(db, signataire, campagneId))?.etat).toBe("disponible");
  });

  it("un référent sans accès à la campagne ne voit rien", async () => {
    const { db, campagneId, valider, externe } = await base();
    await valider();
    const y = await externe("y@ailleurs.test");
    expect(await rapportPourReferent(db, y.id, campagneId)).toBeNull();
  });
});

describe("Acceptation et correction", () => {
  it("seul le signataire accepte, après les deux vérifications ; le rapport est alors figé", async () => {
    const { db, admin, campagneId, signataire, autre, reportId, envoyes, envoi, valider } = await base();
    await designerSignataire(db, admin.id, campagneId, signataire);
    await valider();
    expect(await accepterRapport(db, autre, reportId, { perimetre: true, effectifs: true }, new Date(), envoi)).toMatchObject({
      ok: false,
      erreur: "signataireRequis",
    });
    expect(await accepterRapport(db, signataire, reportId, { perimetre: true, effectifs: false }, new Date(), envoi)).toMatchObject({
      ok: false,
      erreur: "acceptationIncomplete",
    });
    expect((await accepterRapport(db, signataire, reportId, { perimetre: true, effectifs: true }, new Date(), envoi)).ok).toBe(true);
    const [r] = await db.select().from(reports).where(eq(reports.id, reportId));
    expect(r.acceptedBy).toBe(signataire);
    // IMA est prévenu ; le rapport accepté n'est plus modifiable
    expect(envoyes.some((e) => e.to.email === "praticienne@ima.test")).toBe(true);
    expect(await validerRapport(db, admin.id, reportId, { contenu: CONTENU, liste: LISTE })).toMatchObject({ ok: false, erreur: "rapportNonModifiable" });
  });

  it("demande de correction motivée : retour chez IMA, nouvelle validation, puis acceptation", async () => {
    const { db, admin, campagneId, signataire, autre, reportId, envoi, valider } = await base();
    await designerSignataire(db, admin.id, campagneId, signataire);
    await valider();
    expect(await demanderCorrection(db, signataire, reportId, "court", new Date(), envoi)).toMatchObject({ ok: false, erreur: "correctionMotifRequis" });
    expect((await demanderCorrection(db, signataire, reportId, "Le groupe Soins compte 15 personnes et non 12 au contrat.", new Date(), envoi)).ok).toBe(true);

    // Pendant la correction, le contenu n'est plus montré aux référents
    expect(await rapportPourReferent(db, autre, campagneId)).toMatchObject({ etat: "enCorrection", rapport: null });

    // IMA corrige et valide à nouveau ; la demande est effacée du rapport
    expect((await valider()).ok).toBe(true);
    const [r] = await db.select().from(reports).where(eq(reports.id, reportId));
    expect(r).toMatchObject({ status: "validated", correctionComment: null });
    expect((await accepterRapport(db, signataire, reportId, { perimetre: true, effectifs: true }, new Date(), envoi)).ok).toBe(true);
  });

  it("une panne d'envoi d'e-mail ne bloque pas l'acceptation", async () => {
    const { db, admin, campagneId, signataire, reportId, valider } = await base();
    await designerSignataire(db, admin.id, campagneId, signataire);
    await valider();
    const panne = async () => {
      throw new Error("service e-mail indisponible");
    };
    expect((await accepterRapport(db, signataire, reportId, { perimetre: true, effectifs: true }, new Date(), panne)).ok).toBe(true);
  });
});

describe("PDF du rapport", () => {
  it("se génère au format PDF, sans les questions internes pour le praticien", async () => {
    const { contenuPdfRapport } = await import("../pdf/contenu-rapport");
    const { pdfRapport } = await import("../pdf/rapport");
    const { db, admin, reportId, campagneId } = await base();
    const contenu = { ...CONTENU, questions_pour_le_praticien: ["Question interne à ne pas diffuser"] };
    expect((await validerRapport(db, admin.id, reportId, { contenu, liste: LISTE }, new Date(), async () => {})).ok).toBe(true);
    const c = await contenuPdfRapport(db, campagneId);
    expect(c).not.toBeNull();
    expect(JSON.stringify(c)).not.toContain("Question interne");
    expect(c!.brouillon).toBeUndefined();
    const pdf = await pdfRapport(c!);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  });
});
