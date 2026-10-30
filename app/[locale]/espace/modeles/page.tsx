// Modèles vierges à télécharger, côté conseiller en prévention (module D1)
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/SiteHeader";
import { WaveFooter } from "@/components/WaveFooter";
import { ListeModeles } from "@/components/modeles/ListeModeles";
import { Link } from "@/i18n/navigation";
import { exigerReferent } from "@/lib/auth/acces";

export default async function ModelesReferentPage({ params }: PageProps<"/[locale]/espace/modeles">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const referent = await exigerReferent(locale);
  if (!referent.preventionAdvisor) notFound();
  const t = await getTranslations("Modeles");

  return (
    <>
      <SiteHeader />
      <main id="contenu" className="mx-auto w-full max-w-4xl flex-1 px-4 py-12">
        <p className="text-sm font-semibold uppercase tracking-widest text-ima-gold-text">{t("title")}</p>
        <div aria-hidden="true" className="mt-4 h-0.5 w-16 bg-ima-gold" />
        <p className="mb-8 mt-6">
          <Link href="/espace" className="font-semibold text-ima-navy underline">
            {t("backSpace")}
          </Link>
        </p>
        <p className="mb-8 max-w-[70ch] text-ima-muted">{t("intro")}</p>
        <ListeModeles utilisateur={referent} />
      </main>
      <WaveFooter />
    </>
  );
}
