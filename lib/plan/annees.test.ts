// Module A3, partie 3 : plan d'action des années suivantes (même plan global sur 5 ans), reprise des actions
// non terminées et de leur avancement, nouvelle version de la même année, fin des 5 ans.
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { campaigns, instruments, planActionStatus, preventionPlans, reports, users } from "../db/schema";
import { creerBaseDeTest } from "../db/test-db";
import { enregistrerInstrument, lireInstrument } from "../instruments/chargement";
import { contenuVide } from "../rapport/contenu";
import { creerCampagneDemo } from "../resultats/demo";
import { creerRisque } from "../risques/registre";
import type { ChargePlan } from "./charge-utile";
import { planVide, type ContenuPlan } from "./contenu";
import { construireEchange, donneesPlan } from "./export";
import { creerPlanManuel, genererPlanIA, lirePlans, validerPlan } from "./plans";
import { majAvancement } from "./suivi";

beforeAll(() => {
  process.env.AUTH_SECRET = randomBytes(32).toString("base64");
});

const LISTE = { risques: true, fonctions: true, cadre: true, langage: true };
const action = (id: string, risques: string[], trimestre = 2) => ({
  id, titre: `Action ${id}`, description: "", risques, niveau_prevention: "primaire" as const,
  responsable: "RH", trimestre, effort: "simple" as const, budget: "", indicateur: "",
});

async function preparer(actionYear = 2027) {
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
    adminId: admin.id, instrumentIds: [copsoq.id], pays: "FR", graine: 3,
    groupes: [{ libelle: "Atelier", attendus: 14, repondants: 12 }],
    maintenant: new Date("2026-11-10T10:00:00Z"),
  });
  const [campagne] = await db.select().from(campaigns).where(eq(campaigns.id, campagneId));
  const orgId = campagne.organizationId;
  const [rapport] = await db
    .insert(reports)
    .values({
      campaignId: campagneId, status: "validated", finalText: JSON.stringify(contenuVide()), validatedBy: admin.id, validatedAt: new Date(),
      checkSourcesVerified: true, checkNoSmallGroup: true, checkLanguageRule: true, checkLimitsMentioned: true,
    })
    .returning();
  // Un risque « possible » (sans obligation d'action) pour que la validation ne dépende que des actions
  const r = await creerRisque(db, admin, orgId, { titre: "Charge en fin de mois", p: 3, e: 2, g: 7 });
  if (!r.ok) throw new Error(r.erreur);
  const contenu: ContenuPlan = {
    ...planVide(),
    objectifs: [{ niveau: "travail", objectif: "Réguler la charge", risques: [r.valeur.id] }],
    actions: [action("A", [r.valeur.id]), action("B", [r.valeur.id]), action("C", [r.valeur.id]), action("D", [])],
  };
  const [plan] = await db
    .insert(preventionPlans)
    .values({ organizationId: orgId, status: "validated", country: "FR", language: "fr", startYear: 2027, actionYear, content: contenu, reportId: rapport.id, validatedBy: admin.id, validatedAt: new Date() })
    .returning();
  const t = new Date(`${actionYear}-12-01T10:00:00Z`);
  for (const [id, statut] of [["A", "realisee"], ["B", "en_cours"], ["D", "abandonnee"]] as const)
    expect((await majAvancement(db, admin, plan.id, id, { statut, realiseeLe: statut === "realisee" ? `${actionYear}-06-01` : "" }, t)).ok).toBe(true);
  return { db, admin, orgId, plan, risque: r.valeur.id };
}

const statutsDe = async (db: Awaited<ReturnType<typeof preparer>>["db"], planId: string) =>
  Object.fromEntries((await db.select().from(planActionStatus).where(eq(planActionStatus.planId, planId))).map((s) => [s.actionId, s.status]));

describe("Plan d'action de l'année suivante", () => {
  it("à la main : reprend les actions non terminées au 1er trimestre, puis leur avancement à la validation", async () => {
    const { db, admin, orgId, plan } = await preparer();
    const r = await creerPlanManuel(db, admin.id, orgId, "fr", null, "suite");
    if (!r.ok) throw new Error(r.erreur);
    const { brouillon } = await lirePlans(db, orgId);
    expect([brouillon!.startYear, brouillon!.actionYear]).toEqual([2027, 2028]);
    const contenu = brouillon!.content as ContenuPlan;
    expect(contenu.actions.map((a) => `${a.id}:T${a.trimestre}`)).toEqual(["B:T1", "C:T1"]); // A réalisée, D abandonnée
    expect(contenu.objectifs).toHaveLength(1); // plan global repris

    expect((await validerPlan(db, admin.id, brouillon!.id, { contenu, liste: LISTE })).ok).toBe(true);
    expect(await statutsDe(db, brouillon!.id)).toEqual({ B: "en_cours" });
    const [ancien] = await db.select().from(preventionPlans).where(eq(preventionPlans.id, plan.id));
    expect(ancien.status).toBe("replaced");
    // Exports : échéances de l'année du plan d'action
    const e = construireEchange((await donneesPlan(db, brouillon!.id))!);
    expect([e.plan.annee_debut, e.plan.annee_plan_action, e.actions[0].echeance]).toEqual([2027, 2028, "2028-03-31"]);
  });

  it("nouvelle version de la même année : même année de plan d'action, tout l'avancement repris", async () => {
    const { db, admin, orgId } = await preparer();
    const r = await creerPlanManuel(db, admin.id, orgId, "fr", null, "version");
    if (!r.ok) throw new Error(r.erreur);
    const { brouillon } = await lirePlans(db, orgId);
    expect(brouillon!.actionYear).toBe(2027);
    expect((await validerPlan(db, admin.id, brouillon!.id, { contenu: brouillon!.content, liste: LISTE })).ok).toBe(true);
    expect(await statutsDe(db, brouillon!.id)).toEqual({ A: "realisee", B: "en_cours", D: "abandonnee" });
  });

  it("avec l'IA : envoie le plan en vigueur et l'avancement, sans identifiant interne de risque", async () => {
    const { db, admin, orgId, risque } = await preparer();
    const recus: ChargePlan[] = [];
    const ia = async (charge: ChargePlan) => {
      recus.push(charge);
      const contenu: ContenuPlan = { ...planVide(), actions: [{ ...action("B", ["R1"], 1) }, { ...action("N1", ["R1"], 3) }] };
      return { ok: true as const, contenu, modele: "claude-sonnet-5-5", versionPrompt: "plan-v1.3", jetonsEntree: 1, jetonsSortie: 1 };
    };
    const r = await genererPlanIA(db, admin.id, orgId, "fr", null, ia, "suite");
    if (!r.ok) throw new Error(r.erreur);
    const c = recus[0];
    expect([c.entreprise.annee_debut, c.entreprise.annee_plan_action, c.suite!.annee_precedente]).toEqual([2027, 2028, 2027]);
    expect(c.suite!.plan_en_vigueur.actions.map((a) => `${a.id}:${a.etat}`)).toEqual(["A:realisee", "B:en_cours", "C:a_faire", "D:abandonnee"]);
    expect(c.suite!.plan_en_vigueur.objectifs[0].risques).toEqual(["R1"]);
    expect(JSON.stringify(c)).not.toContain(risque);
    const { brouillon } = await lirePlans(db, orgId);
    expect(brouillon!.actionYear).toBe(2028);
    expect((brouillon!.content as ContenuPlan).actions[0].risques).toEqual([risque]);
  });

  it("refuse une 6e année : il faut un nouveau plan global", async () => {
    const { db, admin, orgId } = await preparer(2031);
    expect(await creerPlanManuel(db, admin.id, orgId, "fr", null, "suite")).toEqual({ ok: false, erreur: "planDerniereAnnee" });
    // La base refuse aussi une année de plan d'action hors des 5 ans
    await expect(
      db.update(preventionPlans).set({ actionYear: 2032 }).where(and(eq(preventionPlans.organizationId, orgId), eq(preventionPlans.status, "validated"))),
    ).rejects.toThrow();
  });
});
