// COPSOQ III, version belge (étape 5B) : fichiers conformes, mêmes structures en fr/nl/en,
// items CORE présents, WE exclu, version réservée aux entreprises belges.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { choisirQuestionnaires, creerCampagne } from "../admin/campagnes";
import { creerEntreprise } from "../admin/entreprises";
import { instruments, users } from "../db/schema";
import { creerBaseDeTest } from "../db/test-db";
import { enregistrerInstrument, lireInstrument, questionnaireAutorise } from "./chargement";
import { signature, type FichierInstrument } from "./format";

const LANGUES = ["fr", "nl", "en"] as const;
const lire = (langue: string): FichierInstrument => {
  const r = lireInstrument(JSON.parse(readFileSync(`instruments/copsoq3/copsoq3-be-2023-12-13.${langue}.json`, "utf8")));
  if (!r.ok) throw new Error(r.erreurs.join(", "));
  return r.fichier;
};

// Items CORE de la version internationale (lignes directrices COPSOQ III, 2019) : obligatoires
const CORE = [
  "qd2", "qd3", "wp1", "wp2", "edx2", "ed3", "inx1", "pd2", "pd3", "mw1", "pr1", "pr2", "re1", "cl1", "co2", "co3",
  "ql3", "ql4", "ssx2", "scx1", "sw1", "ji1", "ji3", "iw1", "js4", "wf2", "wf3", "tm1", "tmx2", "ju1", "ju4", "gh1",
];

describe("COPSOQ III — version belge", () => {
  it("est lisible dans les trois langues, avec exactement la même structure", () => {
    const [fr, nl, en] = LANGUES.map(lire);
    expect(signature(nl)).toBe(signature(fr));
    expect(signature(en)).toBe(signature(fr));
    expect(fr.dimensions.flatMap((d) => d.items)).toHaveLength(62);
  });

  it("contient tous les items CORE et aucun item d'engagement au travail (WE)", () => {
    const ids = lire("fr").dimensions.flatMap((d) => d.items.map((i) => i.id));
    expect(ids).toEqual(expect.arrayContaining(CORE));
    expect(ids.filter((i) => i.startsWith("we"))).toEqual([]);
  });

  it("compte « je n'ai pas de supérieur / de collègues » comme manquant, et inverse CT5", () => {
    const f = lire("fr");
    const manquants = f.echelles_reponse.flatMap((e) => e.options.filter((o) => o.manquant).map((o) => `${e.id}:${o.code}`));
    expect(manquants).toEqual(["mesuresanschef:9", "frequencesanschef:9", "frequencesanscoll:9"]);
    const inverses = f.dimensions.flatMap((d) => d.items.filter((i) => i.sens === "inverse").map((i) => i.id));
    expect(inverses).toEqual(["ct5"]);
  });

  it("n'est proposée qu'aux entreprises belges", async () => {
    const { db } = await creerBaseDeTest();
    for (const langue of LANGUES) expect((await enregistrerInstrument(db, lire(langue))).ok).toBe(true);
    const [copsoq] = await db.select().from(instruments);
    expect(questionnaireAutorise(copsoq.definitions, "BE")).toBe(true);
    expect(questionnaireAutorise(copsoq.definitions, "BR")).toBe(false);

    const [admin] = await db
      .insert(users)
      .values({ email: "admin@ima.test", name: "Admin", role: "admin", passwordHash: "x" })
      .returning();
    const campagnePour = async (country: string) => {
      const e = await creerEntreprise(db, admin.id, { name: `Entreprise ${country}`, country, locale: "en", sector: "Services", sizeBand: "50-249" });
      if (!e.ok) throw new Error(e.erreur);
      const c = await creerCampagne(db, admin.id, e.valeur.id, {
        mandateType: "n1", mandateReference: `M-${country}`, diagnosticQuestion: "", perimeter: "", groupMinSize: 10,
        startDate: "2026-11-01", endDate: "2026-11-30", locales: ["en"], groupingCriterion: "service",
      });
      if (!c.ok) throw new Error(c.erreur);
      return c.valeur.id;
    };
    expect((await choisirQuestionnaires(db, admin.id, await campagnePour("BE"), [copsoq.id])).ok).toBe(true);
    expect(await choisirQuestionnaires(db, admin.id, await campagnePour("BR"), [copsoq.id])).toEqual({
      ok: false,
      erreur: "questionnairePays",
    });
  });
});
