// Module D2 : aide à la rédaction. Interrupteurs, droits, engagement, filtre des coordonnées, limite par jour,
// journal sans contenu, Brésil bloqué par défaut, Word marqué « préparé avec l'aide de l'IA ». Aucun appel payant.
import { randomBytes } from "node:crypto";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ajouterReferent, creerEntreprise } from "../admin/entreprises";
import { auditLog, users } from "../db/schema";
import { creerBaseDeTest } from "../db/test-db";
import { docxBrouillon } from "../modeles/docx-ima";
import { designerConseillerPrevention } from "../risques/registre";
import { contientCoordonnees, preparerBrouillon, type AppelRedaction } from "./aide";

beforeAll(() => {
  process.env.AUTH_SECRET = randomBytes(32).toString("base64");
});
afterEach(() => {
  delete process.env.AI_WRITING_AID_ENABLED;
  delete process.env.AI_WRITING_AID_BRAZIL;
});

const NOTES = "Réunion CPPT de mars : trois accidents bénins au dépôt, avis favorable sur le plan d'action, prochaine réunion en avril.";
const appels: unknown[] = [];
const fausseIA: AppelRedaction = async (donnees) => {
  appels.push(donnees);
  return {
    ok: true,
    contenu: { titre: "Procès-verbal", sections: [{ titre: "Accidents", paragraphes: ["Trois accidents bénins."] }], a_completer: ["Date de la réunion"] },
    modele: "claude-test",
    versionPrompt: "aide-redaction-v1.0",
    jetonsEntree: 100,
    jetonsSortie: 50,
  };
};

async function preparer(pays: "BE" | "BR" = "BE") {
  const { db } = await creerBaseDeTest();
  const [admin] = await db.insert(users).values({ email: "admin@ima.test", name: "Admin", role: "admin", passwordHash: "x" }).returning();
  const org = await creerEntreprise(db, admin.id, { name: "Fictive", country: pays, locale: pays === "BR" ? "pt-BR" : "fr", sector: "Services", sizeBand: "50-249" });
  if (!org.ok) throw new Error(org.erreur);
  for (const [nom, email] of [["Conseillère", "cp@fictive.test"], ["Autre", "rh@fictive.test"]]) await ajouterReferent(db, admin.id, org.valeur.id, { name: nom, email });
  const [cp0] = await db.select().from(users).where(eq(users.email, "cp@fictive.test"));
  await designerConseillerPrevention(db, admin.id, org.valeur.id, cp0.id, true);
  const [cp] = await db.select().from(users).where(eq(users.email, "cp@fictive.test"));
  const [autre] = await db.select().from(users).where(eq(users.email, "rh@fictive.test"));
  return { db, admin, cp, autre };
}

const demande = (v: Record<string, unknown> = {}) => ({ type: "pv_reunion", langue: "fr", notes: NOTES, sansDonneesPersonnelles: true, ...v });

describe("Filtre des coordonnées", () => {
  it("repère e-mails, téléphones, numéros d'identification et IBAN", () => {
    expect(contientCoordonnees("Écrire à marie.dupont@exemple.be")).toBe(true);
    expect(contientCoordonnees("Appeler le 0470 12 34 56")).toBe(true);
    expect(contientCoordonnees("Registre national 85.07.30-033.61")).toBe(true);
    expect(contientCoordonnees("CPF 123.456.789-09")).toBe(true);
    expect(contientCoordonnees("IBAN BE68 5390 0754 7034")).toBe(true);
    expect(contientCoordonnees("Trois accidents en 2026, réunion le 12 mars.")).toBe(false);
  });
});

describe("Préparation d'un brouillon", () => {
  it("coupée par défaut ; réservée au conseiller et à IMA ; engagement et filtre obligatoires", async () => {
    const { db, cp, autre } = await preparer();
    expect(await preparerBrouillon(db, cp, demande(), fausseIA)).toEqual({ ok: false, erreur: "redactionDesactivee" });
    process.env.AI_WRITING_AID_ENABLED = "true";
    expect(await preparerBrouillon(db, autre, demande(), fausseIA)).toEqual({ ok: false, erreur: "introuvable" });
    expect(await preparerBrouillon(db, cp, demande({ sansDonneesPersonnelles: false }), fausseIA)).toEqual({ ok: false, erreur: "redactionEngagementRequis" });
    expect(await preparerBrouillon(db, cp, demande({ type: "demande_intervention" }), fausseIA)).toEqual({ ok: false, erreur: "saisieInvalide" });
    expect(await preparerBrouillon(db, cp, demande({ notes: `${NOTES} Contact : 0470 12 34 56` }), fausseIA)).toEqual({ ok: false, erreur: "redactionDonneesPersonnelles" });
    expect(appels).toHaveLength(0);

    const r = await preparerBrouillon(db, cp, demande(), fausseIA);
    expect(r.ok && r.valeur.a_completer).toEqual(["Date de la réunion"]);
    expect(appels.at(-1)).toEqual({ type: "pv_reunion", langue: "fr", pays: "BE", notes: NOTES }); // ni nom d'entreprise ni identité
    // Le journal ne contient pas les notes
    const [j] = await db.select().from(auditLog).where(eq(auditLog.action, "ai_writing_aid_used"));
    expect(JSON.stringify(j.details)).not.toContain("dépôt");
  });

  it("limite de 10 brouillons par personne et par jour", async () => {
    process.env.AI_WRITING_AID_ENABLED = "true";
    const { db, admin } = await preparer();
    const jour = new Date();
    for (let i = 0; i < 10; i++) expect((await preparerBrouillon(db, admin, demande(), fausseIA, jour)).ok).toBe(true);
    expect(await preparerBrouillon(db, admin, demande(), fausseIA, jour)).toEqual({ ok: false, erreur: "redactionLimiteAtteinte" });
  });

  it("Brésil : bloqué tant que les clauses-types de l'ANPD ne sont pas en place", async () => {
    process.env.AI_WRITING_AID_ENABLED = "true";
    const { db, cp } = await preparer("BR");
    expect(await preparerBrouillon(db, cp, demande({ langue: "pt-BR" }), fausseIA)).toEqual({ ok: false, erreur: "redactionPaysNonDisponible" });
    process.env.AI_WRITING_AID_BRAZIL = "true";
    expect((await preparerBrouillon(db, cp, demande({ langue: "pt-BR" }), fausseIA)).ok).toBe(true);
  });
});

describe("Word du brouillon approuvé", () => {
  it("porte la mention IA visible et dans les propriétés du document", async () => {
    const word = await docxBrouillon({ langue: "fr", titre: "PV du CPPT", sections: [{ titre: "Accidents", texte: "Trois accidents.\n\nAucun grave." }] }, "Conseillère Fictive", new Date("2026-11-01T10:00:00Z"));
    expect(word.subarray(0, 2).toString()).toBe("PK");
    const { default: JSZip } = await import("jszip");
    const zip = await JSZip.loadAsync(word);
    const proprietes = await zip.file("docProps/core.xml")!.async("string");
    expect(proprietes).toContain("préparé avec l&apos;aide de l&apos;IA");
    expect(await zip.file("word/document.xml")!.async("string")).toContain("relu et approuvé par Conseillère Fictive");
  });
});
