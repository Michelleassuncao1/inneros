import { eq } from "drizzle-orm";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/SiteHeader";
import { WaveFooter } from "@/components/WaveFooter";
import { exigerReferent } from "@/lib/auth/acces";
import { getDb } from "@/lib/db/client";
import { organizations } from "@/lib/db/schema";
import { deconnexion } from "../deconnexion";

export default async function EspaceReferentPage({ params }: PageProps<"/[locale]/espace">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const referent = await exigerReferent(locale);
  const t = await getTranslations("Referent");
  const [entreprise] = await getDb()
    .select({ name: organizations.name })
    .from(organizations)
    .where(eq(organizations.id, referent.organizationId!));

  return (
    <>
      <SiteHeader />
      <main id="contenu" className="mx-auto w-full max-w-4xl flex-1 px-4 py-12">
        <p className="text-sm font-semibold uppercase tracking-widest text-ima-gold-text">{t("title")}</p>
        <h1 className="mt-2 text-2xl sm:text-3xl">{t("welcome", { name: referent.name })}</h1>
        <div aria-hidden="true" className="mt-4 h-0.5 w-16 bg-ima-gold" />
        {entreprise && <p className="mt-6 font-semibold text-ima-navy">{t("organization", { name: entreprise.name })}</p>}
        <div className="mt-6 max-w-[70ch] rounded-md border-l-[3px] border-ima-gold bg-ima-cream px-5 py-4">
          {t("noReport")}
        </div>
        <form action={deconnexion.bind(null, locale)} className="mt-8">
          <button
            type="submit"
            className="rounded-md border border-ima-navy px-5 py-2.5 font-semibold text-ima-navy hover:bg-ima-cream"
          >
            {t("signOut")}
          </button>
        </form>
      </main>
      <WaveFooter />
    </>
  );
}
