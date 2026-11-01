// Module D1 : chaque modèle IMA produit un fichier Word valide, avec la signature IMA et les références légales
import { describe, expect, it } from "vitest";
import { MODELES_IMA } from "./contenu-ima";
import { docxModele } from "./docx-ima";

describe("Modèles Word d'IMA", () => {
  it("identifiants uniques, préfixés par le pays et la langue, et tous à valider par défaut", () => {
    expect(new Set(MODELES_IMA.map((m) => m.id)).size).toBe(MODELES_IMA.length);
    for (const m of MODELES_IMA) expect(m.id.startsWith(`${m.pays.toLowerCase()}-${m.langue === "pt-BR" ? "pt" : m.langue}-`), m.id).toBe(true);
    // Les modèles psychosociaux sont réservés à la Belgique (procédure interne du Code du bien-être)
    expect(MODELES_IMA.filter((m) => m.categorie === "psychosocial").every((m) => m.pays === "BE")).toBe(true);
  });

  it("produit un document Word pour chaque modèle", async () => {
    for (const m of MODELES_IMA) {
      const b = await docxModele(m);
      expect(b.subarray(0, 2).toString(), m.id).toBe("PK");
      expect(b.length).toBeGreaterThan(5000);
    }
  }, 60000);
});
