// Module A2 : plan de prévention RPS (brouillon IA simulé, contrôles avant envoi, couverture des risques,
// validation par un praticien formé à l'IA, remplacement de version, accès du conseiller en prévention).
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { ajouterReferent } from "../admin/entreprises";
import { auditLog, instruments, organizations, preventionPlans, users } from "../db/schema";
import { creerBaseDeTest } from "../db/test-db";
import { enregistrerInstrument, lireInstrument } from "../instruments/chargement";
import { creerCampagneDemo } from "../resultats/demo";
import { creerRisque, designerConseillerPrevention, lireRegistre, propositions } from "../risques/registre";
import { verifierChargePlan, type ChargePlan } from "./charge-utile";
import { lireContenuPlan, planVide, risquesNonCouverts, type ContenuPlan } from "./contenu";
import { lirePrompt } from "../rapport/ia";
import { FICHIER_PROMPT_PLAN, creerPlanManuel, enregistrerPlan, genererPlanIA, lirePlans, planPourReferent, validerPlan } from "./plans";

beforeAll(() => {
  process.env.AUTH_SECRET = randomBytes(32).toString("base64");
});

const LISTE = { risques: true, fonctions: true, cadre: true, langage: true };

async function preparer({ rapportValide = true } = {}) {
  const { db } = await creerBaseDeTest();
  const [admin] = await db
    .insert(users)
    .values({ email: "admin@ima.test", name: "Admin", role: "admin", passwordHash: "x", aiLiteracyAt: "2026-10-01" })
    .returning();
  const lu = lireInstrument(JSON.parse(readFileSync("instruments/copsoq3/copsoq3-fr-2018-09-14.fr.json", "utf8")));
  if (!lu.ok) throw new Error("copsoq");
  await enregistrerInstrument(db, lu.fichier);
  const [copsoq] = await db.select().from(instruments).where(eq(instruments.version, "fr-2018-09-14"));
  const campagneId = await creerCampagneDemo(db, {
    adminId: admin.id,
    instrumentIds: [copsoq.id],
    pays: "FR",
    graine: 7,
    nom: "Usine Fictive Martin",
    rapportAccepteIlYaMois: rapportValide ? 0 : undefined,
    groupes: [
      { libelle: "Atelier", attendus: 30, repondants: 25 },
      { libelle: "Bureau", attendus: 14, repondants: 12 },
    ],
    maintenant: new Date("2026-11-10T10:00:00Z"),
  });
  const [ref] = await db.select().from(users).where(eq(users.role, "referent"));
  const orgId = ref.organizationId!;
  // Registre : un comportement signalé (très élevé), une échelle (importante), un risque manuel acceptable
  const liste = await propositions(db, admin, orgId, "fr");
  const comportement = liste.find((p) => p.source === "comportement")!;
  const charge = liste.find((p) => p.scaleId === "charge")!;
  const ids: string[] = [];
  for (const [p, g] of [[comportement, 40], [charge, 15]] as const) {
    const r = await creerRisque(db, admin, orgId, { titre: p.nom, p: 10, e: 6, g }, { campaignId: campagneId, instrumentId: p.instrumentId, scaleId: p.scaleId });
    if (!r.ok) throw new Error(r.erreur);
    ids.push(r.valeur.id);
  }
  const m = await creerRisque(db, admin, orgId, { titre: "Déménagement prévu", p: 1, e: 1, g: 3 });
  if (!m.ok) throw new Error(m.erreur);
  return { db, admin, orgId, campagneId, ids };
}

// Réponse simulée de l'IA : une action par référence reçue, au trimestre 1
function iaSimulee(recus: ChargePlan[] = []) {
  return async (charge: ChargePlan) => {
    recus.push(charge);
    const contenu: ContenuPlan = {
      ...planVide(),
      rappel_risques: "Résumé fictif.",
      cadre_legal: "Cadre fictif.",
      objectifs: [{ niveau: "organisation", objectif: "Objectif fictif", risques: ["R1", "R99"] }],
      actions: charge.risques.map((r, i) => ({
        id: "A1", // doublon volontaire : les identifiants doivent être rendus uniques
        titre: `Action ${i + 1}`,
        description: "Description",
        risques: [r.ref],
        niveau_prevention: "primaire" as const,
        responsable: "Direction",
        trimestre: 1,
        effort: "simple" as const,
        budget: "temps interne",
        indicateur: "indicateur",
      })),
    };
    return { ok: true as const, contenu, modele: "claude-sonnet-5-5", versionPrompt: "plan-v1.0", jetonsEntree: 1, jetonsSortie: 1 };
  };
}

describe("Prompts versionnés", () => {
  it("lit la version du prompt du rapport et du plan", () => {
    expect(lirePrompt().version).toMatch(/^rapport-v\d+\.\d+$/);
    expect(lirePrompt(FICHIER_PROMPT_PLAN).version).toBe("plan-v1.2");
  });
});

describe("Plan de prévention RPS", () => {
  it("exige un rapport validé", async () => {
    const { db, admin, orgId } = await preparer({ rapportValide: false });
    expect(await genererPlanIA(db, admin.id, orgId, "fr", 2027, iaSimulee())).toEqual({ ok: false, erreur: "planSansRapport" });
    expect(await creerPlanManuel(db, admin.id, orgId, "fr", 2027)).toEqual({ ok: false, erreur: "planSansRapport" });
  });

  it("envoie à l'IA le registre sans nom ni identifiant interne, et reconvertit les références", async () => {
    const { db, admin, orgId, ids } = await preparer();
    const recus: ChargePlan[] = [];
    const r = await genererPlanIA(db, admin.id, orgId, "fr", 2027, iaSimulee(recus));
    if (!r.ok) throw new Error(r.erreur);
    const envoye = JSON.stringify(recus[0]);
    expect(envoye).not.toContain("Martin");
    for (const id of ids) expect(envoye).not.toContain(id);
    expect(recus[0].risques.map((x) => x.ref)).toEqual(["R1", "R2", "R3"]);
    expect(recus[0].entreprise.pays).toBe("FR");

    const { brouillon } = await lirePlans(db, orgId);
    const contenu = lireContenuPlan(brouillon!.content)!;
    expect(brouillon!.status).toBe("ai_draft");
    expect(contenu.objectifs[0].risques).toEqual([ids[0]]); // R1 converti, R99 inconnu retiré
    expect(new Set(contenu.actions.map((a) => a.id)).size).toBe(contenu.actions.length);
    const [j] = await db.select().from(auditLog).where(eq(auditLog.action, "plan_ai_generated"));
    expect(j.details).toMatchObject({ modele: "claude-sonnet-5-5", prompt: "plan-v1.0" });
  });

  it("bloque l'envoi si le nom de l'entreprise ou une adresse apparaît", () => {
    const charge = {
      entreprise: { code_interne: "ORG-X", secteur: "Industrie", tranche_effectif: "50-249", pays: "FR", langue: "fr", annee_debut: 2027 },
      risques: [{ ref: "R1", titre: "Tensions à l'Usine Fictive Martin", description: "", origine: "manuel", niveau_mindset: null, groupes: [], p: 1, e: 1, g: 1, score: 1, classe: "acceptable", etat: "ouvert" }],
      rapport: { synthese: "voir rh@exemple.fr", priorites: [], orientations: [] },
    };
    expect(verifierChargePlan(charge, "Usine Fictive Martin")).toEqual([
      "le nom de l'entreprise apparaît dans le message",
      "adresse e-mail dans le message",
    ]);
  });

  it("bloque aussi une adresse postale, un groupe non présenté et un comportement rattaché à un groupe", () => {
    const risque = { ref: "R1", titre: "Risque", description: "", origine: "echelle", niveau_mindset: null, groupes: ["Atelier"], p: 1, e: 1, g: 1, score: 1, classe: "acceptable", etat: "ouvert" };
    const charge = (risques: object[], synthese = "") => ({
      entreprise: { code_interne: "ORG-X", secteur: "Industrie", tranche_effectif: "50-249", pays: "BE", langue: "fr", annee_debut: 2027 },
      risques,
      rapport: { synthese, priorites: [], orientations: [] },
    });
    const affichables = new Set(["Atelier"]);
    expect(verifierChargePlan(charge([risque]), "Usine Fictive", affichables)).toEqual([]);
    expect(verifierChargePlan(charge([risque], "Réunion au 12 rue de la Loi"), "Usine Fictive", affichables)).toContain("adresse postale dans le message");
    expect(verifierChargePlan(charge([{ ...risque, groupes: ["Équipe de nuit"] }]), "Usine Fictive", affichables)).toEqual(["groupe non présenté dans les résultats"]);
    expect(verifierChargePlan(charge([{ ...risque, origine: "comportement" }]), "Usine Fictive", affichables)).toEqual(["comportement indésirable rattaché à un groupe"]);
  });

  it("refuse la validation tant que les risques prioritaires n'ont pas d'action", async () => {
    const { db, admin, orgId, ids } = await preparer();
    const r = await creerPlanManuel(db, admin.id, orgId, "fr", 2027);
    if (!r.ok) throw new Error(r.erreur);
    const action = (risque: string, trimestre: number) => ({
      id: `a-${risque}`, titre: "Action", description: "", risques: [risque], niveau_prevention: "primaire" as const,
      responsable: "Direction", trimestre, effort: "simple" as const, budget: "", indicateur: "",
    });
    // Comportement (très élevé) seulement au trimestre 2, échelle sans action : refus
    let contenu = { ...planVide(), actions: [action(ids[0], 2)] };
    const refus = await validerPlan(db, admin.id, r.valeur.planId, { contenu, liste: LISTE });
    expect(refus).toMatchObject({ ok: false, erreur: "planRisquesNonCouverts" });
    const registre = (await lireRegistre(db, admin, orgId))!;
    expect(risquesNonCouverts(contenu, registre).map((x) => x.id).sort()).toEqual([...ids].sort());
    // Liste de contrôle incomplète : refus
    contenu = { ...planVide(), actions: [action(ids[0], 1), action(ids[1], 1)] };
    expect(await validerPlan(db, admin.id, r.valeur.planId, { contenu, liste: { ...LISTE, cadre: false } })).toMatchObject({ ok: false });
    // Tout est couvert (le risque acceptable n'a pas besoin d'action) : validé
    expect((await validerPlan(db, admin.id, r.valeur.planId, { contenu, liste: LISTE })).ok).toBe(true);
    expect((await enregistrerPlan(db, admin.id, r.valeur.planId, contenu))).toEqual({ ok: false, erreur: "planNonModifiable" });
  });

  it("exige la formation à l'IA du praticien, et remplace l'ancien plan validé par la nouvelle version", async () => {
    const { db, admin, orgId, ids } = await preparer();
    const action = (risque: string) => ({
      id: risque, titre: "Action", description: "", risques: [risque], niveau_prevention: "primaire" as const,
      responsable: "RH", trimestre: 1, effort: "moyen" as const, budget: "", indicateur: "",
    });
    const contenu = { ...planVide(), actions: ids.map(action) };
    const premier = await creerPlanManuel(db, admin.id, orgId, "fr", 2027);
    if (!premier.ok) throw new Error(premier.erreur);
    expect(await creerPlanManuel(db, admin.id, orgId, "fr", 2027)).toEqual({ ok: false, erreur: "planBrouillonExistant" });

    await db.update(users).set({ aiLiteracyAt: null }).where(eq(users.id, admin.id));
    expect(await validerPlan(db, admin.id, premier.valeur.planId, { contenu, liste: LISTE })).toEqual({ ok: false, erreur: "rapportFormationIARequise" });
    await db.update(users).set({ aiLiteracyAt: "2026-10-01" }).where(eq(users.id, admin.id));
    expect((await validerPlan(db, admin.id, premier.valeur.planId, { contenu, liste: LISTE })).ok).toBe(true);

    // Nouvelle version à partir du plan validé : même contenu, puis validation → l'ancien est « remplacé »
    const second = await creerPlanManuel(db, admin.id, orgId, "fr", 2028, true);
    if (!second.ok) throw new Error(second.erreur);
    const { valide, brouillon } = await lirePlans(db, orgId);
    expect(valide!.id).toBe(premier.valeur.planId);
    expect(lireContenuPlan(brouillon!.content)!.actions).toHaveLength(ids.length);
    expect((await validerPlan(db, admin.id, second.valeur.planId, { contenu, liste: LISTE })).ok).toBe(true);
    const tous = await db.select().from(preventionPlans).where(eq(preventionPlans.organizationId, orgId));
    expect(tous.map((p) => `${p.startYear}:${p.status}`).sort()).toEqual(["2027:replaced", "2028:validated"]);
    // La base refuse deux plans validés pour la même entreprise
    await expect(
      db.insert(preventionPlans).values({
        organizationId: orgId, status: "validated", country: "FR", language: "fr", startYear: 2029, content: contenu,
        validatedBy: admin.id, validatedAt: new Date(),
      }),
    ).rejects.toThrow();
  });

  it("montre au conseiller en prévention le seul plan validé de son entreprise", async () => {
    const { db, admin, orgId, ids } = await preparer();
    const r = await ajouterReferent(db, admin.id, orgId, { name: "Conseillère", email: "cp@entreprise.test" });
    if (!r.ok) throw new Error(r.erreur);
    const [cp0] = await db.select().from(users).where(eq(users.email, "cp@entreprise.test"));
    const p = await creerPlanManuel(db, admin.id, orgId, "fr", 2027);
    if (!p.ok) throw new Error(p.erreur);
    await designerConseillerPrevention(db, admin.id, orgId, cp0.id, true);
    const [cp] = await db.select().from(users).where(eq(users.id, cp0.id));
    expect(await planPourReferent(db, cp)).toBeNull(); // brouillon : invisible
    const contenu = { ...planVide(), actions: ids.map((id) => ({ id, titre: "A", description: "", risques: [id], niveau_prevention: "primaire" as const, responsable: "RH", trimestre: 1, effort: "moyen" as const, budget: "", indicateur: "" })) };
    await validerPlan(db, admin.id, p.valeur.planId, { contenu, liste: LISTE });
    expect((await planPourReferent(db, cp))!.id).toBe(p.valeur.planId);
    expect(await planPourReferent(db, cp0)).toBeNull(); // compte relu avant désignation
    const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
    expect(org).toBeDefined();
  });
});
