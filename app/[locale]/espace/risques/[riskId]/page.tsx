// Modification d'un risque du registre, côté conseiller en prévention (module A1)
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { z } from "zod";
import { SiteHeader } from "@/components/SiteHeader";
import { WaveFooter } from "@/components/WaveFooter";
import { EditionRisque } from "@/components/risques/EditionRisque";
import { Link } from "@/i18n/navigation";
import { exigerReferent } from "@/lib/auth/acces";

export default async function RisqueReferentPage({ params }: PageProps<"/[locale]/espace/risques/[riskId]">) {
  const { locale, riskId } = await params;
  setRequestLocale(locale);
  const referent = await exigerReferent(locale);
  if (!referent.preventionAdvisor || !referent.organizationId || !z.string().uuid().safeParse(riskId).success) notFound();
  const t = await getTranslations("Risques");
  const contenu = await EditionRisque({ utilisateur: referent, organizationId: referent.organizationId, riskId, locale });
  if (!contenu) notFound();

  return (
    <>
      <SiteHeader />
      <main id="contenu" className="mx-auto w-full max-w-4xl flex-1 px-4 py-12">
        <p className="text-sm font-semibold uppercase tracking-widest text-ima-gold-text">{t("title")}</p>
        <h1 className="mt-2 text-2xl sm:text-3xl">{t("editTitle")}</h1>
        <div aria-hidden="true" className="mt-4 h-0.5 w-16 bg-ima-gold" />
        <p className="mb-8 mt-6">
          <Link href="/espace/risques" className="font-semibold text-ima-navy underline">
            {t("backRegister")}
          </Link>
        </p>
        {contenu}
      </main>
      <WaveFooter />
    </>
  );
}
