import { getTranslations, setRequestLocale } from "next-intl/server";
import { EspaceAdmin, TitrePage } from "@/components/EspaceAdmin";
import { FormulaireAction } from "@/components/FormulaireAction";
import { exigerAdmin } from "@/lib/auth/acces";
import { actionCreerEntreprise } from "../../actions";
import { ChampsEntreprise } from "../../ChampsFormulaires";

export default async function NouvelleEntreprisePage({
  params,
}: PageProps<"/[locale]/admin/entreprises/nouvelle">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await exigerAdmin(locale);
  const t = await getTranslations("Entreprises");

  return (
    <EspaceAdmin locale={locale} actif="entreprises">
      <TitrePage surtitre={t("title")} titre={t("new")} />
      <FormulaireAction action={actionCreerEntreprise.bind(null, locale)} libelle={t("create")} enCours={t("saving")}>
        <ChampsEntreprise />
      </FormulaireAction>
    </EspaceAdmin>
  );
}
