// Module A3 : délégation au conseiller en prévention, adoption du plan, avancement des actions,
// tableau de bord et rappel trimestriel.
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { ajouterReferent } from "../admin/entreprises";
import { campaignReferents, campaigns, instruments, planActionStatus, preventionPlans, reports, users } from "../db/schema";
import { creerBaseDeTest } from "../db/test-db";
import type { Email } from "../email/brevo";
import { enregistrerInstrument, lireInstrument } from "../instruments/chargement";
import { contenuVide } from "../rapport/contenu";
import { accepterRapport, definirDelegation, designerSignataire } from "../rapport/entreprise";
import { creerCampagneDemo } from "../resultats/demo";
import { designerConseillerPrevention } from "../risques/registre";
import { planVide, type ContenuPlan } from "./contenu";
import { adopterPlan, envoyerRappelsTrimestriels, finTrimestre, majAvancement, planPourReferentSuivi, tableauDeBord } from "./suivi";

beforeAll(() => {
  process.env.AUTH_SECRET = randomBytes(32).toString("base64");
});

const action = (id: string, trimestre: number) => ({
  id, titre: `Action ${id}`, description: "", risques: [], niveau_prevention: "primaire" as const,
  responsable: "Direction", trimestre, effort: "simple" as const, budget: "", indicateur: "",
});

async function preparer() {
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
  const [signataire] = await db.select().from(users).where(eq(users.organizationId, orgId));
  expect((await designerSignataire(db, admin.id, campagneId, signataire.id)).ok).toBe(true);
  // Conseiller en prévention ayant accès à la campagne
  const r = await ajouterReferent(db, admin.id, orgId, { name: "Conseillère", email: "cp@entreprise.test" });
  if (!r.ok) throw new Error(r.erreur);
  const [cp0] = await db.select().from(users).where(eq(users.email, "cp@entreprise.test"));
  await db.insert(campaignReferents).values({ campaignId: campagneId, userId: cp0.id });
  await designerConseillerPrevention(db, admin.id, orgId, cp0.id, true);
  const [conseiller] = await db.select().from(users).where(eq(users.id, cp0.id));
  // Rapport validé (pas encore accepté) et plan validé qui s'y rattache
  const [rapport] = await db
    .insert(reports)
    .values({
      campaignId: campagneId, status: "validated", finalText: JSON.stringify(contenuVide()), validatedBy: admin.id, validatedAt: new Date(),
      checkSourcesVerified: true, checkNoSmallGroup: true, checkLanguageRule: true, checkLimitsMentioned: true,
    })
    .returning();
  const contenu: ContenuPlan = { ...planVide(), actions: [action("a1", 1), action("a2", 3)] };
  const [plan] = await db
    .insert(preventionPlans)
    .values({ organizationId: orgId, status: "validated", country: "FR", language: "fr", startYear: 2027, actionYear: 2027, content: contenu, reportId: rapport.id, validatedBy: admin.id, validatedAt: new Date() })
    .returning();
  const relire = async (id: string) => (await db.select().from(users).where(eq(users.id, id)))[0];
  return { db, admin, campagneId, orgId, signataire: await relire(signataire.id), conseiller, rapport, plan };
}

describe("Délégation au conseiller en prévention", () => {
  it("permet au conseiller d'accepter le rapport seulement si le signataire a coché la délégation", async () => {
    const { db, campagneId, signataire, conseiller, rapport } = await preparer();
    const liste = { perimetre: true, effectifs: true };
    const sansEnvoi = async () => undefined;
    expect(await accepterRapport(db, conseiller.id, rapport.id, liste, new Date(), sansEnvoi)).toEqual({ ok: false, erreur: "signataireRequis" });
    // Seul le signataire coche la case
    expect(await definirDelegation(db, conseiller.id, campagneId, true)).toEqual({ ok: false, erreur: "signataireRequis" });
    expect((await definirDelegation(db, signataire.id, campagneId, true)).ok).toBe(true);
    expect((await accepterRapport(db, conseiller.id, rapport.id, liste, new Date(), sansEnvoi)).ok).toBe(true);
    const [r] = await db.select().from(reports).where(eq(reports.id, rapport.id));
    expect(r.acceptedBy).toBe(conseiller.id);
  });

  it("la base refuse une acceptation par un référent non habilité", async () => {
    const { db, conseiller, rapport } = await preparer();
    await expect(db.update(reports).set({ acceptedBy: conseiller.id, acceptedAt: new Date() }).where(eq(reports.id, rapport.id))).rejects.toThrow();
  });
});

describe("Adoption du plan", () => {
  it("est enregistrée par le signataire, avec l'organe du pays et des dates cohérentes, une seule fois", async () => {
    const { db, signataire, conseiller, plan } = await preparer();
    const maintenant = new Date("2027-01-20T10:00:00Z");
    expect((await planPourReferentSuivi(db, signataire))!.peutAdopter).toBe(true);
    expect((await planPourReferentSuivi(db, conseiller))!.peutAdopter).toBe(false);
    expect(await adopterPlan(db, conseiller, plan.id, { adopteLe: "2027-01-15", organe: "cse", avisLe: "2027-01-10" }, maintenant)).toEqual({ ok: false, erreur: "signataireRequis" });
    expect(await adopterPlan(db, signataire, plan.id, { adopteLe: "2027-01-15", organe: "cppt", avisLe: "2027-01-10" }, maintenant)).toEqual({ ok: false, erreur: "saisieInvalide" }); // organe belge pour une entreprise française
    expect(await adopterPlan(db, signataire, plan.id, { adopteLe: "2027-01-15", organe: "cse", avisLe: "2027-01-16" }, maintenant)).toEqual({ ok: false, erreur: "adoptionDates" });
    expect(await adopterPlan(db, signataire, plan.id, { adopteLe: "2027-02-15", organe: "cse", avisLe: "2027-01-10" }, maintenant)).toEqual({ ok: false, erreur: "adoptionDates" });
    expect((await adopterPlan(db, signataire, plan.id, { adopteLe: "2027-01-15", organe: "cse", avisLe: "2027-01-10" }, maintenant)).ok).toBe(true);
    expect(await adopterPlan(db, signataire, plan.id, { adopteLe: "2027-01-15", organe: "cse", avisLe: "2027-01-10" }, maintenant)).toEqual({ ok: false, erreur: "planDejaAdopte" });
    const [p] = await db.select().from(preventionPlans).where(eq(preventionPlans.id, plan.id));
    expect([p.adoptedBy, p.adoptedAt, p.consultationBody, p.consultationDate]).toEqual([signataire.id, "2027-01-15", "cse", "2027-01-10"]);
  });

  it("peut être faite par le conseiller en prévention par délégation ; « pas de CSE » sans date d'avis", async () => {
    const { db, campagneId, signataire, conseiller, plan } = await preparer();
    await definirDelegation(db, signataire.id, campagneId, true);
    expect((await planPourReferentSuivi(db, conseiller))!.peutAdopter).toBe(true);
    expect((await adopterPlan(db, conseiller, plan.id, { adopteLe: "2027-01-15", organe: "aucun_cse", avisLe: "" }, new Date("2027-01-20"))).ok).toBe(true);
  });

  it("la base refuse une adoption par un référent non habilité", async () => {
    const { db, conseiller, plan } = await preparer();
    await expect(db.update(preventionPlans).set({ adoptedBy: conseiller.id, adoptedAt: "2027-01-15" }).where(eq(preventionPlans.id, plan.id))).rejects.toThrow();
  });
});

describe("Avancement des actions", () => {
  it("est mis à jour par le conseiller en prévention ou IMA, jamais par un autre référent", async () => {
    const { db, admin, signataire, conseiller, plan } = await preparer();
    const maintenant = new Date("2027-05-02T10:00:00Z");
    expect((await majAvancement(db, conseiller, plan.id, "a1", { statut: "realisee", realiseeLe: "2027-03-20", commentaire: "Procédure diffusée" }, maintenant)).ok).toBe(true);
    expect((await majAvancement(db, admin, plan.id, "a2", { statut: "en_cours" }, maintenant)).ok).toBe(true);
    expect(await majAvancement(db, signataire, plan.id, "a2", { statut: "realisee" }, maintenant)).toEqual({ ok: false, erreur: "introuvable" });
    expect(await majAvancement(db, conseiller, plan.id, "inconnue", { statut: "realisee" }, maintenant)).toEqual({ ok: false, erreur: "introuvable" });
    expect(await majAvancement(db, conseiller, plan.id, "a2", { statut: "en_cours", commentaire: "voir jean@exemple.fr" }, maintenant)).toEqual({ ok: false, erreur: "risqueCoordonnees" });
    await expect(db.insert(planActionStatus).values({ planId: plan.id, actionId: "a2", status: "realisee", updatedBy: signataire.id })).rejects.toThrow();
    const lignes = await db.select().from(planActionStatus).where(eq(planActionStatus.planId, plan.id));
    expect(lignes.map((l) => `${l.actionId}:${l.status}:${l.doneOn}`).sort()).toEqual(["a1:realisee:2027-03-20", "a2:en_cours:null"]);
  });

  it("calcule le tableau de bord : réalisées, retards, trimestres", () => {
    const contenu: ContenuPlan = { ...planVide(), actions: [action("a1", 1), action("a2", 1), action("a3", 3), action("a4", 2)] };
    expect(finTrimestre(2027, 1)).toBe("2027-03-31");
    expect(finTrimestre(2027, 4)).toBe("2027-12-31");
    const bord = tableauDeBord(contenu, 2027, new Map([["a1", { status: "realisee" as const }], ["a4", { status: "abandonnee" as const }]]), "2027-05-02");
    expect([bord.realisees, bord.total, bord.pourcentage]).toEqual([1, 4, 33]); // l'action abandonnée ne compte pas
    expect(bord.enRetard.map((a) => a.id)).toEqual(["a2"]);
    expect(bord.parTrimestre[0]).toEqual({ trimestre: 1, total: 2, realisees: 1 });
  });
});

describe("Rappel trimestriel", () => {
  it("prévient le conseiller une fois par trimestre, sans contenu du plan, seulement s'il y a quelque chose à faire", async () => {
    const { db, plan } = await preparer();
    const envoyes: Email[] = [];
    const envoi = async (e: Email) => void envoyes.push(e);
    expect(await envoyerRappelsTrimestriels(db, new Date("2027-01-02T03:00:00Z"), envoi)).toBe(1);
    expect(await envoyerRappelsTrimestriels(db, new Date("2027-01-03T03:00:00Z"), envoi)).toBe(0); // déjà envoyé ce trimestre
    expect(envoyes[0].to.email).toBe("cp@entreprise.test");
    expect(JSON.stringify(envoyes[0])).not.toContain("Action a1");
    // Tout est réalisé : plus de rappel au trimestre suivant
    for (const id of ["a1", "a2"]) await db.insert(planActionStatus).values({ planId: plan.id, actionId: id, status: "realisee", doneOn: "2027-03-01", updatedBy: (await db.select().from(users).where(eq(users.email, "cp@entreprise.test")))[0].id });
    expect(await envoyerRappelsTrimestriels(db, new Date("2027-04-02T03:00:00Z"), envoi)).toBe(0);
  });
});
