// Produit les modèles Word d'IMA (module D1) dans data/modeles/fichiers/<pays>/<langue>/<id>.docx.
// Ensuite, les versions PDF : scripts/modeles/exporter-pdf.ps1 (Microsoft Word, sous Windows).
// Usage : npm run modeles:ima
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { MODELES_IMA } from "../lib/modeles/contenu-ima";
import { docxModele } from "../lib/modeles/docx-ima";

async function principal() {
  for (const m of MODELES_IMA) {
    const dossier = path.join("data/modeles/fichiers", m.pays, m.langue);
    mkdirSync(dossier, { recursive: true });
    writeFileSync(path.join(dossier, `${m.id}.docx`), await docxModele(m));
    console.log(`ok : ${m.pays}/${m.langue}/${m.id}.docx`);
  }
}

principal();
