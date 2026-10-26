// Certificat IMA de la formation « IMA Talks — Utiliser l'IA dans InnerOS » : uniquement pour la personne
// connectée, après l'enregistrement de sa formation. Chaque téléchargement est journalisé.
import { journaliser } from "@/lib/audit";
import { utilisateurConnecte } from "@/lib/auth/acces";
import { getDb } from "@/lib/db/client";
import { donneesCertificat } from "@/lib/formation/formation";
import { pdfCertificat } from "@/lib/pdf/certificat";

export async function GET() {
  const u = await utilisateurConnecte();
  if (!u) return new Response(null, { status: 401 });
  const db = getDb();
  const d = await donneesCertificat(db, u);
  if (!d) return new Response(null, { status: 404 });
  const pdf = await pdfCertificat(d);
  await journaliser(db, { actorUserId: u.id, action: "ai_training_certificate_downloaded", targetType: "user", targetId: u.id, details: { certificat: d.code } });
  return new Response(new Uint8Array(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="certificat-ima-${d.code}.pdf"`,
      "cache-control": "no-store",
    },
  });
}
