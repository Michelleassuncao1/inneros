// Téléchargements d'un atelier (module C), pour IMA et le conseiller en prévention :
// affiche PDF avec le QR code, image PNG du QR code, liste des inscrits (CSV, journalisée).
import QRCode from "qrcode";
import { z } from "zod";
import { langueValide } from "@/i18n/locale";
import { formaterQuand, lienPublic, lireAtelier, listePresencesCsv } from "@/lib/ateliers/ateliers";
import { utilisateurConnecte } from "@/lib/auth/acces";
import { getDb } from "@/lib/db/client";
import { organizations } from "@/lib/db/schema";
import { pdfAfficheAtelier } from "@/lib/pdf/atelier";
import { traducteur } from "@/lib/traduction";
import { eq } from "drizzle-orm";

const telechargement = (corps: Uint8Array | string, type: string, nom: string) =>
  new Response(typeof corps === "string" ? corps : new Uint8Array(corps), {
    headers: { "content-type": type, "content-disposition": `attachment; filename="${nom}"`, "cache-control": "no-store" },
  });

export async function GET(requete: Request, { params }: RouteContext<"/api/ateliers/[id]/[format]">) {
  const { id, format: brut } = await params;
  const format = z.enum(["affiche", "qr", "inscrits"]).safeParse(brut);
  if (!z.string().uuid().safeParse(id).success || !format.success) return new Response(null, { status: 404 });
  const u = await utilisateurConnecte();
  if (!u) return new Response(null, { status: 401 });
  const db = getDb();
  const langue = langueValide(new URL(requete.url).searchParams.get("lang"));

  if (format.data === "inscrits") {
    const csv = await listePresencesCsv(db, u, id, langue);
    return csv ? telechargement(csv, "text/csv; charset=utf-8", "inscrits-atelier.csv") : new Response(null, { status: 404 });
  }
  const d = await lireAtelier(db, u, id);
  if (!d) return new Response(null, { status: 404 });
  // Lien public dans la langue de l'entreprise : la page propose ensuite les autres langues
  const [o] = await db.select({ locale: organizations.locale }).from(organizations).where(eq(organizations.id, d.atelier.organizationId));
  const lien = lienPublic(d.atelier.publicCode, o?.locale ?? langue);
  if (format.data === "qr") {
    const png = await QRCode.toBuffer(lien, { margin: 2, width: 800, color: { dark: "#08275A", light: "#FFFFFF" } });
    return telechargement(png, "image/png", "qr-atelier.png");
  }
  const t = traducteur(langue, "AtelierPublic");
  const pdf = await pdfAfficheAtelier({
    titre: d.atelier.title,
    surtitre: traducteur(langue, "Ateliers")(`types.${d.atelier.type}`),
    entreprise: t("proposePar", { entreprise: d.org.name }),
    quand: formaterQuand(d.atelier.startsAt, langue, d.fuseau),
    lieu: d.atelier.place,
    lien,
    avant: t("posterBefore"),
    apres: t("posterAfter"),
  });
  return telechargement(pdf, "application/pdf", "affiche-atelier.pdf");
}
