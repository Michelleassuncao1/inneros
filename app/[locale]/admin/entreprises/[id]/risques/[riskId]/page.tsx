// Modification d'un risque du registre, côté IMA (module A1)
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { z } from "zod";
import { EspaceAdmin, TitrePage } from "@/components/EspaceAdmin";
import { EditionRisque } from "@/components/risques/EditionRisque";
import { Link } from "@/i18n/navigation";
import { exigerAdmin } from "@/lib/auth/acces";

export default async function RisqueAdminPage({ params }: PageProps<"/[locale]/admin/entreprises/[id]/risques/[riskId]">) {
  const { locale, id, riskId } = await params;
  setRequestLocale(locale);
  const admin = await exigerAdmin(locale);
  if (!z.string().uuid().safeParse(id).success || !z.string().uuid().safeParse(riskId).success) notFound();
  const t = await getTranslations("Risques");
  const contenu = await EditionRisque({ utilisateur: admin, organizationId: id, riskId, locale });
  if (!contenu) notFound();

  return (
    <EspaceAdmin locale={locale} actif="entreprises">
      <TitrePage surtitre={t("title")} titre={t("editTitle")} />
      <p className="mb-8">
        <Link href={`/admin/entreprises/${id}/risques`} className="font-semibold text-ima-navy underline">
          {t("backRegister")}
        </Link>
      </p>
      {contenu}
    </EspaceAdmin>
  );
}
