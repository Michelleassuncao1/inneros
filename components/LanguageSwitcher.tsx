// Choix de la langue : un globe qui ouvre la liste des langues, chacune écrite dans sa propre langue.
// Pas de drapeau : une langue n'est pas un pays (le français en Belgique et en France, etc.).
"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

type Langue = (typeof routing.locales)[number];

// Nom de chaque langue dans cette langue même. Ajouter une langue = une ligne ici.
const NOMS: Record<Langue, string> = {
  fr: "Français",
  "pt-BR": "Português (Brasil)",
};

function Globe() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z" />
    </svg>
  );
}

export function LanguageSwitcher({ langues = routing.locales }: { langues?: readonly Langue[] }) {
  const t = useTranslations("Header");
  const locale = useLocale() as Langue;
  const pathname = usePathname();
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const conteneur = useRef<HTMLDivElement>(null);
  const bouton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!ouvert) return;
    const clic = (e: MouseEvent) => {
      if (!conteneur.current?.contains(e.target as Node)) setOuvert(false);
    };
    const touche = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOuvert(false);
        bouton.current?.focus();
      }
    };
    document.addEventListener("mousedown", clic);
    document.addEventListener("keydown", touche);
    return () => {
      document.removeEventListener("mousedown", clic);
      document.removeEventListener("keydown", touche);
    };
  }, [ouvert]);

  const changer = (langue: Langue) => {
    setOuvert(false);
    if (langue === locale) return;
    // On garde les paramètres de l'adresse (ex. : le lien de connexion d'un référent)
    router.replace(`${pathname}${window.location.search}`, { locale: langue });
  };

  return (
    <div ref={conteneur} className="relative">
      <button
        ref={bouton}
        type="button"
        aria-haspopup="menu"
        aria-expanded={ouvert}
        aria-label={`${t("languageLabel")} : ${NOMS[locale]}`}
        onClick={() => setOuvert((o) => !o)}
        className="inline-flex items-center gap-2 rounded-md border border-ima-navy px-3 py-1.5 text-sm font-semibold text-ima-navy hover:bg-ima-cream"
      >
        <Globe />
        <span className="hidden sm:inline">{NOMS[locale]}</span>
        <span className="sm:hidden">{locale.toUpperCase()}</span>
      </button>
      {ouvert && (
        <ul
          role="menu"
          className="absolute right-0 z-20 mt-1 min-w-48 overflow-hidden rounded-md border border-ima-line bg-white py-1 shadow-md"
        >
          {langues.map((l) => (
            <li key={l} role="none">
              <button
                type="button"
                role="menuitemradio"
                aria-checked={l === locale}
                lang={l}
                onClick={() => changer(l)}
                className="flex w-full items-center justify-between gap-3 px-4 py-2 text-left hover:bg-ima-cream focus:bg-ima-cream"
              >
                {NOMS[l]}
                {l === locale && <span aria-hidden="true" className="text-ima-gold-text">✓</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
