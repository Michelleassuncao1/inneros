// Parcours interactif de la formation « IMA Talks — Utiliser l'IA dans InnerOS » : 1. modules et leçons,
// 2. lecture du guide interne, 3. quiz (corrigé sur le serveur), 4. enregistrement et certificat IMA.
// Le contenu de la formation vient du fichier d'IMA ; seuls les libellés de l'interface sont traduits.
"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { actionEnregistrerFormation, actionLireGuide, actionQuiz, type ResultatQuiz } from "@/app/[locale]/admin/formation-ia/actions";
import { Champ, MessageErreur, MessageInfo } from "@/components/Formulaire";
import { FormulaireAction } from "@/components/FormulaireAction";
import type { FormationPublique } from "@/lib/formation/formation";

type Etat = { guideLu: boolean; reussi: boolean; meilleurScore: number | null; tentatives: number; enregistre: boolean; certificat: string | null };

const bouton = "inline-block rounded-md bg-ima-navy px-5 py-2.5 font-semibold text-white hover:bg-ima-navy-deep disabled:opacity-50";
const boutonSecondaire = "inline-block rounded-md border border-ima-navy px-5 py-2.5 font-semibold text-ima-navy hover:bg-ima-cream disabled:opacity-50";

export function ParcoursFormation({
  locale,
  formation,
  etat,
  guide,
  aujourdhui,
}: {
  locale: string;
  formation: FormationPublique;
  etat: Etat;
  guide: { titre: string; version: string; lien: string };
  aujourdhui: string;
}) {
  const t = useTranslations("FormationIA");
  const etapeInitiale = etat.enregistre || (etat.reussi && etat.guideLu) ? 3 : etat.guideLu ? 2 : 0;
  const [etape, setEtape] = useState(etapeInitiale);
  const [module, setModule] = useState(0);
  const [vus, setVus] = useState<Set<number>>(new Set(etat.guideLu ? formation.modules.map((_, i) => i) : [0]));
  const [coche, setCoche] = useState(etat.guideLu);
  const [reponses, setReponses] = useState<Record<string, number>>({});
  const [resultat, setResultat] = useState<ResultatQuiz | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  const etapes = [t("stepModules"), t("stepGuide"), t("stepQuiz"), t("stepRegister")];
  const modulesFinis = vus.size === formation.modules.length;
  const accessible = (i: number) => i === 0 || (i === 1 && modulesFinis) || (i === 2 && etat.guideLu) || (i === 3 && etat.reussi && etat.guideLu);
  const m = formation.modules[module];

  const allerModule = (i: number) => {
    setModule(i);
    setVus((v) => new Set(v).add(i));
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Étapes */}
      <ol className="flex flex-wrap gap-2" aria-label={t("stepsLabel")}>
        {etapes.map((libelle, i) => (
          <li key={libelle}>
            <button
              type="button"
              onClick={() => setEtape(i)}
              disabled={!accessible(i)}
              aria-current={etape === i ? "step" : undefined}
              className={`rounded-md px-3 py-1.5 text-sm font-semibold ${
                etape === i ? "bg-ima-navy text-white" : "border border-ima-line bg-white text-ima-navy disabled:text-ima-muted"
              }`}
            >
              {i + 1}. {libelle}
            </button>
          </li>
        ))}
      </ol>

      {/* 1. Modules */}
      {etape === 0 && (
        <section aria-labelledby="module-titre" className="flex flex-col gap-4">
          <p className="text-sm text-ima-muted">{t("modulesHelp", { n: formation.modules.length, minutes: formation.duration_minutes })}</p>
          <div className="flex flex-wrap gap-2">
            {formation.modules.map((x, i) => (
              <button
                key={x.id}
                type="button"
                onClick={() => allerModule(i)}
                aria-current={module === i ? "true" : undefined}
                className={`rounded-sm border px-2 py-1 text-sm ${module === i ? "border-ima-navy bg-ima-cream font-semibold text-ima-navy" : "border-ima-line bg-white"}`}
              >
                {vus.has(i) ? "✓ " : ""}
                {x.id}
              </button>
            ))}
          </div>
          <article className="max-w-3xl rounded-md border border-ima-line bg-white p-6">
            <p className="text-sm font-semibold uppercase tracking-wide text-ima-gold-text">
              {m.id} · {t("minutes", { n: m.duration_minutes })}
            </p>
            <h2 id="module-titre" className="mt-1 text-2xl">{m.title}</h2>
            <p className="mt-3 rounded-md border-l-[3px] border-ima-gold bg-ima-cream px-4 py-3 font-semibold">{m.objective}</p>
            {m.lessons.map((l) => (
              <div key={l.title} className="mt-5">
                <h3 className="text-lg text-ima-navy">{l.title}</h3>
                <p className="mt-1 max-w-[70ch]">{l.content}</p>
              </div>
            ))}
          </article>
          <div className="flex flex-wrap gap-3">
            {module > 0 && (
              <button type="button" className={boutonSecondaire} onClick={() => allerModule(module - 1)}>
                ← {t("previous")}
              </button>
            )}
            {module < formation.modules.length - 1 ? (
              <button type="button" className={bouton} onClick={() => allerModule(module + 1)}>
                {t("next")} →
              </button>
            ) : (
              <button type="button" className={bouton} disabled={!modulesFinis} onClick={() => setEtape(1)}>
                {t("toGuide")} →
              </button>
            )}
          </div>
        </section>
      )}

      {/* 2. Guide interne */}
      {etape === 1 && (
        <section className="flex max-w-3xl flex-col gap-4">
          <p>{t("guideHelp")}</p>
          <p>
            <a href={guide.lien} target="_blank" rel="noopener noreferrer" className="font-semibold text-ima-navy underline">
              {guide.titre} — v{guide.version}
            </a>
          </p>
          <label className="flex items-start gap-2">
            <input type="checkbox" checked={coche} disabled={etat.guideLu} onChange={(e) => setCoche(e.target.checked)} className="mt-1 h-5 w-5 accent-ima-navy" />
            <span>{t("guideAck", { version: guide.version })}</span>
          </label>
          {erreur && <MessageErreur>{erreur}</MessageErreur>}
          <div>
            {etat.guideLu ? (
              <button type="button" className={bouton} onClick={() => setEtape(2)}>
                {t("toQuiz")} →
              </button>
            ) : (
              <button
                type="button"
                className={bouton}
                disabled={!coche || enCours}
                onClick={() =>
                  demarrer(async () => {
                    const r = await actionLireGuide(locale);
                    if (r.erreur) setErreur(r.erreur);
                    else setEtape(2);
                  })
                }
              >
                {enCours ? t("saving") : t("confirmGuide")}
              </button>
            )}
          </div>
        </section>
      )}

      {/* 3. Quiz */}
      {etape === 2 && (
        <section className="flex max-w-3xl flex-col gap-5">
          <p className="text-sm text-ima-muted">
            {t("quizHelp", { n: formation.quiz.length, seuil: formation.passing_score_percent })}
            {etat.tentatives > 0 && ` ${t("attempts", { n: etat.tentatives, score: etat.meilleurScore ?? 0 })}`}
          </p>
          <form
            className="flex flex-col gap-5"
            onSubmit={(e) => {
              e.preventDefault();
              setErreur(null);
              demarrer(async () => {
                const r = await actionQuiz(locale, reponses);
                if (r.erreur) setErreur(r.erreur);
                else setResultat(r);
              });
            }}
          >
            {formation.quiz.map((q, i) => {
              const d = resultat?.details?.find((x) => x.id === q.id);
              return (
                <fieldset key={q.id} className={`rounded-md border bg-white p-4 ${d ? (d.juste ? "border-repere-favorable" : "border-repere-prioritaire") : "border-ima-line"}`}>
                  <legend className="px-1 font-semibold text-ima-navy">
                    {i + 1}. {q.question}
                  </legend>
                  <div className="mt-2 flex flex-col gap-2">
                    {q.options.map((o, j) => (
                      <label key={j} className="flex items-start gap-2">
                        <input
                          type="radio"
                          name={q.id}
                          checked={reponses[q.id] === j}
                          onChange={() => {
                            setReponses((r) => ({ ...r, [q.id]: j }));
                            setResultat(null);
                          }}
                          className="mt-1 h-4 w-4 accent-ima-navy"
                        />
                        <span className={d && j === d.correcte ? "font-semibold" : ""}>{o}</span>
                      </label>
                    ))}
                  </div>
                  {d && (
                    <p className={`mt-2 text-sm ${d.juste ? "text-repere-favorable" : "text-repere-prioritaire"}`}>
                      {d.juste ? t("correct") : t("wrong", { reponse: q.options[d.correcte] })} {d.feedback}
                    </p>
                  )}
                </fieldset>
              );
            })}
            {erreur && <MessageErreur>{erreur}</MessageErreur>}
            {resultat?.score !== undefined && (
              <div aria-live="polite">
                {resultat.reussi ? (
                  <MessageInfo>{t("passed", { score: resultat.score })}</MessageInfo>
                ) : (
                  <MessageErreur>{t("failed", { score: resultat.score, seuil: formation.passing_score_percent })}</MessageErreur>
                )}
              </div>
            )}
            <div className="flex flex-wrap gap-3">
              <button type="submit" className={bouton} disabled={enCours || Object.keys(reponses).length < formation.quiz.length}>
                {enCours ? t("checking") : resultat && !resultat.reussi ? t("retry") : t("submitQuiz")}
              </button>
              {(resultat?.reussi || etat.reussi) && (
                <button type="button" className={boutonSecondaire} onClick={() => setEtape(3)}>
                  {t("toRegister")} →
                </button>
              )}
            </div>
          </form>
        </section>
      )}

      {/* 4. Enregistrement et certificat */}
      {etape === 3 && (
        <section className="flex max-w-3xl flex-col gap-5">
          {etat.enregistre && etat.certificat ? (
            <>
              <MessageInfo>{t("registered", { code: etat.certificat })}</MessageInfo>
              <p>
                <a href={`/api/formation/certificat?lang=${locale}`} className={bouton}>
                  {t("downloadCertificate")}
                </a>
              </p>
              <p className="text-sm text-ima-muted">{t("certificateNote")}</p>
            </>
          ) : (
            <>
              <p>{t("registerHelp")}</p>
              <FormulaireAction action={actionEnregistrerFormation.bind(null, locale)} libelle={t("save")} enCours={t("saving")}>
                <Champ id="date" name="date" type="date" max={aujourdhui} label={t("date")} defaultValue={aujourdhui} required />
                <Champ id="generale" name="generale" label={t("generalTraining")} aide={t("generalTrainingHelp")} minLength={3} maxLength={300} required />
              </FormulaireAction>
            </>
          )}
        </section>
      )}
    </div>
  );
}
