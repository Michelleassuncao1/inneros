"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

const labels: Record<(typeof routing.locales)[number], string> = {
  fr: "FR",
  "pt-BR": "PT-BR",
};

export function LanguageSwitcher() {
  const t = useTranslations("Header");
  const locale = useLocale();
  const pathname = usePathname();

  return (
    <nav aria-label={t("languageLabel")}>
      <ul className="flex gap-1 whitespace-nowrap text-sm font-semibold">
        {routing.locales.map((l) => (
          <li key={l}>
            <Link
              href={pathname}
              locale={l}
              aria-current={l === locale ? "true" : undefined}
              className={
                l === locale
                  ? "inline-block rounded-md bg-ima-navy px-3 py-1.5 text-white"
                  : "inline-block rounded-md border border-ima-navy px-3 py-1.5 text-ima-navy hover:bg-ima-cream"
              }
            >
              {labels[l]}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
