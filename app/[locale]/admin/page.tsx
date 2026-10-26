import { count, eq } from "drizzle-orm";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { EspaceAdmin, TitrePage } from "@/components/EspaceAdmin";
import { Link } from "@/i18n/navigation";
import { exigerAdmin } from "@/lib/auth/acces";
import { getDb } from "@/lib/db/client";
import { campaigns, organizations, users } from "@/lib/db/schema";
import { MessageErreur, MessageInfo } from "@/components/Formulaire";

export default async function AdminPage({ params }: PageProps<"/[locale]/admin">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const admin = await exigerAdmin(locale);
  const t = await getTranslations("Admin");
  const tf = await getTranslations("FormationIA");
  const db = getDb();
  const [moi] = await db
    .select({ aiLiteracyAt: users.aiLiteracyAt, aiLiteracyNote: users.aiLiteracyNote })
    .from(users)
    .where(eq(users.id, admin.id));
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

      {/* Formation à la maîtrise de l'IA : requise pour valider un rapport (article 4 AI Act) */}
      <section aria-labelledby="formation-ia" className="mt-12 max-w-2xl">
        <h2 id="formation-ia" className="text-xl">{tf("title")}</h2>
        <p className="mb-3 mt-2 text-sm text-ima-muted">{tf("help")}</p>
        {moi?.aiLiteracyAt ? (
          <div className="mb-4">
            <MessageInfo>
              {tf("current", {
                date: new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${moi.aiLiteracyAt}T00:00:00Z`)),
                note: moi.aiLiteracyNote ?? "",
              })}
            </MessageInfo>
          </div>
        ) : (
          <div className="mb-4">
            <MessageErreur>{tf("missing")}</MessageErreur>
          </div>
        )}
        <Link href="/admin/formation-ia" className="inline-block rounded-md bg-ima-navy px-5 py-2.5 font-semibold text-white hover:bg-ima-navy-deep">
          {moi?.aiLiteracyAt ? tf("openTraining") : tf("startTraining")}
        </Link>
      </section>
    </EspaceAdmin>
  );
}
