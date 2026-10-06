import { getTranslations, setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/SiteHeader";
import { WaveFooter } from "@/components/WaveFooter";
import { demanderLien } from "./actions";
import { FormulaireLien } from "./FormulaireLien";

export default async function ConnexionReferentPage({
  params,
}: PageProps<"/[locale]/espace/connexion">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("ReferentLogin");

  return (
    <>
      <SiteHeader />
      <main id="contenu" className="mx-auto w-full max-w-4xl flex-1 px-4 py-12">
        <h1 className="text-2xl sm:text-3xl">{t("title")}</h1>
        <div aria-hidden="true" className="mt-4 h-0.5 w-16 bg-ima-gold" />
        <p className="mt-6 max-w-[70ch]">{t("intro")}</p>
        <FormulaireLien action={demanderLien.bind(null, locale)} />
      </main>
      <WaveFooter />
    </>
  );
}
