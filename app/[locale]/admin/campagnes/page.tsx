import { desc, eq } from "drizzle-orm";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Cellule, EspaceAdmin, FiltrePays, Tableau, TitrePage } from "@/components/EspaceAdmin";
import { Link } from "@/i18n/navigation";
import { PAYS } from "@/lib/admin/entreprises";
import { exigerAdmin } from "@/lib/auth/acces";
import { getDb } from "@/lib/db/client";
import { campaigns, organizations } from "@/lib/db/schema";

export default async function CampagnesPage({
  params,
  searchParams,
}: PageProps<"/[locale]/admin/campagnes">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await exigerAdmin(locale);
  const t = await getTranslations("Campagnes");
  const l = await getTranslations("Libelles");

  const { pays } = await searchParams;
  const filtre = PAYS.find((p) => p === pays);
  const liste = await getDb()
    .select({ campagne: campaigns, entreprise: organizations })
    .from(campaigns)
    .innerJoin(organizations, eq(campaigns.organizationId, organizations.id))
    .where(filtre ? eq(organizations.country, filtre) : undefined)
    .orderBy(desc(campaigns.createdAt));

  return (
    <EspaceAdmin locale={locale} actif="campagnes">
      <TitrePage titre={t("title")} />
      <p className="mb-6 max-w-[70ch] text-sm text-ima-muted">{t("chooseOrganization")}</p>
      <FiltrePays
        base="/admin/campagnes"
        actuel={filtre}
        tous={l("all")}
        libelles={Object.fromEntries(PAYS.map((p) => [p, l(`country.${p}`)]))}
      />
      {liste.length === 0 ? (
        <p>{t("none")}</p>
      ) : (
        <Tableau entetes={[t("colOrganization"), t("colMandate"), t("colDates"), t("colStatus")]}>
          {liste.map(({ campagne: c, entreprise: o }) => (
            <tr key={c.id}>
              <Cellule>
                {o.name} ({l(`country.${o.country}`)})
              </Cellule>
              <Cellule>
                <Link href={`/admin/campagnes/${c.id}`} className="font-semibold text-ima-navy underline">
                  {l(`mandate.${c.mandateType}`)} — {c.mandateReference}
                </Link>
              </Cellule>
              <Cellule>
                {c.startDate} → {c.endDate}
              </Cellule>
              <Cellule>{l(`status.${c.status}`)}</Cellule>
            </tr>
          ))}
        </Tableau>
      )}
    </EspaceAdmin>
  );
}
