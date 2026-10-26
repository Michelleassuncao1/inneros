// Champs de la fiche d'un thème de sensibilisation (création et modification)
import { getTranslations } from "next-intl/server";
import { CasesACocher, Champ, Selection } from "@/components/Formulaire";
import { NIVEAUX_MINDSET } from "@/lib/rapport/contenu";
import { EVENEMENTS_THEME, type FicheTheme } from "@/lib/sensibilisation/contenu";

export async function ChampsFiche({ fiche, locale = "fr" }: { fiche?: FicheTheme | null; locale?: string }) {
  const t = await getTranslations("Sensibilisation");
  const tres = await getTranslations("Resultats");
  const l = await getTranslations("Libelles");
  const tcal = await getTranslations("Calendrier");
  const mois = Array.from({ length: 12 }, (_, i) => ({
    valeur: String(i + 1),
    libelle: new Intl.DateTimeFormat(locale, { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2026, i, 1))),
  }));
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Champ id="code" name="code" label={t("fieldCode")} aide={t("fieldCodeHelp")} required pattern="[a-z0-9-]{3,40}" defaultValue={fiche?.code ?? ""} />
        <Selection id="mois" name="mois" label={t("fieldMonth")} options={[{ valeur: "", libelle: "—" }, ...mois]} defaultValue={fiche?.mois ? String(fiche.mois) : ""} />
      </div>
      <Champ id="journee" name="journee" label={t("fieldDay")} aide={t("fieldDayHelp")} maxLength={120} defaultValue={fiche?.journee ?? ""} />
      <Selection
        id="niveau"
        name="niveau"
        label={t("fieldLevel")}
        options={[{ valeur: "", libelle: "—" }, ...NIVEAUX_MINDSET.map((n) => ({ valeur: n, libelle: tres(`levels.${n}`) }))]}
        defaultValue={fiche?.niveau_mindset ?? ""}
      />
      <Champ id="echelles" name="echelles" label={t("fieldScales")} aide={t("fieldScalesHelp")} defaultValue={fiche?.echelles.join(", ") ?? ""} />
      <label className="flex items-start gap-2">
        <input type="checkbox" name="sensible" value="oui" defaultChecked={fiche?.sensible} className="mt-1 h-5 w-5 accent-ima-navy" />
        <span>{t("fieldSensitive")}</span>
      </label>
      <CasesACocher
        legende={t("fieldCountries")}
        name="pays"
        options={(["BE", "FR", "BR", "PT"] as const).map((p) => ({ valeur: p, libelle: l(`country.${p}`) }))}
        cochees={fiche?.pays ?? []}
        aide={t("fieldCountriesHelp")}
      />
      <CasesACocher
        legende={t("fieldEvents")}
        name="evenements"
        options={EVENEMENTS_THEME.map((e) => ({ valeur: e, libelle: tcal(`evenements.${e}`) }))}
        cochees={fiche?.evenements ?? []}
        aide={t("fieldEventsHelp")}
      />
    </>
  );
}
