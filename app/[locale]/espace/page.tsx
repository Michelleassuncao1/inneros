import { eq } from "drizzle-orm";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/SiteHeader";
import { WaveFooter } from "@/components/WaveFooter";
import { exigerReferent } from "@/lib/auth/acces";
import { getDb } from "@/lib/db/client";
import { organizations } from "@/lib/db/schema";
import { Link } from "@/i18n/navigation";
import { campagnesDuReferent } from "@/lib/rapport/entreprise";
import { planPourReferentSuivi } from "@/lib/plan/suivi";
import { deconnexion } from "../deconnexion";

export default async function EspaceReferentPage({ params }: PageProps<"/[locale]/espace">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const referent = await exigerReferent(locale);
  const t = await getTranslations("Referent");
  const te = await getTranslations("EspaceRapport");
  const tr = await getTranslations("Risques");
  const tp = await getTranslations("Plan");
  const tcal = await getTranslations("Calendrier");
  const ta = await getTranslations("Ateliers");
  const plan = await planPourReferentSuivi(getDb(), referent);
  const liste = await campagnesDuReferent(getDb(), referent.id);
  const date = (d: string) => new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));
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
        <p className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/espace/sensibilisation"
            className="inline-block rounded-md border border-ima-navy px-4 py-2 font-semibold text-ima-navy hover:bg-ima-cream"
          >
            {tcal("title")}
          </Link>
          {referent.preventionAdvisor && (
            <Link
              href="/espace/ateliers"
              className="inline-block rounded-md border border-ima-navy px-4 py-2 font-semibold text-ima-navy hover:bg-ima-cream"
            >
              {ta("title")}
            </Link>
          )}
        </p>
        {(referent.preventionAdvisor || plan) && (
          <p className="mt-3 flex flex-wrap gap-3">
            {referent.preventionAdvisor && (
              <Link
                href="/espace/risques"
                className="inline-block rounded-md border border-ima-navy px-4 py-2 font-semibold text-ima-navy hover:bg-ima-cream"
              >
                {tr("spaceLink")}
              </Link>
            )}
            {plan && (
              <Link
                href="/espace/plan"
                className="inline-block rounded-md border border-ima-navy px-4 py-2 font-semibold text-ima-navy hover:bg-ima-cream"
              >
                {tp("spaceLink")}
                {plan.peutAdopter && ` · ${tp("toAdopt")}`}
              </Link>
            )}
          </p>
        )}
        <section aria-labelledby="campagnes" className="mt-8">
          <h2 id="campagnes" className="text-xl">{te("campaignsTitle")}</h2>
          {liste.length === 0 ? (
            <div className="mt-4 max-w-[70ch] rounded-md border-l-[3px] border-ima-gold bg-ima-cream px-5 py-4">{te("noCampaign")}</div>
          ) : (
            <ul className="mt-4 flex flex-col gap-3">
              {liste.map(({ campagne, vue }) => (
                <li key={campagne.id} className="rounded-md border border-ima-line bg-white p-4">
                  <p className="font-semibold text-ima-navy">{campagne.mandateReference}</p>
                  <p className="text-sm text-ima-muted">{te("period", { debut: date(campagne.startDate), fin: date(campagne.endDate) })}</p>
                  <p className="mt-1">{te("status", { etat: te(`etat.${vue?.etat ?? "indisponible"}`) })}</p>
                  {vue?.etat === "disponible" && (
                    <Link href={`/espace/campagnes/${campagne.id}`} className="mt-2 inline-block font-semibold text-ima-navy underline">
                      {te("open")}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
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
