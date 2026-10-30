// Module D1 : bibliothèque de modèles vierges. Fichiers présents, droits (IMA, conseiller en prévention du pays),
// modèles à valider réservés à IMA, téléchargement journalisé.
import { existsSync } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { ajouterReferent, creerEntreprise } from "../admin/entreprises";
import { auditLog, users } from "../db/schema";
import { creerBaseDeTest } from "../db/test-db";
import { designerConseillerPrevention } from "../risques/registre";
import { CATALOGUE, modelesVisibles, telechargerModele, type Modele } from "./modeles";

beforeAll(() => {
  process.env.AUTH_SECRET = randomBytes(32).toString("base64");
});

describe("Catalogue", () => {
  it("chaque modèle a un identifiant unique et un fichier présent", () => {
    expect(new Set(CATALOGUE.map((m) => m.id)).size).toBe(CATALOGUE.length);
    for (const m of CATALOGUE) {
      expect(existsSync(path.join("data/modeles/fichiers", m.fichier)), m.fichier).toBe(true);
      expect(m.fichier.endsWith(`.${m.format}`)).toBe(true);
    }
  });
});

describe("Droits", () => {
  it("IMA voit tout ; le conseiller, les modèles validés de son pays ; les autres référents, rien", async () => {
    const { db } = await creerBaseDeTest();
    const [admin] = await db.insert(users).values({ email: "admin@ima.test", name: "Admin", role: "admin", passwordHash: "x" }).returning();
    const org = await creerEntreprise(db, admin.id, { name: "Fictive", country: "BE", locale: "fr", sector: "Services", sizeBand: "50-249" });
    if (!org.ok) throw new Error(org.erreur);
    for (const [nom, email] of [["Conseillère", "cp@fictive.test"], ["Autre", "rh@fictive.test"]]) await ajouterReferent(db, admin.id, org.valeur.id, { name: nom, email });
    const [cp0] = await db.select().from(users).where(eq(users.email, "cp@fictive.test"));
    await designerConseillerPrevention(db, admin.id, org.valeur.id, cp0.id, true);
    const [cp] = await db.select().from(users).where(eq(users.email, "cp@fictive.test"));
    const [autre] = await db.select().from(users).where(eq(users.email, "rh@fictive.test"));

    const base = CATALOGUE[0];
    const catalogue: Modele[] = [
      { ...base, id: "be-valide", valide: true },
      { ...base, id: "be-a-valider", valide: false },
      { ...base, id: "br-valide", pays: "BR", valide: true },
    ];
    expect((await modelesVisibles(db, admin, catalogue)).map((m) => m.id)).toEqual(["be-valide", "be-a-valider", "br-valide"]);
    expect((await modelesVisibles(db, cp, catalogue)).map((m) => m.id)).toEqual(["be-valide"]);
    expect(await modelesVisibles(db, autre, catalogue)).toEqual([]);

    expect(await telechargerModele(db, cp, "be-a-valider", catalogue)).toBeNull();
    const t = (await telechargerModele(db, cp, "be-valide", catalogue))!;
    expect(t.contenu.subarray(0, 2).toString()).toBe("PK"); // fichier Word (archive zip)
    const [j] = await db.select().from(auditLog).where(eq(auditLog.action, "template_downloaded"));
    expect([j.actorUserId, j.targetId, j.details]).toEqual([cp.id, org.valeur.id, { modele: "be-valide" }]);
  });
});
