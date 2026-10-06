import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { WaveFooter } from "@/components/WaveFooter";
import { Link } from "@/i18n/navigation";

const principles = [
  "principleAnonymity",
  "principleThreshold",
  "principleHuman",
  "principleNoDiagnosis",
] as const;

export default function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = use(params);
  setRequestLocale(locale);
  const t = useTranslations("Home");

  return (
    <>
      <SiteHeader />

      <main id="contenu" className="mx-auto w-full max-w-4xl flex-1 px-4 py-12 sm:py-16">
        <h1 className="text-3xl sm:text-[3rem]">{t("title")}</h1>
        <div aria-hidden="true" className="mt-4 h-0.5 w-16 bg-ima-gold" />
        <p className="mt-6 max-w-[70ch] text-lg text-ima-navy">{t("tagline")}</p>
        <p className="mt-4 max-w-[70ch]">{t("intro")}</p>

        <section
          aria-labelledby="engagements"
          className="mt-10 max-w-[70ch] rounded-md border-l-[3px] border-ima-gold bg-ima-cream px-5 py-5"
        >
          <h2 id="engagements" className="text-xl">
            {t("principlesTitle")}
          </h2>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            {principles.map((key) => (
              <li key={key}>{t(key)}</li>
            ))}
          </ul>
        </section>

        <nav className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/admin/connexion"
            className="rounded-md bg-ima-navy px-5 py-2.5 font-semibold text-white hover:bg-ima-navy-deep"
          >
            {t("adminLink")}
          </Link>
          <Link
            href="/espace/connexion"
            className="rounded-md border border-ima-navy px-5 py-2.5 font-semibold text-ima-navy hover:bg-ima-cream"
          >
            {t("referentLink")}
          </Link>
        </nav>

        <p className="mt-8 text-sm text-ima-muted">{t("status")}</p>
      </main>

      <WaveFooter />
    </>
  );
}
