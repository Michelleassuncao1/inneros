// Alertes réglementaires d'IMA (module B3) : ciblées par pays et, au besoin, par secteur. Chaque alerte propose
// ses thèmes aux entreprises concernées et prévient leur conseiller en prévention par e-mail.
import { getTranslations, setRequestLocale } from "next-intl/server";
import { EspaceAdmin, TitrePage } from "@/components/EspaceAdmin";
import { CasesACocher, Champ, Selection, ZoneTexte } from "@/components/Formulaire";
import { FormulaireAction } from "@/components/FormulaireAction";
import { Link } from "@/i18n/navigation";
import { exigerAdmin } from "@/lib/auth/acces";
import { getDb } from "@/lib/db/client";
import { listerAlertes, secteursConnus } from "@/lib/sensibilisation/declencheurs";
import { listerThemes } from "@/lib/sensibilisation/themes";
import { actionCreerAlerte, actionRetirerAlerte } from "../actions";

export default async function AlertesPage({ params }: PageProps<"/[locale]/admin/sensibilisation/alertes">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await exigerAdmin(locale);
  const t = await getTranslations("Sensibilisation");
  const l = await getTranslations("Libelles");
  const db = getDb();
  const alertes = await listerAlertes(db);
  const secteurs = await secteursConnus(db);
  const themes = (await listerThemes(db)).filter((th) => th.status === "validated");
  const titre = (id: string) => {
    const th = themes.find((x) => x.id === id);
    return th ? th.kitsLus.fr?.titre || th.code : "—";
  };
  const nomMois = (m: number, a: number) => new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(a, m - 1, 1)));
  const annee = new Date().getFullYear();

  return (
    <EspaceAdmin locale={locale} actif="sensibilisation">
      <TitrePage surtitre={t("title")} titre={t("alertsTitle")} />
      <p className="mb-4 max-w-[70ch] text-ima-muted">{t("alertsIntro")}</p>
      <p className="mb-8">
        <Link href="/admin/sensibilisation" className="font-semibold text-ima-navy underline">
          {t("back")}
        </Link>
      </p>

      {alertes.length === 0 ? (
        <p className="mb-10">{t("alertsEmpty")}</p>
      ) : (
        <ul className="mb-12 flex max-w-3xl flex-col gap-3">
          {alertes.map((a) => (
            <li key={a.id} className={`rounded-md border bg-white p-4 ${a.withdrawnAt ? "border-ima-line opacity-60" : "border-ima-gold"}`}>
              <p className="font-semibold text-ima-navy">{a.title}</p>
              <p className="mt-1 whitespace-pre-line text-sm">{a.message}</p>
              <p className="mt-2 text-sm text-ima-muted">
                {a.countries.map((p) => l(`country.${p}`)).join(", ")} · {a.sectors?.join(", ") ?? t("allSectors")} · {nomMois(a.month, a.year)}
              </p>
              <p className="text-sm text-ima-muted">{a.themeIds.map(titre).join(" · ")}</p>
              {a.withdrawnAt ? (
                <p className="mt-2 text-sm font-semibold">{t("alertIsWithdrawn")}</p>
              ) : (
                <div className="mt-3">
                  <FormulaireAction action={actionRetirerAlerte.bind(null, locale, a.id)} libelle={t("alertWithdraw")} enCours={t("saving")} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <section aria-labelledby="nouvelle" className="max-w-3xl">
        <h2 id="nouvelle" className="mb-4 text-xl">{t("alertNew")}</h2>
        {themes.length === 0 ? (
          <p>{t("alertNoTheme")}</p>
        ) : (
          <FormulaireAction action={actionCreerAlerte.bind(null, locale)} libelle={t("alertCreate")} enCours={t("saving")} viderApresSucces>
            <Champ id="titre" name="titre" label={t("alertFieldTitle")} required minLength={3} maxLength={120} />
            <ZoneTexte id="message" name="message" label={t("alertFieldMessage")} aide={t("alertFieldMessageHelp")} required maxLength={1000} rows={5} />
            <CasesACocher legende={t("fieldCountries")} name="pays" options={(["BE", "FR", "BR", "PT"] as const).map((p) => ({ valeur: p, libelle: l(`country.${p}`) }))} cochees={[]} />
            {secteurs.length > 0 && (
              <CasesACocher legende={t("alertFieldSectors")} name="secteurs" options={secteurs.map((s) => ({ valeur: s, libelle: s }))} cochees={[]} aide={t("alertFieldSectorsHelp")} />
            )}
            <CasesACocher
              legende={t("alertFieldThemes")}
              name="themes"
              options={themes.map((th) => ({ valeur: th.id, libelle: th.kitsLus.fr?.titre || th.code }))}
              cochees={[]}
              aide={t("alertFieldThemesHelp")}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Selection
                id="mois"
                name="mois"
                label={t("fieldMonth")}
                options={Array.from({ length: 12 }, (_, i) => ({
                  valeur: String(i + 1),
                  libelle: new Intl.DateTimeFormat(locale, { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2026, i, 1))),
                }))}
                defaultValue={String(new Date().getMonth() + 2 > 12 ? 1 : new Date().getMonth() + 2)}
              />
              <Champ id="annee" name="annee" type="number" min={annee} max={annee + 2} label={t("alertFieldYear")} required defaultValue={String(annee)} />
            </div>
          </FormulaireAction>
        )}
      </section>
    </EspaceAdmin>
  );
}
