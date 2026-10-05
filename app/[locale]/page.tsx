import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Logo } from "@/components/Logo";
import { WaveFooter } from "@/components/WaveFooter";

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
  const tHeader = useTranslations("Header");

  return (
    <>
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:bg-white focus:px-3 focus:py-2"
      >
        {tHeader("skipLink")}
      </a>

      <header className="border-b border-ima-line">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-4">
          <div className="flex items-center gap-3">
            <Logo alt={tHeader("logoAlt")} />
            <span className="text-xs font-semibold uppercase tracking-widest text-ima-gold-text sm:text-sm">
              {tHeader("brand")}
            </span>
          </div>
          <LanguageSwitcher />
        </div>
      </header>

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

        <p className="mt-8 text-sm text-ima-muted">{t("status")}</p>
      </main>

      <WaveFooter />
    </>
  );
}
