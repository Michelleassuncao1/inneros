// PDF du kit d'information (F13) d'une campagne, dans une des langues de la campagne.
import { eq } from "drizzle-orm";
import { z } from "zod";
import { adminConnecte } from "@/lib/auth/acces";
import { getDb } from "@/lib/db/client";
import { campaigns, organizations } from "@/lib/db/schema";
import { contenuKit } from "@/lib/pdf/contenu-kit";
import { pdfKit } from "@/lib/pdf/kit";

export async function GET(requete: Request, { params }: RouteContext<"/api/admin/campagnes/[id]/kit">) {
  if (!(await adminConnecte())) return new Response(null, { status: 401 });
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return new Response(null, { status: 404 });
  const langue = new URL(requete.url).searchParams.get("langue") ?? "";

  const [ligne] = await getDb()
    .select({ campagne: campaigns, entreprise: organizations })
    .from(campaigns)
    .innerJoin(organizations, eq(campaigns.organizationId, organizations.id))
    .where(eq(campaigns.id, id));
  if (!ligne || !(ligne.campagne.locales as string[]).includes(langue)) return new Response(null, { status: 404 });
  const { campagne, entreprise } = ligne;

  const pdf = await pdfKit(
    await contenuKit({
      langue,
      entreprise: entreprise.name,
      pays: entreprise.country,
      debut: campagne.startDate,
      fin: campagne.endDate,
      seuil: campagne.groupMinSize,
      critere: campagne.groupingCriterion,
    }),
  );
  const telecharger = new URL(requete.url).searchParams.get("telecharger") !== "non";
  return new Response(new Uint8Array(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `${telecharger ? "attachment" : "inline"}; filename="kit-information-${campagne.mandateReference.replace(/[^\w-]/g, "_")}-${langue}.pdf"`,
      "cache-control": "no-store",
    },
  });
}
