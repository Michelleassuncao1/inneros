import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/SiteHeader";
import { WaveFooter } from "@/components/WaveFooter";
import { ouvrirEspace } from "./actions";
import { FormulaireOuverture } from "./FormulaireOuverture";

// Le lien contient un jeton : jamais transmis à un autre site ni indexé
export const metadata: Metadata = {
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

export default async function LienPage({
  params,
  searchParams,
}: PageProps<"/[locale]/espace/lien">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { token } = await searchParams;
  const t = await getTranslations("MagicLink");

  return (
    <>
      <SiteHeader />
      <main id="contenu" className="mx-auto w-full max-w-4xl flex-1 px-4 py-12">
        <h1 className="text-2xl sm:text-3xl">{t("title")}</h1>
        <div aria-hidden="true" className="mt-4 h-0.5 w-16 bg-ima-gold" />
        <p className="mt-6 max-w-[70ch]">{t("intro")}</p>
        <FormulaireOuverture
          action={ouvrirEspace.bind(null, locale)}
          jeton={typeof token === "string" ? token : ""}
        />
      </main>
      <WaveFooter />
    </>
  );
}
