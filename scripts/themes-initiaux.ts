// Charge les 12 thèmes de sensibilisation initiaux (fiches et titres, en brouillon) dans la base.
// Option --generer=fr : fait rédiger par l'IA le kit des thèmes dont le kit dans cette langue est incomplet
// (appels payants, environ 0,05 $ par thème). Les thèmes restent des brouillons à relire et valider par IMA.
// Usage : npm run themes:initiaux [-- --admin=adresse@ima] [-- --generer=fr]   (serveur de développement arrêté)
import { readFileSync } from "node:fs";
import { loadEnvConfig } from "@next/env";
import { eq } from "drizzle-orm";

loadEnvConfig(process.cwd());

async function principal() {
  const { getDb } = await import("../lib/db/client");
  const { users } = await import("../lib/db/schema");
  const { creerTheme, genererKitIA, listerThemes } = await import("../lib/sensibilisation/themes");
  const { kitComplet } = await import("../lib/sensibilisation/contenu");
  const db = getDb();
  const arg = (nom: string) => process.argv.find((a) => a.startsWith(`--${nom}=`))?.split("=")[1];

  const email = arg("admin");
  const [admin] = email
    ? await db.select().from(users).where(eq(users.email, email))
    : await db.select().from(users).where(eq(users.role, "admin"));
  if (!admin || admin.role !== "admin") throw new Error("Administrateur introuvable (option --admin=adresse).");

  const themes = JSON.parse(readFileSync("data/sensibilisation/themes-initiaux.json", "utf8")) as { fiche: unknown; titre: string; objectif: string }[];
  let crees = 0;
  for (const t of themes) {
    const r = await creerTheme(db, admin.id, t);
    if (r.ok) crees++;
    else if (r.erreur !== "themeCodeExistant") throw new Error(`${t.titre} : ${r.erreur}`);
  }
  console.log(`${crees} thème(s) créé(s), ${themes.length - crees} déjà présent(s).`);

  const langue = arg("generer");
  if (langue) {
    for (const t of await listerThemes(db)) {
      if (t.status !== "draft" || kitComplet(t.kitsLus[langue as "fr"])) continue;
      const r = await genererKitIA(db, admin.id, t.id, langue);
      console.log(`${t.code} : ${r.ok ? "kit rédigé" : `échec (${r.erreur})`}`);
    }
  }
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
