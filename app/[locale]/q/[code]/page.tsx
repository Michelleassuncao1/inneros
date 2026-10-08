// Adresse des QR codes imprimés sur les cartes. Le questionnaire lui-même arrive à l'étape 5 ;
// d'ici là, la page confirme simplement que le lien fonctionne. Le code n'est ni lu ni enregistré.
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/SiteHeader";
import { WaveFooter } from "@/components/WaveFooter";

export const metadata: Metadata = {
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

export default async function QuestionnairePage({ params }: PageProps<"/[locale]/q/[code]">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Questionnaire");

  return (
    <>
      <SiteHeader />
      <main id="contenu" className="mx-auto w-full max-w-4xl flex-1 px-4 py-12">
        <h1 className="text-2xl sm:text-3xl">{t("title")}</h1>
        <div aria-hidden="true" className="mt-4 h-0.5 w-16 bg-ima-gold" />
        <p className="mt-6 max-w-[70ch]">{t("soon")}</p>
      </main>
      <WaveFooter />
    </>
  );
}
