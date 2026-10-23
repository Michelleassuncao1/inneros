// Kit d'une campagne de sensibilisation, côté entreprise (module B2)
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { z } from "zod";
import { SiteHeader } from "@/components/SiteHeader";
import { WaveFooter } from "@/components/WaveFooter";
import { KitCampagne } from "@/components/sensibilisation/KitCampagne";
import { Link } from "@/i18n/navigation";
import { exigerReferent } from "@/lib/auth/acces";
import { getDb } from "@/lib/db/client";
import { kitDeCampagne } from "@/lib/sensibilisation/calendrier";

export default async function KitReferentPage({ params, searchParams }: PageProps<"/[locale]/espace/sensibilisation/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const referent = await exigerReferent(locale);
  if (!z.string().uuid().safeParse(id).success) notFound();
  const lang = (await searchParams).lang;
  const donnees = await kitDeCampagne(getDb(), referent, id, typeof lang === "string" ? lang : locale);
  if (!donnees) notFound();
  const t = await getTranslations("Calendrier");

  return (
    <>
      <SiteHeader />
      <main id="contenu" className="mx-auto w-full max-w-4xl flex-1 px-4 py-12">
        <p className="text-sm font-semibold uppercase tracking-widest text-ima-gold-text">{t("title")}</p>
        <h1 className="mt-2 text-2xl sm:text-3xl">{donnees.kit.titre}</h1>
        <div aria-hidden="true" className="mt-4 h-0.5 w-16 bg-ima-gold" />
        <p className="mb-8 mt-6">
          <Link href="/espace/sensibilisation" className="font-semibold text-ima-navy underline">
            {t("backCalendar")}
          </Link>
        </p>
        <KitCampagne donnees={donnees} base={`/espace/sensibilisation/${id}`} />
      </main>
      <WaveFooter />
    </>
  );
}
