import { getTranslations, setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/SiteHeader";
import { WaveFooter } from "@/components/WaveFooter";
import { connexionAdmin } from "./actions";
import { FormulaireAdmin } from "./FormulaireAdmin";

export default async function ConnexionAdminPage({
  params,
}: PageProps<"/[locale]/admin/connexion">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("AdminLogin");

  return (
    <>
      <SiteHeader />
      <main id="contenu" className="mx-auto w-full max-w-4xl flex-1 px-4 py-12">
        <h1 className="text-2xl sm:text-3xl">{t("title")}</h1>
        <div aria-hidden="true" className="mt-4 h-0.5 w-16 bg-ima-gold" />
        <p className="mt-6 max-w-[70ch]">{t("intro")}</p>
        <FormulaireAdmin action={connexionAdmin.bind(null, locale)} />
      </main>
      <WaveFooter />
    </>
  );
}
