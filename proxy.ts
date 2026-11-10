import type { NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { nouveauNonce, regleCsp } from "./lib/securite/csp";

const langues = createMiddleware(routing);

// Choix de la langue (next-intl) et règles de sécurité des pages (CSP) avec un code unique par visite.
// Next.js lit la règle dans la requête pour ajouter le code à ses propres scripts ; next-intl transmet les en-têtes.
export default function proxy(requete: NextRequest) {
  const csp = regleCsp(nouveauNonce());
  requete.headers.set("Content-Security-Policy", csp);
  const reponse = langues(requete);
  reponse.headers.set("Content-Security-Policy", csp);
  return reponse;
}

export const config = {
  // Toutes les pages sauf l'API, les fichiers internes de Next.js et les fichiers statiques
  matcher: "/((?!api|trpc|_next|_vercel|.*\\..*).*)",
};
