// Fiche d'un atelier, côté IMA (module C)
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { z } from "zod";
import { EspaceAdmin, TitrePage } from "@/components/EspaceAdmin";
import { DetailAtelier } from "@/components/ateliers/DetailAtelier";
import { Link } from "@/i18n/navigation";
import { exigerAdmin } from "@/lib/auth/acces";
import { getDb } from "@/lib/db/client";
import { workshops } from "@/lib/db/schema";

export default async function AtelierAdminPage({ params }: PageProps<"/[locale]/admin/entreprises/[id]/ateliers/[atelierId]">) {
  const { locale, id, atelierId } = await params;
  setRequestLocale(locale);
  const admin = await exigerAdmin(locale);
  if (!z.string().uuid().safeParse(id).success || !z.string().uuid().safeParse(atelierId).success) notFound();
  const [a] = await getDb()
    .select({ title: workshops.title })
    .from(workshops)
    .where(and(eq(workshops.id, atelierId), eq(workshops.organizationId, id)));
  if (!a) notFound();
  const t = await getTranslations("Ateliers");

  return (
    <EspaceAdmin locale={locale} actif="entreprises">
      <TitrePage surtitre={t("title")} titre={a.title} />
      <p className="mb-8">
        <Link href={`/admin/entreprises/${id}/ateliers`} className="font-semibold text-ima-navy underline">
          {t("backList")}
        </Link>
      </p>
      <DetailAtelier utilisateur={admin} atelierId={atelierId} locale={locale} />
    </EspaceAdmin>
  );
}
