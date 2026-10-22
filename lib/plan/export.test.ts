// Module A3, partie 2 : exports du plan (PDF, Excel) et fichier d'échange PluriPrev.
import { randomBytes } from "node:crypto";
import ExcelJS from "exceljs";
import { beforeAll, describe, expect, it } from "vitest";
import { creerEntreprise } from "../admin/entreprises";
import { preventionPlans, users } from "../db/schema";
import { creerBaseDeTest } from "../db/test-db";
import { pdfPlan } from "../pdf/plan";
import { creerRisque } from "../risques/registre";
import { planVide, type ContenuPlan } from "./contenu";
import { excelPlan } from "./excel";
import { construireEchange, donneesPlan, schemaEchange } from "./export";
import { majAvancement } from "./suivi";

beforeAll(() => {
  process.env.AUTH_SECRET = randomBytes(32).toString("base64");
});

async function preparer() {
  const { db } = await creerBaseDeTest();
  const [admin] = await db
    .insert(users)
    .values({ email: "admin@ima.test", name: "Admin", role: "admin", passwordHash: "x", aiLiteracyAt: "2026-10-01" })
    .returning();
  const org = await creerEntreprise(db, admin.id, { name: "Clinique Fictive Dupont", country: "BE", locale: "fr", sector: "Soins", sizeBand: "50-249" });
  if (!org.ok) throw new Error(org.erreur);
  const r1 = await creerRisque(db, admin, org.valeur.id, { titre: "Charge de travail en soirée", p: 6, e: 6, g: 15, niveau: "travail" });
  const r2 = await creerRisque(db, admin, org.valeur.id, { titre: "Déménagement du service", p: 1, e: 1, g: 3 });
  if (!r1.ok || !r2.ok) throw new Error("risques");
  const contenu: ContenuPlan = {
    ...planVide(),
    rappel_risques: "Rappel fictif.",
    cadre_legal: "Cadre fictif.",
    objectifs: [{ niveau: "travail", objectif: "Réguler la charge", risques: [r1.valeur.id] }],
    actions: [
      { id: "A1", titre: "Renfort en soirée", description: "", risques: [r1.valeur.id], niveau_prevention: "primaire", responsable: "Direction", trimestre: 1, effort: "important", budget: "à chiffrer", indicateur: "Effectif du soir" },
      { id: "A2", titre: "Information du personnel", description: "", risques: [r2.valeur.id], niveau_prevention: "secondaire", responsable: "RH", trimestre: 2, effort: "simple", budget: "temps interne", indicateur: "Réunion tenue" },
    ],
    questions_pour_le_praticien: ["QUESTION INTERNE IMA"],
  };
  const [plan] = await db
    .insert(preventionPlans)
    .values({ organizationId: org.valeur.id, status: "validated", country: "BE", language: "fr", startYear: 2027, content: contenu, aiModel: "claude-sonnet-5-5", validatedBy: admin.id, validatedAt: new Date("2027-01-05T10:00:00Z") })
    .returning();
  expect((await majAvancement(db, admin, plan.id, "A2", { statut: "realisee", realiseeLe: "2027-04-10" }, new Date("2027-05-01"))).ok).toBe(true);
  return { db, plan, r1: r1.valeur.id };
}

describe("Fichier d'échange PluriPrev", () => {
  it("respecte le format publié, sans nom ni question interne, avec les correspondances PluriPrev", async () => {
    const { db, plan, r1 } = await preparer();
    const e = construireEchange((await donneesPlan(db, plan.id))!, new Date("2027-05-02T10:00:00Z"));
    expect(schemaEchange.safeParse(e).success).toBe(true);
    const texte = JSON.stringify(e);
    expect(texte).not.toContain("Dupont");
    expect(texte).not.toContain("QUESTION INTERNE");
    expect(e.organisation.pays).toBe("BE");
    expect(e.plan.redige_avec_ia).toBe(true);
    const risque = e.risques.find((r) => r.id === r1)!;
    expect(risque).toMatchObject({ methode: { code: "KINNEY", composantes: { P: 6, E: 6, G: 15 } }, score: 540, classe: "tres_eleve", priorite: "immediate" });
    const [a1, a2] = e.actions;
    expect(a1).toMatchObject({ cle_dedoublonnage: `inneros:${plan.id}:A1`, echeance: "2027-03-31", priorite: "immediate", statut: "a_faire", statut_pluriprev: "proposed" });
    expect(a2).toMatchObject({ echeance: "2027-06-30", priorite: "low", statut: "realisee", statut_pluriprev: "closed", realisee_le: "2027-04-10" });
  });
});

describe("PDF et Excel du plan", () => {
  it("produit un PDF et un classeur Excel avec le plan d'action et le registre", async () => {
    const { db, plan } = await preparer();
    const d = (await donneesPlan(db, plan.id))!;
    const pdf = await pdfPlan(d, "fr");
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    expect(pdf.length).toBeGreaterThan(5000);

    const classeur = new ExcelJS.Workbook();
    await classeur.xlsx.load((await excelPlan(d, "fr")) as unknown as ArrayBuffer);
    const [actions, registre] = classeur.worksheets;
    expect(actions.name).toBe("Plan d'action");
    expect(actions.rowCount).toBe(3); // en-tête + 2 actions
    expect(actions.getRow(3).getCell(11).value).toBe("Réalisée");
    expect(registre.rowCount).toBe(3);
    expect(JSON.stringify(actions.getSheetValues())).not.toContain("QUESTION INTERNE");
  }, 60000);
});
