// PDF du rapport d'une campagne (étape 8B).
// - Praticien IMA : à tout moment (un brouillon porte la mention « aperçu — non validé ») ;
// - référent : seulement s'il a accès à la campagne et que le rapport est validé.
// Chaque téléchargement est journalisé.
import { z } from "zod";
import { journaliser } from "@/lib/audit";
import { adminConnecte, referentConnecte } from "@/lib/auth/acces";
import { getDb } from "@/lib/db/client";
import { contenuPdfRapport } from "@/lib/pdf/contenu-rapport";
import { pdfRapport } from "@/lib/pdf/rapport";
import { rapportPourReferent } from "@/lib/rapport/entreprise";

export async function GET(_requete: Request, { params }: RouteContext<"/api/rapport/[id]/pdf">) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return new Response(null, { status: 404 });
  const db = getDb();

  const admin = await adminConnecte();
  const referent = admin ? null : await referentConnecte();
  if (!admin && !referent) return new Response(null, { status: 401 });
  if (referent) {
    const vue = await rapportPourReferent(db, referent.id, id);
    if (!vue || vue.etat !== "disponible") return new Response(null, { status: 404 });
  }

  const contenu = await contenuPdfRapport(db, id);
  if (!contenu) return new Response(null, { status: 404 });
  const pdf = await pdfRapport(contenu);
  await journaliser(db, { actorUserId: (admin ?? referent)!.id, action: "report_downloaded", targetType: "campaign", targetId: id });

  return new Response(new Uint8Array(pdf), {
    headers: { "content-type": "application/pdf", "content-disposition": `attachment; filename="${contenu.fichier}"`, "cache-control": "no-store" },
  });
}
