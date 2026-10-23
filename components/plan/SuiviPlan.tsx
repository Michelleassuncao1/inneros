// Suivi d'un plan validé (module A3) : adoption par l'entreprise, tableau de bord et avancement des actions.
// Commun à l'espace IMA et à l'espace référent (signataire ou conseiller en prévention).
import { eq } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { actionAdopterPlan, actionAvancement } from "@/app/[locale]/plan-suivi/actions";
import { Champ, MessageInfo, Selection } from "@/components/Formulaire";
import { FormulaireAction } from "@/components/FormulaireAction";
import { getDb } from "@/lib/db/client";
import { preventionPlans, users } from "@/lib/db/schema";
import { lireContenuPlan } from "@/lib/plan/contenu";
import { lireAvancement, ORGANES, STATUTS_ACTION, tableauDeBord } from "@/lib/plan/suivi";

export async function SuiviPlan({
  plan,
  locale,
  peutAdopter,
  peutSuivre,
}: {
  plan: typeof preventionPlans.$inferSelect;
  locale: string;
  peutAdopter: boolean;
  peutSuivre: boolean;
}) {
  const t = await getTranslations("Plan");
  const db = getDb();
  const contenu = lireContenuPlan(plan.content);
  if (!contenu) return null;
  const statuts = await lireAvancement(db, plan.id);
  const bord = tableauDeBord(contenu, plan.actionYear, statuts);
  const date = (d: string) => new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));
  const [adoptant] = plan.adoptedBy ? await db.select({ name: users.name }).from(users).where(eq(users.id, plan.adoptedBy)) : [];
  const aujourdhui = new Date().toISOString().slice(0, 10);

  const bouton = "inline-block rounded-md border border-ima-navy px-4 py-2 font-semibold text-ima-navy hover:bg-ima-cream";
  return (
    <div className="flex flex-col gap-10">
      {/* Téléchargements */}
      <section aria-labelledby="telechargements" className="flex flex-col gap-2">
        <h2 id="telechargements" className="text-lg">{t("downloadsTitle")}</h2>
        <p className="flex flex-wrap gap-3">
          <a href={`/api/plan/${plan.id}/pdf?lang=${locale}`} className={bouton}>{t("downloadPdf")}</a>
          <a href={`/api/plan/${plan.id}/excel?lang=${locale}`} className={bouton}>{t("downloadExcel")}</a>
          {peutSuivre && <a href={`/api/plan/${plan.id}/pluriprev`} className={bouton}>{t("downloadPluriprev")}</a>}
        </p>
        {peutSuivre && <p className="max-w-[70ch] text-sm text-ima-muted">{t("pluriprevHelp")}</p>}
      </section>

      {/* Adoption par l'employeur */}
      <section aria-labelledby="adoption" className="max-w-3xl rounded-md border-l-[3px] border-ima-gold bg-ima-cream px-5 py-4">
        <h2 id="adoption" className="text-xl">{t("adoptionTitle")}</h2>
        {plan.adoptedAt ? (
          <p className="mt-2">
            {t("adoptedMeta", {
              nom: adoptant?.name ?? "—",
              date: date(plan.adoptedAt),
              organe: t(`organes.${plan.consultationBody ?? "aucun_cse"}`),
              avis: plan.consultationDate ? date(plan.consultationDate) : "—",
            })}
          </p>
        ) : peutAdopter ? (
          <div className="mt-2 flex flex-col gap-3">
            <p className="text-sm">{t("adoptionHelp")}</p>
            {plan.country === "BE" && <p className="text-sm font-semibold">{t("adoptionBE")}</p>}
            <FormulaireAction action={actionAdopterPlan.bind(null, locale, plan.id)} libelle={t("adopt")} enCours={t("adopting")}>
              <Selection
                id="organe"
                name="organe"
                label={t("organe")}
                options={(ORGANES[plan.country] ?? []).map((o) => ({ valeur: o, libelle: t(`organes.${o}`) }))}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Champ id="avisLe" name="avisLe" type="date" max={aujourdhui} label={t("avisLe")} aide={t("avisLeHelp")} />
                <Champ id="adopteLe" name="adopteLe" type="date" max={aujourdhui} label={t("adopteLe")} required defaultValue={aujourdhui} />
              </div>
            </FormulaireAction>
          </div>
        ) : (
          <p className="mt-2 text-sm">{t("notAdopted")}</p>
        )}
      </section>

      {/* Tableau de bord */}
      <section aria-labelledby="bord" className="flex flex-col gap-4">
        <h2 id="bord" className="text-xl">{t("dashboardTitle", { annee: plan.actionYear })}</h2>
        <div className="flex flex-wrap gap-4">
          <div className="rounded-md border border-ima-line bg-white px-5 py-3">
            <p className="text-3xl font-semibold text-ima-navy">{bord.pourcentage} %</p>
            <p className="text-sm text-ima-muted">{t("doneCount", { faites: bord.realisees, total: bord.total })}</p>
          </div>
          <div className={`rounded-md border bg-white px-5 py-3 ${bord.enRetard.length ? "border-repere-prioritaire" : "border-ima-line"}`}>
            <p className={`text-3xl font-semibold ${bord.enRetard.length ? "text-repere-prioritaire" : "text-ima-navy"}`}>{bord.enRetard.length}</p>
            <p className="text-sm text-ima-muted">{t("lateCount", { n: bord.enRetard.length })}</p>
          </div>
          {bord.parTrimestre.map((q) => (
            <div key={q.trimestre} className="rounded-md border border-ima-line bg-white px-5 py-3">
              <p className="text-xl font-semibold text-ima-navy">
                {q.realisees}/{q.total}
              </p>
              <p className="text-sm text-ima-muted">{t("trimestre", { n: q.trimestre })} {plan.actionYear}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Avancement action par action */}
      <section aria-labelledby="avancement" className="flex flex-col gap-3">
        <h2 id="avancement" className="text-xl">{t("progressTitle")}</h2>
        {!peutSuivre && <MessageInfo>{t("progressReadOnly")}</MessageInfo>}
        {[...bord.actions]
          .sort((a, b) => Number(b.enRetard) - Number(a.enRetard) || a.trimestre - b.trimestre)
          .map((a) => {
            const ligne = statuts.get(a.id);
            return (
              <div key={a.id} className={`rounded-md border bg-white p-4 ${a.enRetard ? "border-repere-prioritaire" : "border-ima-line"}`}>
                <p className="font-semibold">
                  {a.titre}
                  <span className="ml-2 text-sm font-normal text-ima-muted">
                    {t("trimestre", { n: a.trimestre })} {plan.actionYear} · {a.responsable} · {t(`efforts.${a.effort}`)}
                  </span>
                </p>
                <p className="mt-1 text-sm">
                  <span className={a.enRetard ? "font-semibold text-repere-prioritaire" : ""}>
                    {t(`statutsAction.${a.statut}`)}
                    {a.enRetard && ` · ${t("late")}`}
                  </span>
                  {ligne?.doneOn && ` · ${date(ligne.doneOn)}`}
                  {ligne?.comment && <span className="block text-ima-muted">{ligne.comment}</span>}
                </p>
                {peutSuivre && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm font-semibold text-ima-navy">{t("updateProgress")}</summary>
                    <div className="mt-3">
                      <FormulaireAction
                        action={actionAvancement.bind(null, locale, plan.organizationId, plan.id, a.id)}
                        libelle={t("save")}
                        enCours={t("saving")}
                        className="flex max-w-xl flex-col gap-3"
                      >
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Selection
                            id={`statut-${a.id}`}
                            name="statut"
                            label={t("colStatut")}
                            options={STATUTS_ACTION.map((s) => ({ valeur: s, libelle: t(`statutsAction.${s}`) }))}
                            defaultValue={a.statut}
                          />
                          <Champ id={`date-${a.id}`} name="realiseeLe" type="date" max={aujourdhui} label={t("doneOn")} defaultValue={ligne?.doneOn ?? ""} />
                        </div>
                        <Champ id={`commentaire-${a.id}`} name="commentaire" label={t("comment")} aide={t("commentHelp")} maxLength={500} defaultValue={ligne?.comment ?? ""} />
                      </FormulaireAction>
                    </div>
                  </details>
                )}
              </div>
            );
          })}
      </section>
    </div>
  );
}
