import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  // Ordre d'affichage dans le globe ; néerlandais et anglais ajoutés en phase 1 le 8 octobre 2026
  locales: ["fr", "nl", "en", "pt-BR"],
  defaultLocale: "fr",
});
