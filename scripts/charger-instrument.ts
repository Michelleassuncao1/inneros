// Chargement d'un ou plusieurs fichiers de questionnaire (format 2).
// Sans option : affiche seulement l'aperçu, pour le comparer mot à mot au document officiel.
// Avec --enregistrer : enregistre en base (serveur de développement arrêté).
// Usage : npm run instruments:charger -- instruments/xxx.fr.json [--enregistrer]
import { readFileSync } from "node:fs";
import { loadEnvConfig } from "@next/env";
import { apercuInstrument, enregistrerInstrument, lireInstrument } from "../lib/instruments/chargement";

loadEnvConfig(process.cwd());

async function principal() {
  const enregistrer = process.argv.includes("--enregistrer");
  const fichiers = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  if (!fichiers.length) throw new Error("Indiquez au moins un fichier JSON.");

  const lus = fichiers.map((chemin) => {
    const r = lireInstrument(JSON.parse(readFileSync(chemin, "utf8")));
    if (!r.ok) throw new Error(`${chemin} refusé :\n  - ${r.erreurs.join("\n  - ")}`);
    return r.fichier;
  });

  for (const f of lus) console.log(`\n${"=".repeat(70)}\n${apercuInstrument(f)}`);

  if (!enregistrer) {
    console.log("\nAperçu seulement : rien n'est enregistré. Ajoutez --enregistrer après vérification.");
    return;
  }
  const { getDb } = await import("../lib/db/client");
  for (const f of lus) {
    const r = await enregistrerInstrument(getDb(), f);
    if (!r.ok) throw new Error(`${f.instrument} ${f.version} (${f.langue}) : ${r.erreur}`);
    console.log(`Enregistré : ${f.instrument} ${f.version} (${f.langue})`);
  }
}

principal()
  .then(() => process.exit(0))
  .catch((e: Error) => {
    console.error(`\nErreur : ${e.message}\n`);
    process.exit(1);
  });
