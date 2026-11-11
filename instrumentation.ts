// Suivi des erreurs du serveur (étape 10) : Next.js appelle onRequestError pour chaque erreur d'une page,
// d'une action ou d'une route d'API. Seuls la page (modèle de route), le type et la référence sont gardés
// (lib/erreurs/journal.ts) ; le détail reste dans les journaux de Vercel. Ne doit jamais faire échouer la requête.
import type { Instrumentation } from "next";

export const onRequestError: Instrumentation.onRequestError = async (erreur, _requete, contexte) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { enregistrerErreur } = await import("./lib/erreurs/journal");
    const { getDb } = await import("./lib/db/client");
    const e = erreur as { name?: unknown; digest?: unknown };
    await enregistrerErreur(getDb(), { source: "serveur", route: contexte.routePath, type: e.name, digest: e.digest });
  } catch {
    // Le suivi des erreurs ne doit jamais provoquer une autre erreur
  }
};
