// Chargement des questionnaires en base. Chaque langue est vérifiée : même structure que les
// langues déjà chargées (mêmes identifiants, mêmes échelles, même sens de cotation).
import { and, eq } from "drizzle-orm";
import { instruments } from "../db/schema";
import type { Db } from "../db/types";
import { schemaFichierInstrument, signature, verifierInstrument, type FichierInstrument } from "./format";

export type ResultatLecture = { ok: true; fichier: FichierInstrument } | { ok: false; erreurs: string[] };

export function lireInstrument(contenu: unknown): ResultatLecture {
  const lecture = schemaFichierInstrument.safeParse(contenu);
  if (!lecture.success) {
    return { ok: false, erreurs: lecture.error.issues.map((i) => `${i.path.join(".")} : ${i.message}`) };
  }
  const erreurs = verifierInstrument(lecture.data);
  return erreurs.length ? { ok: false, erreurs } : { ok: true, fichier: lecture.data };
}

// Définition d'un questionnaire dans une langue, si elle existe et respecte le format 2
export function definitionPour(definitions: unknown, langue: string): FichierInstrument | null {
  const brut = (definitions as Record<string, unknown> | null)?.[langue];
  const lecture = schemaFichierInstrument.safeParse(brut);
  return lecture.success ? lecture.data : null;
}

export async function enregistrerInstrument(db: Db, f: FichierInstrument): Promise<{ ok: true } | { ok: false; erreur: string }> {
  const [existant] = await db
    .select()
    .from(instruments)
    .where(and(eq(instruments.code, f.instrument), eq(instruments.version, f.version)));

  if (!existant) {
    await db.insert(instruments).values({
      code: f.instrument,
      version: f.version,
      source: f.source,
      license: f.licence,
      isTest: f.test,
      definitions: { [f.langue]: f },
    });
    return { ok: true };
  }

  const definitions = (existant.definitions ?? {}) as Record<string, unknown>;
  for (const [langue, brut] of Object.entries(definitions)) {
    if (langue === f.langue) continue;
    const autre = schemaFichierInstrument.safeParse(brut);
    if (!autre.success) return { ok: false, erreur: `la langue ${langue} déjà chargée n'est pas au format 2` };
    if (signature(autre.data) !== signature(f)) {
      return { ok: false, erreur: `structure différente de la version ${langue} déjà chargée (identifiants, échelles ou sens de cotation)` };
    }
  }
  await db
    .update(instruments)
    .set({ definitions: { ...definitions, [f.langue]: f } })
    .where(eq(instruments.id, existant.id));
  return { ok: true };
}

// Aperçu lisible pour comparer, mot à mot, avec le document officiel avant d'enregistrer
export function apercuInstrument(f: FichierInstrument): string {
  const lignes = [
    `${f.titre} — ${f.instrument} ${f.version} (${f.langue})${f.test ? " [TEST]" : ""}`,
    `Source : ${f.source}`,
    `Licence : ${f.licence}`,
    "",
    "Échelles de réponse :",
    ...f.echelles_reponse.map((e) => `  [${e.id}] ${e.options.map((o) => `${o.code} = ${o.libelle}`).join(" | ")}`),
  ];
  let total = 0;
  for (const d of f.dimensions) {
    lignes.push("", `Dimension ${d.id} — ${d.nom}${d.niveau_mindset ? ` (niveau MINDSET : ${d.niveau_mindset})` : ""}`);
    if (d.consigne) lignes.push(`  Consigne : ${d.consigne}`);
    for (const i of d.items) {
      lignes.push(`  ${i.id}. ${i.texte}   [réponses : ${i.reponse} ; sens : ${i.sens}]`);
      total++;
    }
  }
  lignes.push("", `Total : ${f.dimensions.length} dimensions, ${total} items.`);
  return lignes.join("\n");
}
