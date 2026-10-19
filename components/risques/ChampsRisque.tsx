// Champs d'un risque (formulaires d'ajout et de modification du registre). Composant serveur :
// rendu comme contenu du formulaire FormulaireAction.
import { getTranslations } from "next-intl/server";
import { CasesACocher, Champ, Selection, ZoneTexte } from "@/components/Formulaire";
import { cleValeur, EXPOSITIONS, GRAVITES, PROBABILITES } from "@/lib/risques/kinney";
import { NIVEAUX_MINDSET } from "@/lib/rapport/contenu";

export type ValeursRisque = {
  titre?: string;
  description?: string | null;
  niveau?: string | null;
  groupes?: string[];
  p?: number;
  e?: number;
  g?: number;
  justification?: string | null;
  statut?: string;
};

export async function ChampsRisque({
  id,
  valeurs = {},
  groupesPossibles = [],
  avecStatut = false,
}: {
  id: string; // préfixe des identifiants, unique sur la page
  valeurs?: ValeursRisque;
  groupesPossibles?: string[];
  avecStatut?: boolean;
}) {
  const t = await getTranslations("Risques");
  const tres = await getTranslations("Resultats");
  const options = (liste: readonly number[], cle: "probabilites" | "expositions" | "gravites") => [
    ...(cle === "gravites" ? [{ valeur: "", libelle: t("choose") }] : []),
    ...liste.map((v) => ({ valeur: String(v), libelle: `${String(v).replace(".", ",")} — ${t(`${cle}.${cleValeur(v)}`)}` })),
  ];
  return (
    <>
      <Champ id={`${id}-titre`} name="titre" label={t("fieldTitle")} required maxLength={200} defaultValue={valeurs.titre ?? ""} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Selection id={`${id}-p`} name="p" label={t("fieldP")} options={options(PROBABILITES, "probabilites")} defaultValue={String(valeurs.p ?? 1)} required />
        <Selection id={`${id}-e`} name="e" label={t("fieldE")} options={options(EXPOSITIONS, "expositions")} defaultValue={String(valeurs.e ?? 6)} required />
        <Selection id={`${id}-g`} name="g" label={t("fieldG")} options={options(GRAVITES, "gravites")} defaultValue={valeurs.g ? String(valeurs.g) : ""} required />
      </div>
      <Selection
        id={`${id}-niveau`}
        name="niveau"
        label={t("fieldLevel")}
        options={[{ valeur: "", libelle: t("noLevel") }, ...NIVEAUX_MINDSET.map((n) => ({ valeur: n, libelle: tres(`levels.${n}`) }))]}
        defaultValue={valeurs.niveau ?? ""}
      />
      {groupesPossibles.length > 0 && (
        <CasesACocher
          legende={t("fieldGroups")}
          name="groupes"
          options={groupesPossibles.map((g) => ({ valeur: g, libelle: g }))}
          cochees={valeurs.groupes ?? []}
          aide={t("groupsHelp")}
        />
      )}
      <ZoneTexte id={`${id}-description`} name="description" label={t("fieldDescription")} aide={t("noNames")} maxLength={2000} defaultValue={valeurs.description ?? ""} />
      <ZoneTexte id={`${id}-justification`} name="justification" label={t("fieldJustification")} aide={t("noNames")} maxLength={2000} defaultValue={valeurs.justification ?? ""} />
      {avecStatut && (
        <Selection
          id={`${id}-statut`}
          name="statut"
          label={t("fieldStatus")}
          options={(["ouvert", "traite", "clos"] as const).map((s) => ({ valeur: s, libelle: t(`statuts.${s}`) }))}
          defaultValue={valeurs.statut ?? "ouvert"}
        />
      )}
    </>
  );
}
