// Plan de prévention RPS validé, côté conseiller en prévention de l'entreprise (module A2, lecture seule)
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/SiteHeader";
import { WaveFooter } from "@/components/WaveFooter";
import { AffichagePlan } from "@/components/plan/AffichagePlan";
import { Link } from "@/i18n/navigation";
import { exigerReferent } from "@/lib/auth/acces";
import { getDb } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { lireContenuPlan } from "@/lib/plan/contenu";
import { planPourReferent } from "@/lib/plan/plans";
import { lireRegistre } from "@/lib/risques/registre";

export default async function PlanReferentPage({ params }: PageProps<"/[locale]/espace/plan">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const referent = await exigerReferent(locale);
  const db = getDb();
  const plan = await planPourReferent(db, referent);
  const contenu = plan ? lireContenuPlan(plan.content) : null;
  if (!plan || !contenu || !referent.organizationId) notFound();
  const t = await getTranslations("Plan");
  const registre = (await lireRegistre(db, referent, referent.organizationId)) ?? [];
  const [validateur] = plan.validatedBy ? await db.select({ name: users.name }).from(users).where(eq(users.id, plan.validatedBy)) : [];
  const nom = validateur?.name ?? "—";

  return (
    <>
      <SiteHeader />
      <main id="contenu" className="mx-auto w-full max-w-5xl flex-1 px-4 py-12">
        <p className="text-sm font-semibold uppercase tracking-widest text-ima-gold-text">{t("title")}</p>
        <div aria-hidden="true" className="mt-4 h-0.5 w-16 bg-ima-gold" />
        <p className="mb-4 mt-6">
          <Link href="/espace" className="font-semibold text-ima-navy underline">
            {t("backSpace")}
          </Link>
        </p>
        <p className="mb-2 text-sm text-ima-muted">
          {t("validMeta", {
            debut: plan.startYear,
            fin: plan.startYear + 4,
            nom,
            date: new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(plan.validatedAt!),
          })}
        </p>
        <p className="mb-8 text-sm font-semibold">{plan.aiModel ? t("mentionAi", { nom }) : t("mentionManual", { nom })}</p>
        <AffichagePlan contenu={contenu} startYear={plan.startYear} risques={new Map(registre.map((r) => [r.id, r.title]))} />
      </main>
      <WaveFooter />
    </>
  );
}
