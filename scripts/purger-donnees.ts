// Suppression programmée (étape 9) lancée à la main : réponses brutes arrivées à échéance et vieux journal.
// En production, la même opération est lancée chaque nuit par Vercel (app/api/cron/purge).
// Usage : npm run donnees:purger -- [--simulation] [--date=2027-12-01]   (serveur de développement arrêté)
//   --simulation : affiche ce qui serait supprimé, sans rien supprimer
//   --date       : fait comme si on était à cette date (pour tester sur la campagne de démonstration)
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function principal() {
  const simulation = process.argv.includes("--simulation");
  const date = process.argv.find((a) => a.startsWith("--date="))?.slice(7);
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Date attendue au format AAAA-MM-JJ.");
  const maintenant = date ? new Date(`${date}T12:00:00Z`) : new Date();

  const { getDb } = await import("../lib/db/client");
  const { dureesConservation, purgerDonnees } = await import("../lib/confidentialite/conservation");
  const d = dureesConservation();
  console.log(
    `Règles : réponses brutes ${d.reponsesApresAcceptation} mois après l'acceptation du rapport, ` +
      `${d.reponsesApresCloture} mois après la clôture sans acceptation ; journal ${d.journal} mois.`,
  );
  console.log(`Date de référence : ${maintenant.toISOString().slice(0, 10)}${simulation ? " (simulation, rien n'est supprimé)" : ""}`);

  const r = await purgerDonnees(getDb(), { maintenant, simulation });
  if (!r.campagnes.length) console.log("Aucune campagne arrivée à échéance.");
  for (const c of r.campagnes) {
    const motif = c.motif === "acceptation" ? "rapport accepté" : "clôture sans acceptation";
    console.log(`- campagne ${c.campaignId} : ${c.reponses} réponses ${simulation ? "seraient supprimées" : "supprimées"} (${motif})`);
  }
  console.log(`Journal : ${r.journal} entrées ${simulation ? "seraient supprimées" : "supprimées"}.`);
}

principal()
  .finally(async () => (await import("../lib/db/client")).fermerDb())
  .then(
    () => process.exit(0),
    (e) => {
      console.error(e instanceof Error ? e.message : e);
      process.exit(1);
    },
  );
