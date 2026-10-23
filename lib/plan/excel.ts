// Export Excel du plan de prévention (module A3, partie 2) : une feuille « Plan d'action » (une ligne par
// action, avec son état) et une feuille « Registre des risques ». Textes dans la langue de l'interface.
import ExcelJS from "exceljs";
import { traducteur } from "../traduction";
import type { DonneesPlan } from "./export";

const NAVY = "FF08275A";

export async function excelPlan(d: DonneesPlan, langue: string) {
  const t = traducteur(langue, "Plan");
  const tr = traducteur(langue, "Risques");
  const tres = traducteur(langue, "Resultats");
  const titres = new Map(d.registre.map((r) => [r.id, r.title]));
  const classeur = new ExcelJS.Workbook();
  classeur.creator = "InnerOS — Institut Mindset en Action";
  classeur.created = new Date();

  const entete = (feuille: ExcelJS.Worksheet) => {
    const ligne = feuille.getRow(1);
    ligne.font = { bold: true, color: { argb: "FFFFFFFF" } };
    ligne.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    ligne.alignment = { vertical: "middle", wrapText: true };
    feuille.views = [{ state: "frozen", ySplit: 1 }];
  };

  // Feuille 1 : plan d'action
  const actions = classeur.addWorksheet(t("excelActions"));
  actions.columns = [
    { header: t("colNum"), key: "n", width: 5 },
    { header: t("colAction"), key: "titre", width: 40 },
    { header: t("actionDescription"), key: "description", width: 50 },
    { header: t("risquesVises"), key: "risques", width: 40 },
    { header: t("niveauPrevention"), key: "niveau", width: 22 },
    { header: t("colResponsable"), key: "responsable", width: 24 },
    { header: t("colEcheance"), key: "echeance", width: 12 },
    { header: t("colEffort"), key: "effort", width: 12 },
    { header: t("colBudget"), key: "budget", width: 22 },
    { header: t("colIndicateur"), key: "indicateur", width: 40 },
    { header: t("colStatut"), key: "statut", width: 14 },
    { header: t("doneOn"), key: "fait", width: 14 },
    { header: t("comment"), key: "commentaire", width: 40 },
  ];
  [...d.contenu.actions]
    .sort((a, b) => a.trimestre - b.trimestre)
    .forEach((a, i) => {
      const suivi = d.avancement.get(a.id);
      actions.addRow({
        n: i + 1,
        titre: a.titre,
        description: a.description,
        risques: a.risques.map((id) => titres.get(id) ?? t("unknownRisk")).join(" ; "),
        niveau: t(`niveaux.${a.niveau_prevention}`),
        responsable: a.responsable,
        echeance: `${t("trimestre", { n: a.trimestre })} ${d.plan.actionYear}`,
        effort: t(`efforts.${a.effort}`),
        budget: a.budget,
        indicateur: a.indicateur,
        statut: t(`statutsAction.${suivi?.status ?? "a_faire"}`),
        fait: suivi?.doneOn ?? "",
        commentaire: suivi?.comment ?? "",
      });
    });
  actions.eachRow((r) => (r.alignment = { vertical: "top", wrapText: true }));
  entete(actions);

  // Feuille 2 : registre des risques
  const registre = classeur.addWorksheet(t("excelRisques"));
  registre.columns = [
    { header: tr("colRisk"), key: "titre", width: 40 },
    { header: tr("fieldDescription"), key: "description", width: 50 },
    { header: tr("fieldLevel"), key: "niveau", width: 22 },
    { header: tr("fieldGroups"), key: "groupes", width: 24 },
    { header: "P", key: "p", width: 6 },
    { header: "E", key: "e", width: 6 },
    { header: "G", key: "g", width: 6 },
    { header: tr("colScore"), key: "score", width: 9 },
    { header: tr("colClass"), key: "classe", width: 14 },
    { header: tr("colStatus"), key: "statut", width: 12 },
    { header: tr("fieldJustification"), key: "justification", width: 40 },
  ];
  for (const r of d.registre) {
    registre.addRow({
      titre: `${r.title} (${tr(`sources.${r.source}`)})`,
      description: r.description ?? "",
      niveau: r.mindsetLevel ? tres(`levels.${r.mindsetLevel}`) : "",
      groupes: r.groupLabels.join(", "),
      p: r.p,
      e: r.e,
      g: r.g,
      score: r.score,
      classe: tr(`classes.${r.classe}`),
      statut: tr(`statuts.${r.status}`),
      justification: r.justification ?? "",
    });
  }
  registre.eachRow((r) => (r.alignment = { vertical: "top", wrapText: true }));
  entete(registre);

  return Buffer.from(await classeur.xlsx.writeBuffer());
}
