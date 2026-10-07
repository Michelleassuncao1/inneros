import { asc, eq } from "drizzle-orm";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Cellule, EspaceAdmin, FiltrePays, Tableau, TitrePage } from "@/components/EspaceAdmin";
import { Pays } from "@/components/Drapeau";
import { Link } from "@/i18n/navigation";
import { PAYS } from "@/lib/admin/entreprises";
import { exigerAdmin } from "@/lib/auth/acces";
import { getDb } from "@/lib/db/client";
import { organizations } from "@/lib/db/schema";

export default async function EntreprisesPage({
  params,
  searchParams,
}: PageProps<"/[locale]/admin/entreprises">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await exigerAdmin(locale);
  const t = await getTranslations("Entreprises");
  const l = await getTranslations("Libelles");

  const { pays } = await searchParams;
  const filtre = PAYS.find((p) => p === pays);
  const liste = await getDb()
    .select()
    .from(organizations)
    .where(filtre ? eq(organizations.country, filtre) : undefined)
    .orderBy(asc(organizations.name));

  return (
    <EspaceAdmin locale={locale} actif="entreprises">
      <TitrePage titre={t("title")} />
      <div className="mb-6">
        <Link
          href="/admin/entreprises/nouvelle"
          className="inline-block rounded-md bg-ima-navy px-5 py-2.5 font-semibold text-white hover:bg-ima-navy-deep"
        >
          {t("new")}
        </Link>
      </div>
      <FiltrePays
        base="/admin/entreprises"
        actuel={filtre}
        tous={l("all")}
        libelles={Object.fromEntries(PAYS.map((p) => [p, l(`country.${p}`)]))}
      />
      {liste.length === 0 ? (
        <p>{t("none")}</p>
      ) : (
        <Tableau entetes={[t("colName"), t("colCountry"), t("colSector"), t("colCode")]}>
          {liste.map((o) => (
            <tr key={o.id}>
              <Cellule>
                <Link href={`/admin/entreprises/${o.id}`} className="font-semibold text-ima-navy underline">
                  {o.name}
                </Link>
              </Cellule>
              <Cellule>
                <Pays code={o.country} nom={l(`country.${o.country}`)} />
              </Cellule>
              <Cellule>{o.sector}</Cellule>
              <Cellule>
                <code>{o.internalCode}</code>
              </Cellule>
            </tr>
          ))}
        </Tableau>
      )}
    </EspaceAdmin>
  );
}
