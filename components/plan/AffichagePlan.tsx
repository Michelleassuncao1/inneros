// Affichage en lecture seule d'un plan de prévention RPS (module A2) : plan global sur 5 ans, puis plan
// d'action de la première année. Les « questions pour le praticien » restent internes à IMA.
import { getTranslations } from "next-intl/server";
import { Cellule, Tableau } from "@/components/EspaceAdmin";
import type { ContenuPlan } from "@/lib/plan/contenu";

function Liste({ titre, lignes }: { titre: string; lignes: string[] }) {
  const pleines = lignes.filter((l) => l.trim());
  if (!pleines.length) return null;
  return (
    <section>
      <h4 className="mb-2 font-semibold text-ima-navy">{titre}</h4>
      <ul className="list-disc space-y-1 pl-5">
        {pleines.map((l, i) => (
          <li key={i} className="max-w-[70ch]">{l}</li>
        ))}
      </ul>
    </section>
  );
}

export async function AffichagePlan({
  contenu,
  startYear,
  actionYear = startYear,
  risques,
  avecQuestions = false,
}: {
  contenu: ContenuPlan;
  startYear: number;
  actionYear?: number; // année du plan d'action (startYear la première année)
  risques: Map<string, string>; // identifiant du registre → intitulé
  avecQuestions?: boolean;
}) {
  const t = await getTranslations("Plan");
  const tres = await getTranslations("Resultats");
  const noms = (ids: string[]) => ids.map((id) => risques.get(id) ?? t("unknownRisk")).join(" · ");

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-6">
        <h3 className="text-xl">{t("pgpTitle")}</h3>
        {contenu.rappel_risques.trim() && (
          <section>
            <h4 className="mb-2 font-semibold text-ima-navy">{t("rappel")}</h4>
            <p className="max-w-[70ch] whitespace-pre-line">{contenu.rappel_risques}</p>
          </section>
        )}
        {contenu.objectifs.length > 0 && (
          <section>
            <h4 className="mb-2 font-semibold text-ima-navy">{t("objectifs")}</h4>
            <ol className="list-decimal space-y-2 pl-5">
              {contenu.objectifs.map((o, i) => (
                <li key={i} className="max-w-[70ch]">
                  <span className="text-sm font-semibold text-ima-gold-text">{tres(`levels.${o.niveau}`)}</span> — {o.objectif}
                  {o.risques.length > 0 && <span className="block text-sm text-ima-muted">{t("risquesVises")} : {noms(o.risques)}</span>}
                </li>
              ))}
            </ol>
          </section>
        )}
        {contenu.mesures.length > 0 && (
          <section>
            <h4 className="mb-2 font-semibold text-ima-navy">{t("mesures")}</h4>
            <ul className="list-disc space-y-2 pl-5">
              {contenu.mesures.map((m, i) => (
                <li key={i} className="max-w-[70ch]">
                  {m.mesure}
                  <span className="block text-sm text-ima-muted">
                    {t(`niveaux.${m.niveau_prevention}`)}
                    {m.risques.length > 0 && ` · ${t("risquesVises")} : ${noms(m.risques)}`}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
        <Liste titre={t("moyens")} lignes={contenu.moyens} />
        {contenu.roles.length > 0 && (
          <section>
            <h4 className="mb-2 font-semibold text-ima-navy">{t("roles")}</h4>
            <ul className="space-y-1">
              {contenu.roles.map((r, i) => (
                <li key={i} className="max-w-[70ch]">
                  <span className="font-semibold">{r.fonction}</span> : {r.role}
                </li>
              ))}
            </ul>
          </section>
        )}
        {contenu.calendrier.some((c) => c.etapes.some((e) => e.trim())) && (
          <section>
            <h4 className="mb-2 font-semibold text-ima-navy">{t("calendrier")}</h4>
            <div className="grid gap-3 sm:grid-cols-2">
              {contenu.calendrier.map((c) => (
                <div key={c.annee} className="rounded-md border border-ima-line bg-white px-4 py-3">
                  <p className="font-semibold text-ima-navy">{t("annee", { n: c.annee, annee: startYear + c.annee - 1 })}</p>
                  <ul className="mt-1 list-disc pl-5 text-sm">
                    {c.etapes.filter((e) => e.trim()).map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        )}
        <Liste titre={t("evaluation")} lignes={contenu.evaluation} />
        {contenu.cadre_legal.trim() && (
          <section>
            <h4 className="mb-2 font-semibold text-ima-navy">{t("cadre")}</h4>
            <p className="max-w-[70ch] whitespace-pre-line">{contenu.cadre_legal}</p>
          </section>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h3 className="text-xl">{t("paaTitle", { annee: actionYear })}</h3>
        <Tableau entetes={[t("colAction"), t("colResponsable"), t("colEcheance"), t("colEffort"), t("colBudget"), t("colIndicateur")]}>
          {[...contenu.actions]
            .sort((a, b) => a.trimestre - b.trimestre)
            .map((a) => (
              <tr key={a.id}>
                <Cellule>
                  <span className="font-semibold">{a.titre}</span>
                  {a.description && <span className="block text-sm">{a.description}</span>}
                  <span className="block text-xs text-ima-muted">
                    {t(`niveaux.${a.niveau_prevention}`)}
                    {a.risques.length > 0 && ` · ${noms(a.risques)}`}
                  </span>
                </Cellule>
                <Cellule>{a.responsable}</Cellule>
                <Cellule>{t("trimestre", { n: a.trimestre })} {actionYear}</Cellule>
                <Cellule>{t(`efforts.${a.effort}`)}</Cellule>
                <Cellule>{a.budget}</Cellule>
                <Cellule>{a.indicateur}</Cellule>
              </tr>
            ))}
        </Tableau>
      </section>

      {avecQuestions && <Liste titre={t("questions")} lignes={contenu.questions_pour_le_praticien} />}
    </div>
  );
}
