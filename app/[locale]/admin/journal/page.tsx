// Journal d'audit (F11) : qui a fait quoi et quand, côté IMA et référents. Lecture seule, administrateurs IMA.
import { desc, eq } from "drizzle-orm";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Cellule, EspaceAdmin, Tableau, TitrePage } from "@/components/EspaceAdmin";
import { Link } from "@/i18n/navigation";
import { exigerAdmin } from "@/lib/auth/acces";
import { dureesConservation } from "@/lib/confidentialite/conservation";
import { getDb } from "@/lib/db/client";
import { auditLog, users } from "@/lib/db/schema";

const PAR_PAGE = 50;

export default async function JournalPage({ params, searchParams }: PageProps<"/[locale]/admin/journal">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await exigerAdmin(locale);
  const t = await getTranslations("Journal");

  const libelles = t.raw("actions") as Record<string, string>;
  const { action, page } = await searchParams;
  const filtre = typeof action === "string" && action in libelles ? action : undefined;
  const numero = Math.max(1, Number.parseInt(typeof page === "string" ? page : "1", 10) || 1);

  // Une ligne de plus que la page, pour savoir s'il existe une page suivante
  const lignes = await getDb()
    .select({ entree: auditLog, email: users.email })
    .from(auditLog)
    .leftJoin(users, eq(auditLog.actorUserId, users.id))
    .where(filtre ? eq(auditLog.action, filtre) : undefined)
    .orderBy(desc(auditLog.at))
    .limit(PAR_PAGE + 1)
    .offset((numero - 1) * PAR_PAGE);
  const suivante = lignes.length > PAR_PAGE;
  const affichees = lignes.slice(0, PAR_PAGE);

  const lien = (n: number) => `/admin/journal?${new URLSearchParams({ ...(filtre ? { action: filtre } : {}), page: String(n) })}`;
  const dateHeure = new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "medium" });

  return (
    <EspaceAdmin locale={locale} actif="journal">
      <TitrePage titre={t("title")} />
      <p className="mb-6 max-w-[70ch] text-sm text-ima-muted">{t("help", { mois: dureesConservation().journal })}</p>

      <form className="mb-6 flex flex-wrap items-end gap-3" method="get">
        <label className="flex flex-col gap-1 text-sm font-semibold text-ima-navy">
          {t("action")}
          <select name="action" defaultValue={filtre ?? ""} className="rounded-md border border-ima-line bg-white px-3 py-2 font-normal text-ima-ink">
            <option value="">{t("all")}</option>
            {Object.entries(libelles).map(([cle, libelle]) => (
              <option key={cle} value={cle}>
                {libelle}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="rounded-md border border-ima-navy px-4 py-2 font-semibold text-ima-navy hover:bg-ima-cream">
          {t("filter")}
        </button>
      </form>

      {affichees.length === 0 ? (
        <p>{t("empty")}</p>
      ) : (
        <Tableau entetes={[t("date"), t("author"), t("action"), t("target"), t("details")]}>
          {affichees.map(({ entree, email }) => (
            <tr key={entree.id}>
              <Cellule>
                <span className="whitespace-nowrap">{dateHeure.format(entree.at)}</span>
              </Cellule>
              <Cellule>{email ?? (entree.actorUserId ? t("unknown") : t("system"))}</Cellule>
              <Cellule>{libelles[entree.action] ?? entree.action}</Cellule>
              <Cellule>
                {entree.targetType === "campaign" && entree.targetId ? (
                  <Link href={`/admin/campagnes/${entree.targetId}`} className="text-ima-navy underline">
                    {entree.targetType}
                  </Link>
                ) : entree.targetType === "organization" && entree.targetId ? (
                  <Link href={`/admin/entreprises/${entree.targetId}`} className="text-ima-navy underline">
                    {entree.targetType}
                  </Link>
                ) : (
                  (entree.targetType ?? "")
                )}
              </Cellule>
              <Cellule>
                {entree.details ? (
                  <code className="break-all text-xs text-ima-muted">{JSON.stringify(entree.details)}</code>
                ) : null}
              </Cellule>
            </tr>
          ))}
        </Tableau>
      )}

      <nav aria-label={t("page", { page: numero })} className="mt-6 flex items-center gap-4 text-sm font-semibold">
        {numero > 1 && (
          <Link href={lien(numero - 1)} className="text-ima-navy underline">
            {t("previous")}
          </Link>
        )}
        <span className="text-ima-muted">{t("page", { page: numero })}</span>
        {suivante && (
          <Link href={lien(numero + 1)} className="text-ima-navy underline">
            {t("next")}
          </Link>
        )}
      </nav>
    </EspaceAdmin>
  );
}
