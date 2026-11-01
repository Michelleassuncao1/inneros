// Aide à la rédaction (module D2) : Word du brouillon relu et approuvé. Le texte vient du navigateur et n'est
// pas conservé ; le nom de la personne qui approuve est celui du compte connecté. Le journal ne garde que le type.
import { journaliser } from "@/lib/audit";
import { utilisateurConnecte } from "@/lib/auth/acces";
import { getDb } from "@/lib/db/client";
import { docxBrouillon } from "@/lib/modeles/docx-ima";
import { aideActivee, contientCoordonnees, peutUtiliserAide, schemaExport } from "@/lib/redaction/aide";

export async function POST(requete: Request) {
  const u = await utilisateurConnecte();
  if (!u || !peutUtiliserAide(u) || !aideActivee()) return new Response(null, { status: 404 });
  const e = schemaExport.safeParse(await requete.json().catch(() => null));
  if (!e.success) return new Response(null, { status: 400 });
  // Dernier contrôle : la personne a pu ajouter des coordonnées en corrigeant le brouillon
  if (contientCoordonnees([e.data.titre, ...e.data.sections.map((s) => `${s.titre} ${s.texte}`)].join(" "))) return new Response(null, { status: 422 });
  const word = await docxBrouillon(e.data, u.name, new Date());
  await journaliser(getDb(), {
    actorUserId: u.id,
    action: "ai_writing_aid_exported",
    ...(u.organizationId ? { targetType: "organization", targetId: u.organizationId } : {}),
    details: { type: e.data.type, langue: e.data.langue },
  });
  return new Response(new Uint8Array(word), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "content-disposition": 'attachment; filename="brouillon-ima.docx"',
      "cache-control": "no-store",
    },
  });
}
