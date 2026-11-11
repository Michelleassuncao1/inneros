// Erreurs signalées par le navigateur (pages d'erreur app/[locale]/error.tsx et app/global-error.tsx).
// Seuls la page et le type d'erreur sont reçus, jamais le message ; la page est nettoyée (lib/erreurs/journal.ts).
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { enregistrerErreur } from "@/lib/erreurs/journal";
import { adresseClient, compter } from "@/lib/securite/limite-requetes";

const corps = z.object({ route: z.string().max(300), type: z.string().max(60).optional() });

export async function POST(requete: Request) {
  const saisie = corps.safeParse(await requete.json().catch(() => null));
  if (!saisie.success) return new Response(null, { status: 400 });
  if (!(await compter(getDb(), "erreurs", adresseClient(requete.headers)))) return new Response(null, { status: 429 });
  await enregistrerErreur(getDb(), { source: "navigateur", route: saisie.data.route, type: saisie.data.type });
  return new Response(null, { status: 204 });
}
