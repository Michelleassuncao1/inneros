// Tâche programmée Vercel (une fois par nuit, voir vercel.json) : suppression des données arrivées à échéance,
// puis rappels aux conseillers en prévention : plan de prévention (trimestriel) et sensibilisation (mensuel),
// et rappel de la veille des ateliers (module C) ; inscriptions aux ateliers supprimées 30 jours après.
// Les étapes et le carnet de bord sont dans lib/taches/nuit.ts.
// Protégée par CRON_SECRET : Vercel envoie « Authorization: Bearer <CRON_SECRET> ».
import { timingSafeEqual } from "node:crypto";
import { getDb } from "@/lib/db/client";
import { executerTachesNuit } from "@/lib/taches/nuit";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // secondes : la tâche ne doit pas être coupée quand il y aura beaucoup d'entreprises

function autorise(requete: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const attendu = Buffer.from(`Bearer ${secret}`);
  const recu = Buffer.from(requete.headers.get("authorization") ?? "");
  return recu.length === attendu.length && timingSafeEqual(recu, attendu);
}

export async function GET(requete: Request) {
  if (!process.env.CRON_SECRET) return new Response(null, { status: 503 });
  if (!autorise(requete)) return new Response(null, { status: 401 });
  const etapes = await executerTachesNuit(getDb());
  // Seulement des noms d'étapes et des nombres : aucun identifiant ni donnée dans la réponse.
  // Code 500 si une étape a échoué, pour que l'échec apparaisse aussi dans les journaux de Vercel.
  return Response.json({ etapes }, { status: etapes.every((e) => e.ok) ? 200 : 500 });
}
