// Tâche programmée Vercel (une fois par nuit, voir vercel.json) : suppression des données arrivées à échéance,
// puis rappel trimestriel du plan de prévention aux conseillers en prévention (une fois par trimestre et par plan).
// Protégée par CRON_SECRET : Vercel envoie « Authorization: Bearer <CRON_SECRET> ».
import { timingSafeEqual } from "node:crypto";
import { purgerDonnees } from "@/lib/confidentialite/conservation";
import { getDb } from "@/lib/db/client";
import { envoyerRappelsTrimestriels } from "@/lib/plan/suivi";

export const dynamic = "force-dynamic";

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
  const r = await purgerDonnees(getDb());
  const rappels = await envoyerRappelsTrimestriels(getDb());
  // Seulement des nombres : aucun identifiant ni donnée dans la réponse
  return Response.json({ campagnes: r.campagnes.length, reponses: r.campagnes.reduce((s, c) => s + c.reponses, 0), journal: r.journal, rappels });
}
