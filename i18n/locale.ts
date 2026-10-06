import { hasLocale } from "next-intl";
import { routing } from "./routing";

// Langue reçue d'un formulaire ou d'une adresse : toujours ramenée à une langue autorisée
export function langueValide(locale: unknown): (typeof routing.locales)[number] {
  return typeof locale === "string" && hasLocale(routing.locales, locale)
    ? locale
    : routing.defaultLocale;
}
