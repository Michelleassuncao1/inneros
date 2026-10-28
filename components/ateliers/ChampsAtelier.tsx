// Champs du formulaire d'un atelier (création et modification), module C
import { getTranslations } from "next-intl/server";
import { Champ, Selection, ZoneTexte } from "@/components/Formulaire";
import { TYPES_ATELIER } from "@/lib/ateliers/ateliers";

export type ValeursAtelier = {
  type: string;
  titre: string;
  description: string;
  date: string;
  heure: string;
  duree: number;
  lieu: string;
  places: number;
  animateur: string;
  campagne: string;
  action: string;
  appui: boolean;
  demandeAppui: string;
};

export async function ChampsAtelier({
  prefixe,
  valeurs,
  campagnes,
  actions,
  aujourdhui,
  appuiVerrouille = false,
}: {
  prefixe: string;
  valeurs?: ValeursAtelier;
  campagnes: { valeur: string; libelle: string }[];
  actions: { valeur: string; libelle: string }[];
  aujourdhui: string;
  appuiVerrouille?: boolean; // IMA a déjà répondu à la demande d'appui
}) {
  const t = await getTranslations("Ateliers");
  const id = (nom: string) => `${prefixe}-${nom}`;
  return (
    <>
      <Selection id={id("type")} name="type" label={t("typeLabel")} options={TYPES_ATELIER.map((x) => ({ valeur: x, libelle: t(`types.${x}`) }))} defaultValue={valeurs?.type} />
      <Champ id={id("titre")} name="titre" label={t("titleLabel")} aide={t("titleHelp")} required minLength={3} maxLength={120} defaultValue={valeurs?.titre} />
      <ZoneTexte id={id("description")} name="description" label={t("description")} aide={t("descriptionHelp")} maxLength={1000} defaultValue={valeurs?.description} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Champ id={id("date")} name="date" type="date" min={aujourdhui} label={t("date")} required defaultValue={valeurs?.date} />
        <Champ id={id("heure")} name="heure" type="time" label={t("time")} required defaultValue={valeurs?.heure ?? "12:00"} />
        <Champ id={id("duree")} name="duree" type="number" min={5} max={600} label={t("duration")} required defaultValue={valeurs?.duree ?? 60} />
      </div>
      <Champ id={id("lieu")} name="lieu" label={t("place")} required minLength={2} maxLength={300} defaultValue={valeurs?.lieu} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Champ id={id("places")} name="places" type="number" min={1} max={500} label={t("capacity")} aide={t("capacityHelp")} required defaultValue={valeurs?.places ?? 12} />
        <Champ id={id("animateur")} name="animateur" label={t("facilitator")} aide={t("facilitatorHelp")} maxLength={120} defaultValue={valeurs?.animateur} />
      </div>
      {campagnes.length > 0 && (
        <Selection id={id("campagne")} name="campagne" label={t("campaign")} options={[{ valeur: "", libelle: t("noCampaign") }, ...campagnes]} defaultValue={valeurs?.campagne ?? ""} />
      )}
      {actions.length > 0 && (
        <Selection id={id("action")} name="action" label={t("planAction")} options={[{ valeur: "", libelle: t("noAction") }, ...actions]} defaultValue={valeurs?.action ?? ""} />
      )}
      {appuiVerrouille ? (
        <input type="hidden" name="appui" value="on" />
      ) : (
        <>
          <label className="flex items-start gap-2">
            <input type="checkbox" name="appui" defaultChecked={valeurs?.appui} className="mt-1 h-5 w-5 accent-ima-navy" />
            <span className="font-semibold text-ima-navy">{t("support")}</span>
          </label>
          <ZoneTexte id={id("demandeAppui")} name="demandeAppui" label={t("supportRequest")} aide={t("supportRequestHelp")} maxLength={500} defaultValue={valeurs?.demandeAppui} />
        </>
      )}
    </>
  );
}
