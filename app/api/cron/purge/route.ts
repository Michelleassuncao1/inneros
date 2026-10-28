// Tâche programmée Vercel (une fois par nuit, voir vercel.json) : suppression des données arrivées à échéance,
// puis rappels aux conseillers en prévention : plan de prévention (trimestriel) et sensibilisation (mensuel),
// et rappel de la veille des ateliers (module C) ; inscriptions aux ateliers supprimées 30 jours après.
// Protégée par CRON_SECRET : Vercel envoie « Authorization: Bearer <CRON_SECRET> ».
import { timingSafeEqual } from "node:crypto";
import { envoyerRappelsAteliers, purgerAteliers } from "@/lib/ateliers/ateliers";
import { purgerDonnees } from "@/lib/confidentialite/conservation";
import { getDb } from "@/lib/db/client";
import { envoyerRappelsTrimestriels } from "@/lib/plan/suivi";
import { envoyerRappelsSensibilisation } from "@/lib/sensibilisation/calendrier";
import { actualiserToutesPropositions } from "@/lib/sensibilisation/declencheurs";

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
  const ateliers = await purgerAteliers(getDb());
  await actualiserToutesPropositions(getDb()); // propositions de campagnes (module B3), avant le rappel mensuel
  const rappels = (await envoyerRappelsTrimestriels(getDb())) + (await envoyerRappelsSensibilisation(getDb())) + (await envoyerRappelsAteliers(getDb()));
  // Seulement des nombres : aucun identifiant ni donnée dans la réponse
  return Response.json({ campagnes: r.campagnes.length, reponses: r.campagnes.reduce((s, c) => s + c.reponses, 0), journal: r.journal, ateliers, rappels });
}
