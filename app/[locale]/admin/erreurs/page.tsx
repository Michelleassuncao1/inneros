// Onglet « Erreurs » (étape 10) : erreurs des 30 derniers jours, regroupées, sans donnée personnelle.
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Cellule, EspaceAdmin, Tableau, TitrePage } from "@/components/EspaceAdmin";
import { exigerAdmin } from "@/lib/auth/acces";
import { getDb } from "@/lib/db/client";
import { AFFICHAGE_ERREURS_JOURS, CONSERVATION_ERREURS_JOURS, erreursRecentes } from "@/lib/erreurs/journal";
import { traiterErreur } from "./actions";

export default async function ErreursPage({ params }: PageProps<"/[locale]/admin/erreurs">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await exigerAdmin(locale);
  const t = await getTranslations("JournalErreurs");
  const erreurs = await erreursRecentes(getDb());
  const dateHeure = new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Brussels" });

  return (
    <EspaceAdmin locale={locale} actif="erreurs">
      <TitrePage titre={t("title")} />
      <p className="mb-6 max-w-[70ch] text-sm text-ima-muted">
        {t("help", { jours: AFFICHAGE_ERREURS_JOURS, conservation: CONSERVATION_ERREURS_JOURS })}
      </p>
      {erreurs.length === 0 ? (
        <p>{t("empty")}</p>
      ) : (
        <Tableau entetes={[t("last"), t("page"), t("source"), t("kind"), t("count"), t("status")]}>
          {erreurs.map((e) => (
            <tr key={e.id}>
              <Cellule>
                <span className="whitespace-nowrap">{dateHeure.format(e.lastAt)}</span>
              </Cellule>
              <Cellule>
                <code className="break-all text-xs">{e.route}</code>
              </Cellule>
              <Cellule>{e.source === "serveur" ? t("server") : t("browser")}</Cellule>
              <Cellule>
                <code className="text-xs">{e.kind}</code>
                {e.digest && <span className="block text-xs text-ima-muted">{t("reference", { digest: e.digest })}</span>}
              </Cellule>
              <Cellule>{t("times", { n: e.occurrences, depuis: dateHeure.format(e.firstAt) })}</Cellule>
              <Cellule>
                {e.resolvedAt ? (
                  <span className="text-sm text-ima-muted">{t("resolved", { date: dateHeure.format(e.resolvedAt) })}</span>
                ) : (
                  <form action={traiterErreur.bind(null, locale, e.id)}>
                    <button type="submit" className="rounded-md border border-ima-navy px-3 py-1 text-sm font-semibold text-ima-navy hover:bg-ima-cream">
                      {t("resolve")}
                    </button>
                  </form>
                )}
              </Cellule>
            </tr>
          ))}
        </Tableau>
      )}
    </EspaceAdmin>
  );
}
