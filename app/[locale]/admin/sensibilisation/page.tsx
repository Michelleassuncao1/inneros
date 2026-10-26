// Bibliothèque de thèmes de sensibilisation RPS et santé mentale (module B1), côté IMA
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Cellule, EspaceAdmin, Tableau, TitrePage } from "@/components/EspaceAdmin";
import { Champ, ZoneTexte } from "@/components/Formulaire";
import { FormulaireAction } from "@/components/FormulaireAction";
import { Link } from "@/i18n/navigation";
import { exigerAdmin } from "@/lib/auth/acces";
import { getDb } from "@/lib/db/client";
import { kitComplet, LANGUES_THEME } from "@/lib/sensibilisation/contenu";
import { listerThemes } from "@/lib/sensibilisation/themes";
import { actionCreerTheme } from "./actions";
import { ChampsFiche } from "./ChampsFiche";

export default async function SensibilisationPage({ params }: PageProps<"/[locale]/admin/sensibilisation">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await exigerAdmin(locale);
  const t = await getTranslations("Sensibilisation");
  const themes = await listerThemes(getDb());
  const mois = (m: number | null | undefined) =>
    m ? new Intl.DateTimeFormat(locale, { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2026, m - 1, 1))) : "—";

  return (
    <EspaceAdmin locale={locale} actif="sensibilisation">
      <TitrePage surtitre={t("surtitre")} titre={t("title")} />
      <p className="mb-4 max-w-[70ch] text-ima-muted">{t("intro")}</p>
      <p className="mb-8">
        <Link href="/admin/sensibilisation/alertes" className="inline-block rounded-md border border-ima-navy px-4 py-2 font-semibold text-ima-navy hover:bg-ima-cream">
          {t("alertsLink")}
        </Link>
      </p>

      {themes.length === 0 ? (
        <p className="mb-10">{t("empty")}</p>
      ) : (
        <div className="mb-12">
          <Tableau entetes={[t("colTheme"), t("colMonth"), t("colLanguages"), t("colStatus")]}>
            {[...themes]
              .sort((a, b) => (a.fiche?.mois ?? 13) - (b.fiche?.mois ?? 13))
              .map((th) => (
                <tr key={th.id}>
                  <Cellule>
                    <Link href={`/admin/sensibilisation/${th.id}`} className="font-semibold text-ima-navy underline">
                      {th.kitsLus.fr?.titre || th.code}
                    </Link>
                    {th.fiche?.sensible && <span className="ml-2 text-xs font-semibold text-repere-prioritaire">{t("sensitive")}</span>}
                    {th.fiche?.journee && <span className="block text-sm text-ima-muted">{th.fiche.journee}</span>}
                  </Cellule>
                  <Cellule>{mois(th.fiche?.mois)}</Cellule>
                  <Cellule>
                    {LANGUES_THEME.map((lg) => (
                      <span key={lg} className={`mr-2 text-sm ${kitComplet(th.kitsLus[lg]) ? "font-semibold text-repere-favorable" : "text-ima-muted"}`}>
                        {lg}
                      </span>
                    ))}
                  </Cellule>
                  <Cellule>{t(`statuts.${th.status}`)}</Cellule>
                </tr>
              ))}
          </Tableau>
        </div>
      )}

      <section aria-labelledby="nouveau" className="max-w-3xl">
        <h2 id="nouveau" className="mb-4 text-xl">{t("newTitle")}</h2>
        <FormulaireAction action={actionCreerTheme.bind(null, locale)} libelle={t("create")} enCours={t("creating")}>
          <Champ id="titre" name="titre" label={t("fieldTitle")} required maxLength={120} />
          <ZoneTexte id="objectif" name="objectif" label={t("fieldObjective")} maxLength={500} />
          <ChampsFiche />
        </FormulaireAction>
      </section>
    </EspaceAdmin>
  );
}
