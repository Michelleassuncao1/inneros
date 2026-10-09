// Page du questionnaire. Le contenu dépend du code du répondant : tout se passe dans le navigateur
// (composant Questionnaire), le code n'apparaissant jamais dans l'adresse envoyée au serveur.
import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/SiteHeader";
import { WaveFooter } from "@/components/WaveFooter";
import { Questionnaire } from "./Questionnaire";

export const metadata: Metadata = {
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

export default async function QuestionnairePage({ params }: PageProps<"/[locale]/q">) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      {/* Le choix de langue est proposé dans le questionnaire, limité aux langues de la campagne */}
      <SiteHeader sansLangues />
      <main id="contenu" className="mx-auto w-full max-w-4xl flex-1 px-4 py-10">
        <Questionnaire />
      </main>
      <WaveFooter />
    </>
  );
}
