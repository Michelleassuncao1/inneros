// Kit d'une campagne de sensibilisation, côté IMA (module B2)
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { z } from "zod";
import { EspaceAdmin, TitrePage } from "@/components/EspaceAdmin";
import { KitCampagne } from "@/components/sensibilisation/KitCampagne";
import { Link } from "@/i18n/navigation";
import { exigerAdmin } from "@/lib/auth/acces";
import { getDb } from "@/lib/db/client";
import { kitDeCampagne } from "@/lib/sensibilisation/calendrier";

export default async function KitAdminPage({ params, searchParams }: PageProps<"/[locale]/admin/entreprises/[id]/sensibilisation/[campagneId]">) {
  const { locale, id, campagneId } = await params;
  setRequestLocale(locale);
  const admin = await exigerAdmin(locale);
  if (!z.string().uuid().safeParse(campagneId).success) notFound();
  const lang = (await searchParams).lang;
  const donnees = await kitDeCampagne(getDb(), admin, campagneId, typeof lang === "string" ? lang : locale);
  if (!donnees || donnees.campagne.organizationId !== id) notFound();
  const t = await getTranslations("Calendrier");

  return (
    <EspaceAdmin locale={locale} actif="entreprises">
      <TitrePage surtitre={t("title")} titre={donnees.kit.titre} />
      <p className="mb-8">
        <Link href={`/admin/entreprises/${id}/sensibilisation`} className="font-semibold text-ima-navy underline">
          {t("backCalendar")}
        </Link>
      </p>
      <KitCampagne donnees={donnees} base={`/admin/entreprises/${id}/sensibilisation/${campagneId}`} />
    </EspaceAdmin>
  );
}
