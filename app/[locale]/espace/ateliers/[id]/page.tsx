// Fiche d'un atelier, côté conseiller en prévention (module C)
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { z } from "zod";
import { SiteHeader } from "@/components/SiteHeader";
import { WaveFooter } from "@/components/WaveFooter";
import { DetailAtelier } from "@/components/ateliers/DetailAtelier";
import { Link } from "@/i18n/navigation";
import { peutGererAteliers } from "@/lib/ateliers/ateliers";
import { exigerReferent } from "@/lib/auth/acces";
import { getDb } from "@/lib/db/client";
import { workshops } from "@/lib/db/schema";

export default async function AtelierReferentPage({ params }: PageProps<"/[locale]/espace/ateliers/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const referent = await exigerReferent(locale);
  if (!z.string().uuid().safeParse(id).success) notFound();
  const [a] = await getDb().select({ title: workshops.title, organizationId: workshops.organizationId }).from(workshops).where(eq(workshops.id, id));
  if (!a || !peutGererAteliers(referent, a.organizationId)) notFound();
  const t = await getTranslations("Ateliers");

  return (
    <>
      <SiteHeader />
      <main id="contenu" className="mx-auto w-full max-w-4xl flex-1 px-4 py-12">
        <p className="text-sm font-semibold uppercase tracking-widest text-ima-gold-text">{t("title")}</p>
        <h1 className="mt-2 text-2xl sm:text-3xl">{a.title}</h1>
        <div aria-hidden="true" className="mt-4 h-0.5 w-16 bg-ima-gold" />
        <p className="mb-8 mt-6">
          <Link href="/espace/ateliers" className="font-semibold text-ima-navy underline">
            {t("backList")}
          </Link>
        </p>
        <DetailAtelier utilisateur={referent} atelierId={id} locale={locale} />
      </main>
      <WaveFooter />
    </>
  );
}
