// Téléchargement d'un modèle vierge (module D1) : IMA, ou conseiller en prévention pour les modèles validés
// de son pays. Chaque téléchargement est journalisé.
import { utilisateurConnecte } from "@/lib/auth/acces";
import { getDb } from "@/lib/db/client";
import { telechargerModele } from "@/lib/modeles/modeles";

export async function GET(_requete: Request, { params }: RouteContext<"/api/modeles/[id]">) {
  const { id } = await params;
  const u = await utilisateurConnecte();
  if (!u) return new Response(null, { status: 401 });
  const t = await telechargerModele(getDb(), u, id);
  if (!t) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(t.contenu), {
    headers: { "content-type": t.type, "content-disposition": `attachment; filename="${t.nom}"`, "cache-control": "no-store" },
  });
}
