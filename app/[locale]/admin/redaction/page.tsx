// Aide à la rédaction, côté IMA (module D2)
import { getTranslations, setRequestLocale } from "next-intl/server";
import { EspaceAdmin, TitrePage } from "@/components/EspaceAdmin";
import { EspaceRedaction } from "@/components/redaction/EspaceRedaction";
import { Link } from "@/i18n/navigation";
import { exigerAdmin } from "@/lib/auth/acces";

export default async function RedactionAdminPage({ params }: PageProps<"/[locale]/admin/redaction">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const admin = await exigerAdmin(locale);
  const t = await getTranslations("Redaction");

  return (
    <EspaceAdmin locale={locale} actif="modeles">
      <TitrePage surtitre={t("title")} titre={t("adminTitle")} />
      <p className="mb-4">
        <Link href="/admin/modeles" className="font-semibold text-ima-navy underline">
          {t("backTemplates")}
        </Link>
      </p>
      <p className="mb-8 max-w-[70ch] text-ima-muted">{t("intro")}</p>
      <EspaceRedaction utilisateur={admin} locale={locale} />
    </EspaceAdmin>
  );
}
