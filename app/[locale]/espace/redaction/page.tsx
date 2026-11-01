// Aide à la rédaction, côté conseiller en prévention (module D2)
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/SiteHeader";
import { WaveFooter } from "@/components/WaveFooter";
import { EspaceRedaction } from "@/components/redaction/EspaceRedaction";
import { Link } from "@/i18n/navigation";
import { exigerReferent } from "@/lib/auth/acces";
import { peutUtiliserAide } from "@/lib/redaction/aide";

export default async function RedactionReferentPage({ params }: PageProps<"/[locale]/espace/redaction">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const referent = await exigerReferent(locale);
  if (!peutUtiliserAide(referent)) notFound();
  const t = await getTranslations("Redaction");

  return (
    <>
      <SiteHeader />
      <main id="contenu" className="mx-auto w-full max-w-4xl flex-1 px-4 py-12">
        <p className="text-sm font-semibold uppercase tracking-widest text-ima-gold-text">{t("title")}</p>
        <div aria-hidden="true" className="mt-4 h-0.5 w-16 bg-ima-gold" />
        <p className="mb-8 mt-6">
          <Link href="/espace/modeles" className="font-semibold text-ima-navy underline">
            {t("backTemplates")}
          </Link>
        </p>
        <p className="mb-8 max-w-[70ch] text-ima-muted">{t("intro")}</p>
        <EspaceRedaction utilisateur={referent} locale={locale} />
      </main>
      <WaveFooter />
    </>
  );
}
