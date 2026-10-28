// Désinscription d'un atelier depuis le lien de l'e-mail (module C)
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/SiteHeader";
import { WaveFooter } from "@/components/WaveFooter";
import { Desinscription } from "@/components/ateliers/Desinscription";
import { Link } from "@/i18n/navigation";
import { atelierPublic } from "@/lib/ateliers/ateliers";
import { getDb } from "@/lib/db/client";

export const metadata: Metadata = {
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

export default async function DesinscriptionPage({ params }: PageProps<"/[locale]/atelier/[code]/desinscription">) {
  const { locale, code } = await params;
  setRequestLocale(locale);
  const a = await atelierPublic(getDb(), code);
  if (!a) notFound();
  const t = await getTranslations("AtelierPublic");

  return (
    <>
      <SiteHeader />
      <main id="contenu" className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
        <p className="text-sm font-semibold uppercase tracking-widest text-ima-gold-text">{t("unsubscribeTitle")}</p>
        <h1 className="mt-2 text-2xl sm:text-3xl">{a.titre}</h1>
        <div aria-hidden="true" className="mt-4 h-0.5 w-16 bg-ima-gold" />
        <p className="mb-6 mt-6">{t("unsubscribeHelp")}</p>
        <Desinscription locale={locale} code={code} textes={{ bouton: t("unsubscribe"), enCours: t("sending"), lienIncomplet: t("missingLink") }} />
        <p className="mt-8">
          <Link href={`/atelier/${code}`} className="font-semibold text-ima-navy underline">
            {t("back")}
          </Link>
        </p>
      </main>
      <WaveFooter />
    </>
  );
}
