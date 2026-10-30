// Bibliothèque de modèles vierges, côté IMA (module D1) : tous les modèles, validés ou à valider
import { getTranslations, setRequestLocale } from "next-intl/server";
import { EspaceAdmin, TitrePage } from "@/components/EspaceAdmin";
import { ListeModeles } from "@/components/modeles/ListeModeles";
import { exigerAdmin } from "@/lib/auth/acces";

export default async function ModelesAdminPage({ params }: PageProps<"/[locale]/admin/modeles">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const admin = await exigerAdmin(locale);
  const t = await getTranslations("Modeles");

  return (
    <EspaceAdmin locale={locale} actif="modeles">
      <TitrePage surtitre={t("title")} titre={t("adminTitle")} />
      <p className="mb-8 max-w-[70ch] text-ima-muted">{t("adminHelp")}</p>
      <ListeModeles utilisateur={admin} />
    </EspaceAdmin>
  );
}
