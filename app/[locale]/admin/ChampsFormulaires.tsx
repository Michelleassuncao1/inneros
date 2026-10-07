// Champs des formulaires entreprise et campagne, partagés entre création et modification.
import { getTranslations } from "next-intl/server";
import { CasesACocher, Champ, Selection, ZoneTexte } from "@/components/Formulaire";
import { MANDATS, seuilPlateforme } from "@/lib/admin/campagnes";
import { LANGUES, PAYS, TRANCHES } from "@/lib/admin/entreprises";

type Entreprise = {
  name: string;
  country: string;
  locale: string;
  sector: string;
  sizeBand: string;
};

export async function ChampsEntreprise({ valeurs }: { valeurs?: Entreprise }) {
  const t = await getTranslations("Entreprises");
  const l = await getTranslations("Libelles");
  return (
    <>
      <Champ id="name" name="name" label={t("name")} defaultValue={valeurs?.name} required maxLength={120} />
      <Selection
        id="country"
        name="country"
        label={t("country")}
        defaultValue={valeurs?.country ?? "BE"}
        options={PAYS.map((p) => ({ valeur: p, libelle: l(`country.${p}`) }))}
      />
      <p className="-mt-3 text-sm text-ima-muted">{t("countryHelp")}</p>
      <Selection
        id="locale"
        name="locale"
        label={t("locale")}
        defaultValue={valeurs?.locale ?? "fr"}
        options={LANGUES.map((p) => ({ valeur: p, libelle: l(`locale.${p}`) }))}
      />
      <Champ id="sector" name="sector" label={t("sector")} defaultValue={valeurs?.sector} required maxLength={120} />
      <Selection
        id="sizeBand"
        name="sizeBand"
        label={t("sizeBand")}
        defaultValue={valeurs?.sizeBand ?? "50-249"}
        options={TRANCHES.map((p) => ({ valeur: p, libelle: l(`sizeBand.${p}`) }))}
      />
    </>
  );
}

type Campagne = {
  mandateType: string;
  mandateReference: string;
  diagnosticQuestion: string | null;
  perimeter: string | null;
  groupMinSize: number;
  startDate: string;
  endDate: string;
  locales: string[];
};

export async function ChampsCampagne({
  valeurs,
  langueParDefaut,
}: {
  valeurs?: Campagne;
  langueParDefaut: string;
}) {
  const t = await getTranslations("Campagnes");
  const l = await getTranslations("Libelles");
  return (
    <>
      <Selection
        id="mandateType"
        name="mandateType"
        label={t("mandateType")}
        defaultValue={valeurs?.mandateType ?? "n1"}
        options={MANDATS.map((m) => ({ valeur: m, libelle: l(`mandate.${m}`) }))}
      />
      <Champ
        id="mandateReference"
        name="mandateReference"
        label={t("mandateReference")}
        defaultValue={valeurs?.mandateReference}
        required
        maxLength={120}
      />
      <ZoneTexte
        id="diagnosticQuestion"
        name="diagnosticQuestion"
        label={t("diagnosticQuestion")}
        aide={t("diagnosticQuestionHelp")}
        defaultValue={valeurs?.diagnosticQuestion ?? ""}
        maxLength={2000}
      />
      <ZoneTexte
        id="perimeter"
        name="perimeter"
        label={t("perimeter")}
        defaultValue={valeurs?.perimeter ?? ""}
        maxLength={2000}
      />
      <Champ
        id="groupMinSize"
        name="groupMinSize"
        type="number"
        min={seuilPlateforme()}
        label={t("groupMinSize")}
        aide={t("groupMinSizeHelp")}
        defaultValue={valeurs?.groupMinSize ?? seuilPlateforme()}
        required
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <Champ id="startDate" name="startDate" type="date" label={t("startDate")} defaultValue={valeurs?.startDate} required />
        <Champ id="endDate" name="endDate" type="date" label={t("endDate")} defaultValue={valeurs?.endDate} required />
      </div>
      <CasesACocher
        legende={t("locales")}
        name="locales"
        options={LANGUES.map((p) => ({ valeur: p, libelle: l(`locale.${p}`) }))}
        cochees={valeurs?.locales ?? [langueParDefaut]}
      />
    </>
  );
}
