// Les PDF se fabriquent sans erreur. Avec PDF_ESSAI_DIR, les exemples sont enregistrés pour relecture.
import { writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { pdfCartesJetons } from "./cartes-jetons";
import { pdfKit } from "./kit";

const sortie = process.env.PDF_ESSAI_DIR;
const enregistrer = (nom: string, pdf: Buffer) => sortie && writeFileSync(path.join(sortie, nom), pdf);

describe("PDF", () => {
  it("fabrique les cartes de jetons (10 par page)", async () => {
    const codes = Array.from({ length: 12 }, (_, i) => `K7QF-3MZP-${String.fromCharCode(65 + i)}${(i % 8) + 2}`);
    const pdf = await pdfCartesJetons({
      codes,
      urlQuestionnaire: "http://localhost:3000/fr/q",
      textes: {
        marque: "INSTITUT MINDSET EN ACTION®",
        titre: "Questionnaire bien-être au travail",
        votreCode: "Votre code personnel",
        scanner: "Scannez le QR code ou saisissez le code sur :",
        anonymat: "Anonyme : ce code n'est lié à aucun nom.",
        duree: "Environ 20 minutes · une seule utilisation.",
      },
    });
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    enregistrer("essai-cartes.pdf", pdf);
  });

  it("fabrique le kit d'information", async () => {
    const pdf = await pdfKit({
      marque: "INSTITUT MINDSET EN ACTION®",
      titre: "Note d'information aux travailleurs et à leurs représentants",
      sousTitre: "Questionnaire anonyme sur le bien-être au travail — Entreprise fictive",
      periode: "Période de réponse : du 2 au 27 novembre 2026",
      versionDeTravail: "Version de travail — texte à valider par IMA avant diffusion",
      sections: [
        { titre: "Pourquoi ce questionnaire ?", paragraphes: ["Texte d'essai. ".repeat(30)] },
        { titre: "Votre anonymat", puces: ["Aucun compte, aucun nom.", "Seule la date du jour est conservée."] },
        { titre: "Cadre légal", paragraphes: ["Texte d'essai."], aValider: "À valider par un juriste" },
      ],
      aides: {
        titre: "Besoin d'aide ?",
        intro: "Vous pouvez contacter :",
        numeros: [
          { numero: "112", libelle: "Urgences" },
          { numero: "0800 32 123", libelle: "Centre de Prévention du Suicide" },
        ],
      },
      contact: "Institut Mindset en Action® — info@institutmindsetenaction.com",
    });
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    enregistrer("essai-kit.pdf", pdf);
  });
});
