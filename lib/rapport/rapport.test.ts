// Étape 8A : message envoyé à l'IA, interrupteur IA, refus motivé, validation IMA (praticien formé).
// L'IA est simulée : aucun appel payant pendant les tests.
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { auditLog, campaigns, organizations, reports, users } from "../db/schema";
import { chargerQuestionnaireDeTest, creerBaseDeTest } from "../db/test-db";
import { creerCampagneDemo } from "../resultats/demo";
import { construireChargeUtile, verifierChargeUtile } from "./charge-utile";
import { contenuVide, type ContenuRapport } from "./contenu";
import type { AppelIA } from "./ia";
import {
  changerIACampagne,
  creerRapportManuel,
  enregistrerFormationIA,
  genererBrouillonIA,
  rapportCourant,
  refuserRapport,
  validerRapport,
} from "./rapports";

const LISTE_COMPLETE = { sources: true, seuil: true, langage: true, limites: true };
const BROUILLON: ContenuRapport = {
  ...contenuVide(),
  synthese: "Les répondants du groupe G1 rapportent des exigences quantitatives plus élevées que l'ensemble.",
  limites: ["Aucune référence nationale."],
};

beforeAll(() => {
  process.env.AUTH_SECRET = randomBytes(32).toString("base64");
  process.env.AI_DRAFTING_ENABLED = "true";
});

async function base() {
  const { db } = await creerBaseDeTest();
  const [admin] = await db
    .insert(users)
    .values({ email: "admin@ima.test", name: "Praticienne", role: "admin", passwordHash: "x", aiLiteracyAt: "2026-10-01" })
    .returning();
  const campagneId = await creerCampagneDemo(db, {
    adminId: admin.id,
    instrumentIds: [await chargerQuestionnaireDeTest(db, ["fr"])],
    groupes: [
      { libelle: "Soins", attendus: 30, repondants: 25 },
      { libelle: "Administration", attendus: 14, repondants: 12 },
      { libelle: "Logistique", attendus: 12, repondants: 9 },
    ],
    maintenant: new Date("2026-11-10T10:00:00Z"),
    nom: "Clinique Exemple",
  });
  const iaSimulee = vi.fn<AppelIA>(async () => ({
    ok: true as const,
    contenu: BROUILLON,
    modele: "claude-sonnet-5-5",
    versionPrompt: "rapport-v1.1",
    jetonsEntree: 1000,
    jetonsSortie: 500,
  }));
  return { db, admin, campagneId, iaSimulee };
}

describe("Message envoyé à l'IA", () => {
  it("ne contient que des résultats ≥ 10, aucun groupe masqué, ni le nom de l'entreprise", async () => {
    const { db, campagneId } = await base();
    const { charge, nomEntreprise, seuil } = await construireChargeUtile(db, campagneId, "fr");
    expect(verifierChargeUtile(charge, { nomEntreprise, seuil })).toEqual([]);
    expect(charge.resultats.every((r) => r.n >= 10)).toBe(true);
    const texte = JSON.stringify(charge);
    expect(texte).not.toContain("Logistique"); // groupe de 9
    expect(texte).not.toContain("Administration"); // masqué contre la soustraction
    expect(texte).not.toContain("Clinique Exemple");
    expect(charge.mandat.code_interne).toMatch(/\S/);
  });

  it("bloque l'envoi si le nom de l'entreprise s'y trouve, sans appeler l'IA", async () => {
    const { db, admin, campagneId, iaSimulee } = await base();
    await db.update(campaigns).set({ diagnosticQuestion: "Comment va le personnel de la clinique exemple ?" }).where(eq(campaigns.id, campagneId));
    const r = await genererBrouillonIA(db, admin.id, campagneId, "fr", iaSimulee);
    expect(r).toMatchObject({ ok: false, erreur: "iaEnvoiBloque" });
    expect(iaSimulee).not.toHaveBeenCalled();
  });

  it("refuse un message au format inattendu ou sous le seuil", () => {
    expect(verifierChargeUtile({ autre: 1 }, { nomEntreprise: "X", seuil: 10 })).toEqual(["format du message non conforme"]);
  });
});

describe("Brouillon IA", () => {
  it("enregistre le brouillon avec le modèle et la version du prompt, et le journalise sans contenu", async () => {
    const { db, admin, campagneId, iaSimulee } = await base();
    const r = await genererBrouillonIA(db, admin.id, campagneId, "fr", iaSimulee);
    expect(r.ok).toBe(true);
    const rapport = await rapportCourant(db, campagneId);
    expect(rapport).toMatchObject({ status: "ai_draft", aiModel: "claude-sonnet-5-5", aiPromptVersion: "rapport-v1.1", language: "fr" });
    const [entree] = await db.select().from(auditLog).where(eq(auditLog.action, "report_ai_generated"));
    expect(JSON.stringify(entree.details)).not.toContain("exigences");
  });

  it("une réponse de l'IA au mauvais format ne crée aucun rapport", async () => {
    const { db, admin, campagneId } = await base();
    const r = await genererBrouillonIA(db, admin.id, campagneId, "fr", async () => ({ ok: false, erreur: "iaFormat" }));
    expect(r).toMatchObject({ ok: false, erreur: "iaFormat" });
    expect(await rapportCourant(db, campagneId)).toBeNull();
  });

  it("interrupteur IA coupé : aucun appel, mais un rapport complet reste possible à la main", async () => {
    const { db, admin, campagneId, iaSimulee } = await base();
    await changerIACampagne(db, admin.id, campagneId, false);
    expect(await genererBrouillonIA(db, admin.id, campagneId, "fr", iaSimulee)).toMatchObject({ ok: false, erreur: "iaDesactivee" });
    expect(iaSimulee).not.toHaveBeenCalled();
    const manuel = await creerRapportManuel(db, admin.id, campagneId, "fr");
    if (!manuel.ok) throw new Error(manuel.erreur);
    const contenu = { ...contenuVide(), synthese: "Rapport rédigé à la main." };
    expect((await validerRapport(db, admin.id, manuel.valeur.reportId, { contenu, liste: LISTE_COMPLETE })).ok).toBe(true);
    expect((await rapportCourant(db, campagneId))?.aiModel).toBeNull();
  });
});

describe("Refus et validation", () => {
  it("un refus doit être motivé", async () => {
    const { db, admin, campagneId, iaSimulee } = await base();
    const g = await genererBrouillonIA(db, admin.id, campagneId, "fr", iaSimulee);
    if (!g.ok) throw new Error(g.erreur);
    expect(await refuserRapport(db, admin.id, g.valeur.reportId, " ")).toMatchObject({ ok: false, erreur: "rapportMotifRequis" });
    expect((await refuserRapport(db, admin.id, g.valeur.reportId, "Constats trop affirmatifs")).ok).toBe(true);
    const [r] = await db.select().from(reports).where(eq(reports.id, g.valeur.reportId));
    expect(r).toMatchObject({ status: "rejected", rejectionReason: "Constats trop affirmatifs" });
  });

  it("la validation exige la liste de contrôle complète et un praticien formé à l'IA", async () => {
    const { db, admin, campagneId, iaSimulee } = await base();
    const g = await genererBrouillonIA(db, admin.id, campagneId, "fr", iaSimulee);
    if (!g.ok) throw new Error(g.erreur);
    const id = g.valeur.reportId;
    expect(await validerRapport(db, admin.id, id, { contenu: BROUILLON, liste: { ...LISTE_COMPLETE, limites: false } })).toMatchObject({
      ok: false,
      erreur: "rapportListeIncomplete",
    });

    // Praticien sans formation enregistrée : refusé
    const [nonForme] = await db.insert(users).values({ email: "b@ima.test", name: "B", role: "admin", passwordHash: "x" }).returning();
    expect(await validerRapport(db, nonForme.id, id, { contenu: BROUILLON, liste: LISTE_COMPLETE })).toMatchObject({
      ok: false,
      erreur: "rapportFormationIARequise",
    });
    // Après enregistrement de sa formation : accepté
    expect((await enregistrerFormationIA(db, nonForme.id, { date: "2026-10-10", note: "Formation interne IMA, 3 h" })).ok).toBe(true);
    expect((await validerRapport(db, nonForme.id, id, { contenu: BROUILLON, liste: LISTE_COMPLETE })).ok).toBe(true);

    // Un rapport validé n'est plus modifiable
    expect(await validerRapport(db, admin.id, id, { contenu: BROUILLON, liste: LISTE_COMPLETE })).toMatchObject({
      ok: false,
      erreur: "rapportNonModifiable",
    });
    const [org] = await db.select().from(organizations);
    expect(org.name).toBe("Clinique Exemple");
  });
});
