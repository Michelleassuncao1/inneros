import { count } from "drizzle-orm";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { EspaceAdmin, TitrePage } from "@/components/EspaceAdmin";
import { Link } from "@/i18n/navigation";
import { exigerAdmin } from "@/lib/auth/acces";
import { getDb } from "@/lib/db/client";
import { campaigns, organizations } from "@/lib/db/schema";

export default async function AdminPage({ params }: PageProps<"/[locale]/admin">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const admin = await exigerAdmin(locale);
  const t = await getTranslations("Admin");
  const db = getDb();
  const [[orgs], [camps]] = await Promise.all([
    db.select({ n: count() }).from(organizations),
    db.select({ n: count() }).from(campaigns),
  ]);

  const cartes = [
    { href: "/admin/entreprises", compte: t("organizationsCount", { count: orgs.n }), lien: t("manageOrganizations") },
    { href: "/admin/campagnes", compte: t("campaignsCount", { count: camps.n }), lien: t("manageCampaigns") },
  ];

  return (
    <EspaceAdmin locale={locale} actif="accueil">
      <TitrePage surtitre={t("title")} titre={t("welcome", { name: admin.name })} />
      <p className="max-w-[70ch]">{t("placeholder")}</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {cartes.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="rounded-md border border-ima-line bg-white p-5 hover:border-ima-navy"
          >
            <p className="font-display text-xl font-bold text-ima-navy">{c.compte}</p>
            <p className="mt-2 font-semibold text-ima-navy underline">{c.lien}</p>
          </Link>
        ))}
      </div>
    </EspaceAdmin>
  );
}
