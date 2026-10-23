// PDF du kit d'une campagne de sensibilisation (module B2) : affiche ou fiche d'animation.
// IMA et les référents de l'entreprise ; chaque téléchargement est journalisé.
import { z } from "zod";
import { journaliser } from "@/lib/audit";
import { utilisateurConnecte } from "@/lib/auth/acces";
import { getDb } from "@/lib/db/client";
import { pdfAffiche, pdfFicheAnimation } from "@/lib/pdf/sensibilisation";
import { kitDeCampagne } from "@/lib/sensibilisation/calendrier";

export async function GET(requete: Request, { params }: RouteContext<"/api/sensibilisation/[id]/[format]">) {
  const { id, format: brut } = await params;
  const format = z.enum(["affiche", "fiche"]).safeParse(brut);
  if (!z.string().uuid().safeParse(id).success || !format.success) return new Response(null, { status: 404 });
  const u = await utilisateurConnecte();
  if (!u) return new Response(null, { status: 401 });
  const db = getDb();
  const k = await kitDeCampagne(db, u, id, new URL(requete.url).searchParams.get("lang") ?? undefined);
  if (!k) return new Response(null, { status: 404 });
  const pdf = format.data === "affiche" ? await pdfAffiche(k.kit, k.aide, k.langue) : await pdfFicheAnimation(k.kit, k.aide, k.langue);
  await journaliser(db, { actorUserId: u.id, action: "awareness_kit_downloaded", targetType: "organization", targetId: k.campagne.organizationId, details: { format: format.data, theme: k.theme.code } });
  return new Response(new Uint8Array(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${format.data}-${k.theme.code}-${k.langue}.pdf"`,
      "cache-control": "no-store",
    },
  });
}
