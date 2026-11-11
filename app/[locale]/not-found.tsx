// Page introuvable, dans la langue du visiteur (à la place de la page anglaise de Next.js).
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export default async function PageIntrouvable() {
  const t = await getTranslations("PageErreur");
  return (
    <main id="contenu" className="mx-auto w-full max-w-2xl flex-1 px-4 py-16">
      <h1 className="text-3xl">{t("notFoundTitle")}</h1>
      <p className="mt-4 max-w-[60ch]">{t("notFoundText")}</p>
      <Link href="/" className="mt-8 inline-block rounded-md bg-ima-navy px-5 py-2.5 font-semibold text-white hover:bg-ima-navy-deep">
        {t("home")}
      </Link>
    </main>
  );
}
