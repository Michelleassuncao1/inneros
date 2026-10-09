import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { Logo } from "./Logo";

export function SiteHeader({ sansLangues = false }: { sansLangues?: boolean }) {
  const t = useTranslations("Header");

  return (
    <>
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:bg-white focus:px-3 focus:py-2"
      >
        {t("skipLink")}
      </a>
      <header className="border-b border-ima-line">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-4">
          <Link href="/" className="flex items-center gap-3">
            <Logo alt={t("logoAlt")} />
            <span className="text-xs font-semibold uppercase tracking-widest text-ima-gold-text sm:text-sm">
              {t("brand")}
            </span>
          </Link>
          {!sansLangues && <LanguageSwitcher />}
        </div>
      </header>
    </>
  );
}
