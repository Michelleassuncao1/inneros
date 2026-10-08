// Assemble le contenu du kit d'information (F13) pour une campagne, dans une langue donnée.
// Le pays de l'entreprise fixe le cadre légal et les numéros d'aide.
import { getTranslations } from "next-intl/server";
import { aidesPour, FICHES_PAYS, type CodePays } from "../pays";
import type { ContenuKit } from "./kit";

export async function contenuKit({
  langue,
  entreprise,
  pays,
  debut,
  fin,
  seuil,
  critere,
}: {
  langue: string;
  entreprise: string;
  pays: string;
  debut: string;
  fin: string;
  seuil: number;
  critere: string;
}): Promise<ContenuKit> {
  const t = await getTranslations({ locale: langue, namespace: "Kit" });
  const p = await getTranslations({ locale: langue, namespace: "Pays" });
  const l = await getTranslations({ locale: langue, namespace: "Libelles" });
  const fiche = FICHES_PAYS[pays as CodePays];
  const date = (d: string) =>
    new Intl.DateTimeFormat(langue, { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));

  return {
    marque: t("brand"),
    titre: t("title"),
    sousTitre: t("subtitle", { entreprise }),
    periode: t("period", { debut: date(debut), fin: date(fin) }),
    // Tant que le texte n'est pas validé par IMA, chaque kit porte la mention « version de travail »
    versionDeTravail: t("workingVersion"),
    sections: [
      { titre: t("whyTitle"), paragraphes: [t("why", { entreprise })] },
      { titre: t("howTitle"), paragraphes: [t("how", { critere: l(`grouping.${critere}`).toLowerCase() })] },
      {
        titre: t("anonymityTitle"),
        puces: [
          t("anonymity1"),
          t("anonymity2"),
          t("anonymity3"),
          t("anonymity4"),
          t("anonymity5", { seuil }),
          t("anonymity6"),
        ],
      },
      { titre: t("whoTitle"), paragraphes: [t("who")] },
      { titre: t("freeTitle"), paragraphes: [t("free")] },
      { titre: t("aiTitle"), paragraphes: fiche.ue ? [t("ai"), t("aiEu")] : [t("ai")] },
      {
        titre: t("legalTitle"),
        paragraphes: [p(`${pays}.legal`)],
        aValider: fiche.cadreAValider ? t("toValidate") : undefined,
      },
    ],
    aides: {
      titre: t("helpTitle"),
      intro: t("help"),
      numeros: aidesPour(pays, langue).map((a) => ({ numero: a.numero, libelle: p(`${pays}.aides.${a.cle}`) })),
    },
    contact: t("contact"),
  };
}
