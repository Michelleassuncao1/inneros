// Module C : ateliers avec QR code. Droits, inscriptions et liste d'attente, désinscription, avis anonymes
// (seuil de 5), rappel de la veille, annulation, suppression programmée.
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { ajouterReferent, creerEntreprise } from "../admin/entreprises";
import { users, workshopFeedback, workshopRegistrations, workshops } from "../db/schema";
import { creerBaseDeTest } from "../db/test-db";
import type { Email } from "../email/brevo";
import { designerConseillerPrevention } from "../risques/registre";
import {
  annulerAtelier,
  atelierPublic,
  creerAtelier,
  desinscrire,
  donnerAvis,
  envoyerRappelsAteliers,
  inscrire,
  instantLocal,
  lireAtelier,
  lireAteliers,
  listePresencesCsv,
  marquerPresences,
  modifierAtelier,
  purgerAteliers,
  repondreAppui,
} from "./ateliers";

beforeAll(() => {
  process.env.AUTH_SECRET = randomBytes(32).toString("base64");
});

const MAINTENANT = new Date("2027-03-01T10:00:00Z");
const DEBUT = new Date("2027-03-10T08:00:00Z"); // 10 mars 2027, 9 h à Bruxelles

const saisie = (v: Record<string, unknown> = {}) => ({
  type: "pleine_conscience",
  titre: "Pause bien-être",
  date: "2027-03-10",
  heure: "09:00",
  duree: 60,
  lieu: "Salle 2",
  places: 2,
  appui: false,
  ...v,
});

async function preparer() {
  const { db } = await creerBaseDeTest();
  const [admin] = await db.insert(users).values({ email: "admin@ima.test", name: "Admin", role: "admin", passwordHash: "x" }).returning();
  const org = await creerEntreprise(db, admin.id, { name: "Atelier Fictif", country: "BE", locale: "fr", sector: "Industrie", sizeBand: "50-249" });
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
  const emails: Email[] = [];
  const envoi = async (e: Email) => {
    emails.push(e);
  };
  return { db, admin, orgId, conseiller, autre, emails, envoi };
}

async function atelier(p: Awaited<ReturnType<typeof preparer>>, v: Record<string, unknown> = {}) {
  const r = await creerAtelier(p.db, p.conseiller, p.orgId, saisie(v), MAINTENANT, p.envoi);
  if (!r.ok) throw new Error(r.erreur);
  const [a] = await p.db.select().from(workshops).where(eq(workshops.id, r.valeur.id));
  return a;
}

const jetonDe = (e: Email) => e.text.match(/desinscription#([A-Za-z0-9_-]{32})/)?.[1] ?? "";

describe("Dates dans le fuseau de l'entreprise", () => {
  it("convertit l'heure locale, heure d'hiver et d'été", () => {
    expect(instantLocal("2027-03-10", "09:00", "Europe/Brussels").toISOString()).toBe("2027-03-10T08:00:00.000Z");
    expect(instantLocal("2027-07-10", "09:00", "Europe/Brussels").toISOString()).toBe("2027-07-10T07:00:00.000Z");
    expect(instantLocal("2027-07-10", "09:00", "America/Sao_Paulo").toISOString()).toBe("2027-07-10T12:00:00.000Z");
  });
});

describe("Création d'un atelier", () => {
  it("réservée au conseiller en prévention et à IMA, date future, sans coordonnées", async () => {
    const p = await preparer();
    expect(await creerAtelier(p.db, p.autre, p.orgId, saisie(), MAINTENANT)).toEqual({ ok: false, erreur: "introuvable" });
    expect(await creerAtelier(p.db, p.conseiller, p.orgId, saisie({ date: "2027-02-01" }), MAINTENANT)).toEqual({ ok: false, erreur: "atelierDatePassee" });
    expect(await creerAtelier(p.db, p.conseiller, p.orgId, saisie({ titre: "Appeler le 0470 12 34 56" }), MAINTENANT)).toEqual({ ok: false, erreur: "risqueCoordonnees" });
    const a = await atelier(p);
    expect(a.startsAt).toEqual(DEBUT);
    expect(a.publicCode).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect((await creerAtelier(p.db, p.admin, p.orgId, saisie({ type: "yoga_guide" }), MAINTENANT)).ok).toBe(true);
    expect(await lireAteliers(p.db, p.autre, p.orgId)).toBeNull();
    expect((await lireAteliers(p.db, p.conseiller, p.orgId))!.length).toBe(2);
  });

  it("transmet la demande d'appui à IMA, qui l'accepte et prévient le conseiller", async () => {
    const p = await preparer();
    const a = await atelier(p, { appui: true, demandeAppui: "Animateur pour la séance" });
    expect(a.supportStatus).toBe("demande");
    expect(p.emails.map((e) => e.to.email)).toEqual(["admin@ima.test"]);
    expect(await repondreAppui(p.db, p.admin, a.id, { accepte: false, reponse: "" }, p.envoi)).toEqual({ ok: false, erreur: "motifRefusRequis" });
    expect((await repondreAppui(p.db, p.admin, a.id, { accepte: true, reponse: "Avec plaisir" }, p.envoi)).ok).toBe(true);
    const d = (await lireAtelier(p.db, p.conseiller, a.id))!;
    expect([d.atelier.supportStatus, d.animateurIma]).toEqual(["accepte", "Admin"]);
    expect(p.emails.at(-1)!.to.email).toBe("cp@atelier.test");
  });
});

describe("Inscriptions et liste d'attente", () => {
  it("inscrit dans la limite des places, puis en liste d'attente, et fait avancer la liste", async () => {
    const p = await preparer();
    const a = await atelier(p);
    const ins = (nom: string, email: string) => inscrire(p.db, a.publicCode, { nom, email, langue: "fr" }, MAINTENANT, p.envoi);
    expect(await ins("Ana", "ana@client.test")).toEqual({ ok: true, valeur: { statut: "inscrit" } });
    expect(await ins("Bruno", "Bruno@Client.test ")).toEqual({ ok: true, valeur: { statut: "inscrit" } });
    expect(await ins("Carla", "carla@client.test")).toEqual({ ok: true, valeur: { statut: "attente" } });
    expect(await ins("Dina", "dina@client.test")).toEqual({ ok: true, valeur: { statut: "attente" } });
    expect(await ins("Eva", "eva@client.test")).toEqual({ ok: false, erreur: "atelierComplet" });
    // Même adresse : pas de doublon, nouvel e-mail de confirmation
    expect(await ins("Ana B.", "ana@client.test")).toEqual({ ok: true, valeur: { statut: "inscrit" } });
    expect((await p.db.select().from(workshopRegistrations)).length).toBe(4);
    expect((await atelierPublic(p.db, a.publicCode, MAINTENANT))!).toMatchObject({ phase: "inscription", placesRestantes: 0, complet: true });

    // Désinscription par le lien de l'e-mail : Carla passe inscrite
    const mail = p.emails.filter((e) => e.to.email === "bruno@client.test").at(-1)!;
    expect(await desinscrire(p.db, a.publicCode, "x".repeat(32), MAINTENANT, p.envoi)).toEqual({ ok: false, erreur: "atelierLienInvalide" });
    expect((await desinscrire(p.db, a.publicCode, jetonDe(mail), MAINTENANT, p.envoi)).ok).toBe(true);
    const promu = p.emails.at(-1)!;
    expect([promu.to.email, promu.subject]).toEqual(["carla@client.test", expect.stringContaining("Pause bien-être")]);
    const statuts = Object.fromEntries((await p.db.select().from(workshopRegistrations)).map((r) => [r.email, r.status]));
    expect(statuts).toEqual({ "ana@client.test": "inscrit", "carla@client.test": "inscrit", "dina@client.test": "attente" });

    // Plus de places : Dina passe inscrite ; moins de places que d'inscrits : refusé
    expect(await modifierAtelier(p.db, p.conseiller, a.id, saisie({ places: 1 }), MAINTENANT, p.envoi)).toEqual({ ok: false, erreur: "atelierPlacesInsuffisantes" });
    expect((await modifierAtelier(p.db, p.conseiller, a.id, saisie({ places: 3 }), MAINTENANT, p.envoi)).ok).toBe(true);
    expect(p.emails.at(-1)!.to.email).toBe("dina@client.test");

    // Présences et export pour Excel
    const d = (await lireAtelier(p.db, p.conseiller, a.id))!;
    await marquerPresences(p.db, p.conseiller, a.id, [d.inscriptions[0].id]);
    const csv = (await listePresencesCsv(p.db, p.conseiller, a.id, "fr"))!;
    expect(csv.split("\r\n").length).toBe(5); // en-tête, 3 lignes, fin
    expect(await listePresencesCsv(p.db, p.autre, a.id, "fr")).toBeNull();

    // Après le début : plus d'inscription
    expect(await inscrire(p.db, a.publicCode, { nom: "Zoé", email: "zoe@client.test", langue: "fr" }, DEBUT, p.envoi)).toEqual({ ok: false, erreur: "atelierFerme" });
  });

  it("annulation : prévient les inscrits et efface aussitôt leurs données", async () => {
    const p = await preparer();
    const a = await atelier(p);
    await inscrire(p.db, a.publicCode, { nom: "Ana", email: "ana@client.test", langue: "pt-BR" }, MAINTENANT, p.envoi);
    expect((await annulerAtelier(p.db, p.conseiller, a.id, MAINTENANT, p.envoi)).ok).toBe(true);
    expect(p.emails.at(-1)!.to.email).toBe("ana@client.test");
    expect(await p.db.select().from(workshopRegistrations)).toEqual([]);
    const [apres] = await p.db.select().from(workshops).where(eq(workshops.id, a.id));
    expect([apres.registeredCount, !!apres.registrationsPurgedAt]).toEqual([1, true]);
    expect((await atelierPublic(p.db, a.publicCode, MAINTENANT))!.phase).toBe("annule");
  });

  it("rappel la veille aux inscrits et au conseiller, une seule fois", async () => {
    const p = await preparer();
    const a = await atelier(p);
    await inscrire(p.db, a.publicCode, { nom: "Ana", email: "ana@client.test", langue: "fr" }, MAINTENANT, p.envoi);
    p.emails.length = 0;
    const veille = new Date("2027-03-09T02:00:00Z");
    expect(await envoyerRappelsAteliers(p.db, MAINTENANT, p.envoi)).toBe(0);
    expect(await envoyerRappelsAteliers(p.db, veille, p.envoi)).toBe(2);
    expect(p.emails.map((e) => e.to.email).sort()).toEqual(["ana@client.test", "cp@atelier.test"]);
    expect(p.emails.find((e) => e.to.email === "cp@atelier.test")!.text).not.toContain("Ana");
    expect(await envoyerRappelsAteliers(p.db, veille, p.envoi)).toBe(0);
  });
});

describe("Avis anonymes", () => {
  const avis = (n: number, commentaire?: string) => ({ reponses: { utile: n, clair: n, appliquer: n, animation: n, recommander: n }, commentaire });

  it("ouverts 7 jours à partir du début, résultats à partir de 5 avis", async () => {
    const p = await preparer();
    const a = await atelier(p);
    expect(await donnerAvis(p.db, a.publicCode, avis(5), MAINTENANT)).toEqual({ ok: false, erreur: "atelierAvisFerme" });
    expect(await donnerAvis(p.db, a.publicCode, avis(5, "Écrivez-moi : ana@client.test"), DEBUT)).toEqual({ ok: false, erreur: "risqueCoordonnees" });
    for (const n of [5, 4, 4, 3]) expect((await donnerAvis(p.db, a.publicCode, avis(n, n === 3 ? "Trop court" : undefined), DEBUT)).ok).toBe(true);
    expect((await lireAtelier(p.db, p.conseiller, a.id))!.resultats).toEqual({ nombre: 4, visible: false });
    await donnerAvis(p.db, a.publicCode, avis(4, "Bonne séance"), DEBUT);
    const r = (await lireAtelier(p.db, p.conseiller, a.id))!.resultats;
    if (!r.visible) throw new Error("résultats attendus");
    expect(r.questions[0]).toEqual({ question: "utile", moyenne: 4, repartition: [0, 0, 1, 3, 1] });
    expect(r.commentaires).toEqual(["Bonne séance", "Trop court"]);
    // Seulement la date du jour : aucune heure enregistrée
    expect((await p.db.select().from(workshopFeedback))[0].submittedOn).toBe("2027-03-10");
    expect(await donnerAvis(p.db, a.publicCode, avis(5), new Date("2027-03-17T09:00:00Z"))).toEqual({ ok: false, erreur: "atelierAvisFerme" });
  });
});

describe("Suppression programmée", () => {
  it("efface les inscriptions après 30 jours (les nombres restent) et les avis après 24 mois", async () => {
    const p = await preparer();
    const a = await atelier(p);
    await inscrire(p.db, a.publicCode, { nom: "Ana", email: "ana@client.test", langue: "fr" }, MAINTENANT, p.envoi);
    await donnerAvis(p.db, a.publicCode, { reponses: { utile: 4, clair: 4, appliquer: 4, animation: 4, recommander: 4 } }, DEBUT);
    expect(await purgerAteliers(p.db, new Date("2027-04-05T10:00:00Z"))).toEqual({ inscriptions: 0, avis: 0 });
    expect(await purgerAteliers(p.db, new Date("2027-04-10T10:00:00Z"))).toEqual({ inscriptions: 1, avis: 0 });
    expect(await p.db.select().from(workshopRegistrations)).toEqual([]);
    expect((await lireAteliers(p.db, p.conseiller, p.orgId))![0]).toMatchObject({ inscrits: 1, avis: 1 });
    expect(await purgerAteliers(p.db, new Date("2029-03-11T10:00:00Z"))).toEqual({ inscriptions: 0, avis: 1 });
    expect(await p.db.select().from(workshopFeedback)).toEqual([]);
  });
});
