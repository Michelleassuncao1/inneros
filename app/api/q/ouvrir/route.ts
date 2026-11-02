// Ouverture du questionnaire à partir d'un code. Le code arrive dans le corps de la requête,
// jamais dans l'adresse : il n'apparaît donc pas dans les journaux du serveur.
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { ouvrirQuestionnaire } from "@/lib/passation";
import { FICHES_PAYS, type CodePays } from "@/lib/pays";
import { adresseClient, compter, limiteAtteinte } from "@/lib/securite/limite-requetes";

const corps = z.object({ code: z.string().min(4).max(40), langue: z.string().max(10) });

export async function POST(requete: Request) {
  const saisie = corps.safeParse(await requete.json().catch(() => null));
  if (!saisie.success) return Response.json({ etat: "invalide" });
  // Seuls les codes refusés sont comptés : les collègues d'un même réseau d'entreprise ne se gênent pas
  const adresse = adresseClient(requete.headers);
  if (await limiteAtteinte(getDb(), "code", adresse)) {
    return Response.json({ etat: "tropDEssais" }, { status: 429, headers: { "cache-control": "no-store" } });
  }
  const r = await ouvrirQuestionnaire(getDb(), saisie.data.code, saisie.data.langue);
  if (r.etat === "invalide") await compter(getDb(), "code", adresse);
  if (r.etat !== "ok") return Response.json({ etat: r.etat }, { headers: { "cache-control": "no-store" } });
  return Response.json(
    { ...r, ue: FICHES_PAYS[r.pays as CodePays]?.ue ?? false },
    { headers: { "cache-control": "no-store" } },
  );
}
