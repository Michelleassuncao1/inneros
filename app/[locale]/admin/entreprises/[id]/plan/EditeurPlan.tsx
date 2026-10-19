// Éditeur du plan de prévention RPS (module A2) : chaque partie du brouillon est modifiable ; les risques
// prioritaires non couverts sont signalés en direct ; la validation exige la liste de contrôle complète.
"use client";

import { useState, useTransition } from "react";
import type { EtatFormulaire } from "@/components/FormulaireAction";
import { MessageErreur, MessageInfo } from "@/components/Formulaire";
import { NIVEAUX_PREVENTION, risquesNonCouverts, type ContenuPlan } from "@/lib/plan/contenu";
import { NIVEAUX_MINDSET } from "@/lib/rapport/contenu";
import type { ClasseRisque, SourceRisque } from "@/lib/risques/kinney";

export type RisqueEditeur = { id: string; title: string; classe: ClasseRisque; source: SourceRisque; status: "ouvert" | "traite" | "clos"; libelleClasse: string };
type Textes = { l: Record<string, string>; niveaux: Record<string, string>; prevention: Record<string, string> };

const champ = "w-full rounded-md border border-ima-line bg-white px-3 py-2 text-ima-ink focus:outline-none focus-visible:shadow-[var(--focus-ring)]";
const bouton = "rounded-md border border-ima-navy px-3 py-1.5 text-sm font-semibold text-ima-navy hover:bg-ima-cream";
const lien = "text-sm text-ima-navy underline";

export function EditeurPlan({
  contenuInitial,
  startYear,
  risques,
  textes,
  formationOk,
  enregistrer,
  valider,
}: {
  contenuInitial: ContenuPlan;
  startYear: number;
  risques: RisqueEditeur[];
  textes: Textes;
  formationOk: boolean;
  enregistrer: (contenu: ContenuPlan) => Promise<EtatFormulaire>;
  valider: (contenu: ContenuPlan, liste: Record<string, boolean>) => Promise<EtatFormulaire>;
}) {
  const [c, setC] = useState<ContenuPlan>(contenuInitial);
  const [etat, setEtat] = useState<EtatFormulaire>({});
  const [liste, setListe] = useState({ risques: false, fonctions: false, cadre: false, langage: false });
  const [enCours, demarrer] = useTransition();
  const maj = (f: (x: ContenuPlan) => ContenuPlan) => setC((x) => f(structuredClone(x)));
  const { l } = textes;
  const manquants = risquesNonCouverts(c, risques);

  // Choix des risques visés (cases à cocher compactes)
  const choixRisques = (choisis: string[], changer: (ids: string[]) => void) => (
    <fieldset className="text-sm">
      <legend className="mb-1">{l.risquesVises}</legend>
      <div className="flex flex-col gap-1">
        {risques.map((r) => (
          <label key={r.id} className="flex items-start gap-1.5">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-ima-navy"
              checked={choisis.includes(r.id)}
              onChange={(e) => changer(e.target.checked ? [...choisis, r.id] : choisis.filter((v) => v !== r.id))}
            />
            <span>
              {r.title} <span className="text-ima-muted">({r.libelleClasse})</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );

  const listeTexte = (cle: "moyens" | "evaluation" | "questions_pour_le_praticien", titre: string) => (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 font-semibold text-ima-navy">{titre}</legend>
      {c[cle].map((v, i) => (
        <div key={i} className="flex items-start gap-2">
          <textarea aria-label={`${titre} ${i + 1}`} className={champ} rows={2} value={v} onChange={(e) => maj((x) => ((x[cle][i] = e.target.value), x))} />
          <button type="button" className={lien} onClick={() => maj((x) => (x[cle].splice(i, 1), x))}>
            {l.remove}
          </button>
        </div>
      ))}
      <div>
        <button type="button" className={bouton} onClick={() => maj((x) => (x[cle].push(""), x))}>
          {l.add}
        </button>
      </div>
    </fieldset>
  );

  return (
    <div className="flex flex-col gap-8">
      {etat.erreur && <MessageErreur>{etat.erreur}</MessageErreur>}
      {etat.succes && <MessageInfo>{etat.succes}</MessageInfo>}

      <h3 className="text-xl">{l.pgpTitle}</h3>
      <label className="flex flex-col gap-1">
        <span className="font-semibold text-ima-navy">{l.rappel}</span>
        <textarea className={champ} rows={4} value={c.rappel_risques} onChange={(e) => maj((x) => ((x.rappel_risques = e.target.value), x))} />
      </label>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 font-semibold text-ima-navy">{l.objectifs}</legend>
        {c.objectifs.map((o, i) => (
          <div key={i} className="flex flex-col gap-2 rounded-md border border-ima-line bg-white p-3">
            <select aria-label={l.objectif} className={champ} value={o.niveau} onChange={(e) => maj((x) => ((x.objectifs[i].niveau = e.target.value as ContenuPlan["objectifs"][number]["niveau"]), x))}>
              {NIVEAUX_MINDSET.map((n) => (
                <option key={n} value={n}>{textes.niveaux[n]}</option>
              ))}
            </select>
            <textarea aria-label={l.objectif} className={champ} rows={2} value={o.objectif} onChange={(e) => maj((x) => ((x.objectifs[i].objectif = e.target.value), x))} />
            {choixRisques(o.risques, (ids) => maj((x) => ((x.objectifs[i].risques = ids), x)))}
            <div>
              <button type="button" className={lien} onClick={() => maj((x) => (x.objectifs.splice(i, 1), x))}>{l.remove}</button>
            </div>
          </div>
        ))}
        <div>
          <button type="button" className={bouton} onClick={() => maj((x) => (x.objectifs.push({ niveau: "organisation", objectif: "", risques: [] }), x))}>{l.add}</button>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 font-semibold text-ima-navy">{l.mesures}</legend>
        {c.mesures.map((m, i) => (
          <div key={i} className="flex flex-col gap-2 rounded-md border border-ima-line bg-white p-3">
            <select aria-label={l.niveauPrevention} className={champ} value={m.niveau_prevention} onChange={(e) => maj((x) => ((x.mesures[i].niveau_prevention = e.target.value as (typeof NIVEAUX_PREVENTION)[number]), x))}>
              {NIVEAUX_PREVENTION.map((n) => (
                <option key={n} value={n}>{textes.prevention[n]}</option>
              ))}
            </select>
            <textarea aria-label={l.mesure} className={champ} rows={2} value={m.mesure} onChange={(e) => maj((x) => ((x.mesures[i].mesure = e.target.value), x))} />
            {choixRisques(m.risques, (ids) => maj((x) => ((x.mesures[i].risques = ids), x)))}
            <div>
              <button type="button" className={lien} onClick={() => maj((x) => (x.mesures.splice(i, 1), x))}>{l.remove}</button>
            </div>
          </div>
        ))}
        <div>
          <button type="button" className={bouton} onClick={() => maj((x) => (x.mesures.push({ niveau_prevention: "primaire", mesure: "", risques: [] }), x))}>{l.add}</button>
        </div>
      </fieldset>

      {listeTexte("moyens", l.moyens)}

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-semibold text-ima-navy">{l.roles}</legend>
        {c.roles.map((r, i) => (
          <div key={i} className="grid gap-2 sm:grid-cols-[14rem_1fr_auto]">
            <input aria-label={l.fonction} className={champ} value={r.fonction} onChange={(e) => maj((x) => ((x.roles[i].fonction = e.target.value), x))} />
            <textarea aria-label={l.role} className={champ} rows={2} value={r.role} onChange={(e) => maj((x) => ((x.roles[i].role = e.target.value), x))} />
            <button type="button" className={lien} onClick={() => maj((x) => (x.roles.splice(i, 1), x))}>{l.remove}</button>
          </div>
        ))}
        <p className="text-sm text-ima-muted">{l.noName}</p>
        <div>
          <button type="button" className={bouton} onClick={() => maj((x) => (x.roles.push({ fonction: "", role: "" }), x))}>{l.add}</button>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 font-semibold text-ima-navy">{l.calendrier}</legend>
        {c.calendrier.map((a, n) => (
          <div key={a.annee} className="flex flex-col gap-2 rounded-md border border-ima-line bg-white p-3">
            <p className="font-semibold text-ima-navy">{l.annee.replace("{n}", String(a.annee)).replace("{annee}", String(startYear + a.annee - 1))}</p>
            {a.etapes.map((e, i) => (
              <div key={i} className="flex items-start gap-2">
                <textarea aria-label={`${l.calendrier} ${a.annee}.${i + 1}`} className={champ} rows={1} value={e} onChange={(ev) => maj((x) => ((x.calendrier[n].etapes[i] = ev.target.value), x))} />
                <button type="button" className={lien} onClick={() => maj((x) => (x.calendrier[n].etapes.splice(i, 1), x))}>{l.remove}</button>
              </div>
            ))}
            <div>
              <button type="button" className={bouton} onClick={() => maj((x) => (x.calendrier[n].etapes.push(""), x))}>{l.add}</button>
            </div>
          </div>
        ))}
      </fieldset>

      {listeTexte("evaluation", l.evaluation)}

      <label className="flex flex-col gap-1">
        <span className="font-semibold text-ima-navy">{l.cadre}</span>
        <textarea className={champ} rows={4} value={c.cadre_legal} onChange={(e) => maj((x) => ((x.cadre_legal = e.target.value), x))} />
      </label>

      <h3 className="text-xl">{l.paaTitle.replace("{annee}", String(startYear))}</h3>
      {c.actions.map((a, i) => (
        <div key={a.id} className="flex flex-col gap-2 rounded-md border border-ima-line bg-white p-3">
          <input aria-label={l.actionTitre} placeholder={l.actionTitre} className={`${champ} font-semibold`} value={a.titre} onChange={(e) => maj((x) => ((x.actions[i].titre = e.target.value), x))} />
          <textarea aria-label={l.actionDescription} placeholder={l.actionDescription} className={champ} rows={2} value={a.description} onChange={(e) => maj((x) => ((x.actions[i].description = e.target.value), x))} />
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="flex flex-col gap-1 text-sm">
              {l.niveauPrevention}
              <select className={champ} value={a.niveau_prevention} onChange={(e) => maj((x) => ((x.actions[i].niveau_prevention = e.target.value as (typeof NIVEAUX_PREVENTION)[number]), x))}>
                {NIVEAUX_PREVENTION.map((n) => (
                  <option key={n} value={n}>{textes.prevention[n]}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              {l.colResponsable}
              <input className={champ} value={a.responsable} onChange={(e) => maj((x) => ((x.actions[i].responsable = e.target.value), x))} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              {l.colEcheance}
              <select className={champ} value={a.trimestre} onChange={(e) => maj((x) => ((x.actions[i].trimestre = Number(e.target.value)), x))}>
                {[1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>{l.trimestre.replace("{n}", String(n))} {startYear}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              {l.colBudget}
              <input className={champ} value={a.budget} onChange={(e) => maj((x) => ((x.actions[i].budget = e.target.value), x))} />
            </label>
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              {l.colIndicateur}
              <input className={champ} value={a.indicateur} onChange={(e) => maj((x) => ((x.actions[i].indicateur = e.target.value), x))} />
            </label>
          </div>
          {choixRisques(a.risques, (ids) => maj((x) => ((x.actions[i].risques = ids), x)))}
          <div className="flex gap-4">
            {i > 0 && (
              <button type="button" className={lien} onClick={() => maj((x) => (x.actions.splice(i - 1, 0, ...x.actions.splice(i, 1)), x))}>{l.up}</button>
            )}
            <button type="button" className={lien} onClick={() => maj((x) => (x.actions.splice(i, 1), x))}>{l.remove}</button>
          </div>
        </div>
      ))}
      <p className="text-sm text-ima-muted">{l.noName}</p>
      <div>
        <button
          type="button"
          className={bouton}
          onClick={() =>
            maj((x) => (
              x.actions.push({ id: crypto.randomUUID(), titre: "", description: "", risques: [], niveau_prevention: "primaire", responsable: "", trimestre: 1, budget: "", indicateur: "" }),
              x
            ))
          }
        >
          {l.addAction}
        </button>
      </div>

      {listeTexte("questions_pour_le_praticien", l.questions)}

      <div>
        <button
          type="button"
          disabled={enCours}
          className="rounded-md bg-ima-navy px-5 py-2.5 font-semibold text-white hover:bg-ima-navy-deep disabled:opacity-70"
          onClick={() => demarrer(async () => setEtat(await enregistrer(c)))}
        >
          {enCours ? l.saving : l.save}
        </button>
      </div>

      <section className="flex flex-col gap-3 rounded-md border-l-[3px] border-ima-gold bg-ima-cream p-4">
        <h3 className="text-lg">{l.validateTitle}</h3>
        {!formationOk && <MessageErreur>{l.trainingMissing}</MessageErreur>}
        {manquants.length > 0 && (
          <MessageErreur>
            {l.manquants} {manquants.map((r) => r.title).join(" ; ")}
          </MessageErreur>
        )}
        {(["risques", "fonctions", "cadre", "langage"] as const).map((k) => (
          <label key={k} className="flex items-start gap-2">
            <input type="checkbox" className="mt-1 h-5 w-5 accent-ima-navy" checked={liste[k]} onChange={(e) => setListe((x) => ({ ...x, [k]: e.target.checked }))} />
            <span>{l[`check_${k}`]}</span>
          </label>
        ))}
        <p className="text-sm text-ima-muted">{l.validateHelp}</p>
        <div>
          <button
            type="button"
            disabled={enCours || !formationOk || manquants.length > 0 || !Object.values(liste).every(Boolean)}
            className="rounded-md bg-ima-navy px-5 py-2.5 font-semibold text-white hover:bg-ima-navy-deep disabled:opacity-50"
            onClick={() => demarrer(async () => setEtat(await valider(c, liste)))}
          >
            {enCours ? l.validating : l.validate}
          </button>
        </div>
      </section>
    </div>
  );
}
