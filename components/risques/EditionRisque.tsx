// Modification d'un risque du registre (IMA ou conseiller en prévention)
import { getTranslations } from "next-intl/server";
import { actionModifierRisque, actionSupprimerRisque } from "@/app/[locale]/registre/actions";
import { FormulaireAction } from "@/components/FormulaireAction";
import type { users } from "@/lib/db/schema";
import { getDb } from "@/lib/db/client";
import { lireRegistre } from "@/lib/risques/registre";
import { lireResultats } from "@/lib/resultats/agregats";
import { BoutonSupprimer } from "./BoutonSupprimer";
import { ChampsRisque } from "./ChampsRisque";
import { BadgeClasse } from "./Registre";

export async function EditionRisque({
  utilisateur,
  organizationId,
  riskId,
  locale,
}: {
  utilisateur: typeof users.$inferSelect;
  organizationId: string;
  riskId: string;
  locale: string;
}) {
  const t = await getTranslations("Risques");
  const db = getDb();
  const r = (await lireRegistre(db, utilisateur, organizationId))?.find((x) => x.id === riskId);
  if (!r) return null;
  // Groupes possibles : ceux présentés dans les résultats de la campagne d'origine (jamais pour un comportement)
  const groupes =
    r.source === "echelle" && r.campaignId ? ((await lireResultats(db, r.campaignId, locale))?.groupes.map((g) => g.libelle) ?? []) : [];
  const nombre = (v: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(v);

  return (
    <div className="flex flex-col gap-8">
      <p className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-ima-muted">{t(`sources.${r.source}`)}</span>
        <span className="font-semibold">
          {t("colScore")} : {nombre(r.score)}
        </span>
        <BadgeClasse classe={r.classe} />
      </p>
      <FormulaireAction action={actionModifierRisque.bind(null, locale, r.id)} libelle={t("save")} enCours={t("saving")}>
        <ChampsRisque
          id="risque"
          avecStatut
          groupesPossibles={groupes}
          valeurs={{
            titre: r.title,
            description: r.description,
            niveau: r.mindsetLevel,
            groupes: r.groupLabels,
            p: r.p,
            e: r.e,
            g: r.g,
            justification: r.justification,
            statut: r.status,
          }}
        />
      </FormulaireAction>
      {r.source !== "comportement" && (
        <BoutonSupprimer action={actionSupprimerRisque.bind(null, locale, r.id)} libelle={t("delete")} confirmation={t("deleteConfirm")} />
      )}
    </div>
  );
}
