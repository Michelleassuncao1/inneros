// Assemble le contenu du kit d'information (F13) pour une campagne, dans une langue donnée.
// Le pays de l'entreprise fixe le cadre légal et les numéros d'aide.
import { getTranslations } from "next-intl/server";
import { aidesPour, FICHES_PAYS, type CodePays } from "../pays";
import type { Contact, SoutienIma } from "../admin/soutien";
import type { ContenuKit } from "./kit";

export async function contenuKit({
  langue,
  entreprise,
  pays,
  debut,
  fin,
  seuil,
  critere,
  soutien,
}: {
  langue: string;
  entreprise: string;
  pays: string;
  debut: string;
  fin: string;
  seuil: number;
  critere: string;
  soutien: { contacts: Contact[]; ima: SoutienIma | null };
}): Promise<ContenuKit> {
  const ts = await getTranslations({ locale: langue, namespace: "Soutien" });
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
      organisation: soutien.contacts.length
        ? {
            titre: ts("orgTitle"),
            lignes: soutien.contacts.map((c) => ({
              libelle: c.role === "autre" ? (c.fonction ?? "") : ts(`roles.${c.role}`),
              coordonnees: [c.nom, c.telephone, c.email].filter(Boolean).join(" · "),
            })),
          }
        : undefined,
      ima: soutien.ima
        ? {
            titre: ts("imaRespTitle"),
            lignes: [
              soutien.ima.telephone && `${ts("telephone")} : ${soutien.ima.telephone}`,
              soutien.ima.email && `${ts("email")} : ${soutien.ima.email}`,
              soutien.ima.lien && `${ts("rendezVous")} : ${soutien.ima.lien}`,
              soutien.ima.horaires && `${ts("horaires")} : ${soutien.ima.horaires}`,
            ].filter((l): l is string => !!l),
            avertissements: [ts("imaAvert1"), ts("imaAvert2"), ts("imaAvert3")],
          }
        : undefined,
    },
    contact: t("contact"),
  };
}
