// Ancienne forme d'adresse (/q/CODE). Le code est renvoyé après le « # », où le serveur ne le voit plus.
import { redirect } from "next/navigation";
import { langueValide } from "@/i18n/locale";

export default async function AncienneAdresse({ params }: PageProps<"/[locale]/q/[code]">) {
  const { locale, code } = await params;
  redirect(`/${langueValide(locale)}/q#${encodeURIComponent(code)}`);
}
