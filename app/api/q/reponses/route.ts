// Envoi des réponses d'un répondant. Rien n'est écrit dans les journaux : ni le code, ni les réponses.
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { enregistrerReponses } from "@/lib/passation";
import { adresseClient, compter, limiteAtteinte } from "@/lib/securite/limite-requetes";

const corps = z.object({
  code: z.string().min(4).max(40),
  groupe: z.string().uuid(),
  reponses: z.record(z.string().regex(/^[a-z0-9_]{1,40}$/), z.number().int().min(0).max(10).nullable()),
});

export async function POST(requete: Request) {
  const saisie = corps.safeParse(await requete.json().catch(() => null));
  if (!saisie.success) return Response.json({ ok: false, raison: "reponses" }, { status: 400 });
  const adresse = adresseClient(requete.headers);
  if (await limiteAtteinte(getDb(), "code", adresse)) {
    return Response.json({ ok: false, raison: "tropDEssais" }, { status: 429, headers: { "cache-control": "no-store" } });
  }
  const r = await enregistrerReponses(getDb(), saisie.data);
  if (!r.ok) await compter(getDb(), "code", adresse);
  return Response.json(r, { status: r.ok ? 200 : 409, headers: { "cache-control": "no-store" } });
}
