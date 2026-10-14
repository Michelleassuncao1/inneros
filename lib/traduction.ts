// Traductions hors des pages (e-mails, PDF, tâches) : mêmes fichiers messages/*.json que l'interface,
// utilisables partout, y compris dans les tests.
import { createTranslator } from "next-intl";
import en from "../messages/en.json";
import fr from "../messages/fr.json";
import nl from "../messages/nl.json";
import ptBR from "../messages/pt-BR.json";

const MESSAGES: Record<string, typeof fr> = { fr, nl, en, "pt-BR": ptBR as typeof fr };

export type Traducteur = ((cle: string, valeurs?: Record<string, string | number>) => string) & { raw: (cle: string) => unknown };

export function traducteur(locale: string, espace: string): Traducteur {
  const langue = MESSAGES[locale] ? locale : "fr";
  const t = createTranslator({ locale: langue, messages: MESSAGES[langue] });
  const traduire = ((cle: string, valeurs?: Record<string, string | number>) =>
    (t as unknown as (k: string, v?: Record<string, string | number>) => string)(`${espace}.${cle}`, valeurs)) as Traducteur;
  traduire.raw = (cle: string) => (t as unknown as { raw: (k: string) => unknown }).raw(`${espace}.${cle}`);
  return traduire;
}
