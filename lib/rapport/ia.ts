// Appel à Claude pour le brouillon de rapport (étape 8, règles 5 à 8).
// - Modèle : ANTHROPIC_MODEL (claude-sonnet-5-5), jamais de modèle de secours (décision du 14/10/2026) ;
// - réponse au format imposé (structured outputs) puis vérifiée par le code ;
// - pas de « température » : Claude Sonnet 5.5 ne l'accepte pas (décision du 14/10/2026), la stabilité
//   vient du format imposé, d'un effort « medium » et de la relecture humaine.
import { readFileSync } from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import type { ChargeUtile } from "./charge-utile";
import { schemaContenuRapport, type ContenuRapport } from "./contenu";

export const FICHIER_PROMPT = path.join(process.cwd(), "prompts", "redaction-rapport.system.md");

export function lirePrompt(fichier = FICHIER_PROMPT) {
  const texte = readFileSync(fichier, "utf8");
  const version = texte.match(/^# Version : (\S+)/m)?.[1] ?? "inconnue";
  return { texte, version };
}

type ErreurIA = { ok: false; erreur: "iaRefus" | "iaFormat" | "iaIndisponible" | "iaNonConfiguree"; detail?: string };
export type ResultatStructure<T> =
  | { ok: true; contenu: T; modele: string; versionPrompt: string; jetonsEntree: number; jetonsSortie: number }
  | ErreurIA;
export type ResultatIA = ResultatStructure<ContenuRapport>;

// Fonction d'appel remplaçable dans les tests (aucun appel payant pendant les tests)
export type AppelIA = (charge: ChargeUtile) => Promise<ResultatIA>;

// Appel commun (rapport, plan de prévention) : prompt système versionné, format imposé, double contrôle
export async function appelStructure<S extends z.ZodType>(fichierPrompt: string, schema: S, donnees: unknown): Promise<ResultatStructure<z.infer<S>>> {
  const modele = process.env.ANTHROPIC_MODEL;
  if (!process.env.ANTHROPIC_API_KEY || !modele) return { ok: false, erreur: "iaNonConfiguree" };
  const { texte, version } = lirePrompt(fichierPrompt);
  const client = new Anthropic();
  try {
    const reponse = await client.messages.parse({
      model: modele,
      max_tokens: 16000,
      system: texte,
      output_config: { effort: "medium", format: zodOutputFormat(schema) },
      messages: [{ role: "user", content: JSON.stringify(donnees) }],
    });
    if (reponse.stop_reason === "refusal") {
      return { ok: false, erreur: "iaRefus", detail: reponse.stop_details?.category ?? undefined };
    }
    // Double contrôle : le format imposé par l'API, puis notre propre validation
    const lecture = schema.safeParse(reponse.parsed_output);
    if (!lecture.success) return { ok: false, erreur: "iaFormat" };
    return {
      ok: true,
      contenu: lecture.data,
      modele: reponse.model,
      versionPrompt: version,
      jetonsEntree: reponse.usage.input_tokens,
      jetonsSortie: reponse.usage.output_tokens,
    };
  } catch (e) {
    if (e instanceof Anthropic.APIError) return { ok: false, erreur: "iaIndisponible", detail: `${e.status ?? ""}` };
    throw e;
  }
}

export const appelClaude: AppelIA = (charge) => appelStructure(FICHIER_PROMPT, schemaContenuRapport, charge);
