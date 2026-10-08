// PDF des cartes de jetons. Les codes viennent du navigateur de l'administrateur, juste après leur
// création (ils ne sont jamais stockés) ; on vérifie qu'ils sont bien des jetons actifs de la campagne.
import { eq } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { LANGUES } from "@/lib/admin/entreprises";
import { codesValides, JETONS_MAXIMUM_PAR_LOT } from "@/lib/admin/jetons";
import { adminConnecte } from "@/lib/auth/acces";
import { getDb } from "@/lib/db/client";
import { campaigns } from "@/lib/db/schema";
import { pdfCartesJetons } from "@/lib/pdf/cartes-jetons";

const corps = z.object({
  langue: z.enum(LANGUES),
  codes: z.array(z.string().max(20)).min(1).max(JETONS_MAXIMUM_PAR_LOT),
});

export async function POST(requete: Request, { params }: RouteContext<"/api/admin/campagnes/[id]/cartes">) {
  if (!(await adminConnecte())) return new Response(null, { status: 401 });
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return new Response(null, { status: 404 });
  const saisie = corps.safeParse(await requete.json().catch(() => null));
  if (!saisie.success) return new Response(null, { status: 400 });

  const db = getDb();
  const [campagne] = await db.select().from(campaigns).where(eq(campaigns.id, id));
  if (!campagne || !campagne.locales.includes(saisie.data.langue)) return new Response(null, { status: 404 });
  if (!(await codesValides(db, id, saisie.data.codes))) return new Response(null, { status: 400 });

  const t = await getTranslations({ locale: saisie.data.langue, namespace: "Cartes" });
  const pdf = await pdfCartesJetons({
    codes: saisie.data.codes,
    urlQuestionnaire: `${process.env.APP_URL ?? "http://localhost:3000"}/${saisie.data.langue}/q`,
    textes: {
      marque: t("brand"),
      titre: t("title"),
      votreCode: t("yourCode"),
      scanner: t("scan"),
      anonymat: t("anonymous"),
      duree: t("duration"),
    },
  });
  return new Response(new Uint8Array(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="cartes-jetons-${campagne.mandateReference.replace(/[^\w-]/g, "_")}-${saisie.data.langue}.pdf"`,
      "cache-control": "no-store",
    },
  });
}
