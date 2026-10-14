// Éditeur du rapport (étape 8A) : chaque rubrique du brouillon est modifiable ; la validation exige
// la liste de contrôle complète. Les données sources sont affichées à côté (colonne de droite).
"use client";

import { useState, useTransition } from "react";
import type { EtatFormulaire } from "@/components/FormulaireAction";
import { MessageErreur, MessageInfo } from "@/components/Formulaire";
import { ACTEURS, CONFIANCES, NATURES, type ContenuRapport } from "@/lib/rapport/contenu";

type Textes = {
  l: Record<string, string>;
  natures: Record<string, string>;
  confiances: Record<string, string>;
  acteursListe: Record<string, string>;
  niveaux: Record<string, string>;
};

const champ = "w-full rounded-md border border-ima-line bg-white px-3 py-2 text-ima-ink focus:outline-none focus-visible:shadow-[var(--focus-ring)]";
const bouton = "rounded-md border border-ima-navy px-3 py-1.5 text-sm font-semibold text-ima-navy hover:bg-ima-cream";
const lien = "text-sm text-ima-navy underline";

export function EditeurRapport({
  contenuInitial,
  textes,
  formationOk,
  enregistrer,
  valider,
}: {
  contenuInitial: ContenuRapport;
  textes: Textes;
  formationOk: boolean;
  enregistrer: (contenu: ContenuRapport) => Promise<EtatFormulaire>;
  valider: (contenu: ContenuRapport, liste: Record<string, boolean>) => Promise<EtatFormulaire>;
}) {
  const [c, setC] = useState<ContenuRapport>(contenuInitial);
  const [etat, setEtat] = useState<EtatFormulaire>({});
  const [liste, setListe] = useState({ sources: false, seuil: false, langage: false, limites: false });
  const [enCours, demarrer] = useTransition();
  const maj = (f: (x: ContenuRapport) => ContenuRapport) => setC((x) => f(structuredClone(x)));

  const listeTexte = (cle: "orientations" | "limites" | "questions_pour_le_praticien", titre: string) => (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 font-semibold text-ima-navy">{titre}</legend>
      {c[cle].map((v, i) => (
        <div key={i} className="flex items-start gap-2">
          <textarea aria-label={`${titre} ${i + 1}`} className={champ} rows={2} value={v} onChange={(e) => maj((x) => ((x[cle][i] = e.target.value), x))} />
          <button type="button" className={lien} onClick={() => maj((x) => (x[cle].splice(i, 1), x))}>
            {textes.l.remove}
          </button>
        </div>
      ))}
      <div>
        <button type="button" className={bouton} onClick={() => maj((x) => (x[cle].push(""), x))}>
          {textes.l.addLigne}
        </button>
      </div>
    </fieldset>
  );

  return (
    <div className="flex flex-col gap-8">
      {etat.erreur && <MessageErreur>{etat.erreur}</MessageErreur>}
      {etat.succes && <MessageInfo>{etat.succes}</MessageInfo>}

      <label className="flex flex-col gap-1">
        <span className="font-semibold text-ima-navy">{textes.l.synthese}</span>
        <textarea className={champ} rows={5} value={c.synthese} onChange={(e) => maj((x) => ((x.synthese = e.target.value), x))} />
      </label>

      <section className="flex flex-col gap-4">
        <h3 className="text-lg">{textes.l.cartographie}</h3>
        {c.cartographie.map((bloc, n) => (
          <fieldset key={bloc.niveau} className="rounded-md border border-ima-line bg-white p-3">
            <legend className="px-1 font-semibold text-ima-navy">{textes.niveaux[bloc.niveau]}</legend>
            <div className="flex flex-col gap-4">
              {bloc.constats.map((k, i) => (
                <div key={i} className="flex flex-col gap-2 border-b border-ima-line pb-3 last:border-0">
                  <textarea aria-label={textes.l.constat} className={champ} rows={3} value={k.texte} onChange={(e) => maj((x) => ((x.cartographie[n].constats[i].texte = e.target.value), x))} />
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="flex flex-col gap-1 text-sm">
                      {textes.l.nature}
                      <select className={champ} value={k.nature} onChange={(e) => maj((x) => ((x.cartographie[n].constats[i].nature = e.target.value as (typeof NATURES)[number]), x))}>
                        {NATURES.map((v) => (
                          <option key={v} value={v}>{textes.natures[v]}</option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                      {textes.l.confiance}
                      <select className={champ} value={k.confiance} onChange={(e) => maj((x) => ((x.cartographie[n].constats[i].confiance = e.target.value as (typeof CONFIANCES)[number]), x))}>
                        {CONFIANCES.map((v) => (
                          <option key={v} value={v}>{textes.confiances[v]}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <label className="flex flex-col gap-1 text-sm">
                    {textes.l.sources}
                    <input
                      className={champ}
                      value={k.sources.join(", ")}
                      onChange={(e) => maj((x) => ((x.cartographie[n].constats[i].sources = e.target.value.split(",").map((s) => s.trim()).filter(Boolean)), x))}
                    />
                  </label>
                  <div>
                    <button type="button" className={lien} onClick={() => maj((x) => (x.cartographie[n].constats.splice(i, 1), x))}>
                      {textes.l.remove}
                    </button>
                  </div>
                </div>
              ))}
              <div>
                <button
                  type="button"
                  className={bouton}
                  onClick={() => maj((x) => (x.cartographie[n].constats.push({ texte: "", nature: "donnee", confiance: "intermediaire", sources: [] }), x))}
                >
                  {textes.l.addConstat}
                </button>
              </div>
            </div>
          </fieldset>
        ))}
      </section>

      <section className="flex flex-col gap-4">
        <h3 className="text-lg">{textes.l.priorites}</h3>
        {c.priorites_proposees.map((p, i) => (
          <div key={i} className="flex flex-col gap-2 rounded-md border border-ima-line bg-white p-3">
            <label className="flex flex-col gap-1 text-sm">
              {textes.l.priorite}
              <textarea className={champ} rows={2} value={p.priorite} onChange={(e) => maj((x) => ((x.priorites_proposees[i].priorite = e.target.value), x))} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              {textes.l.justification}
              <textarea className={champ} rows={3} value={p.justification} onChange={(e) => maj((x) => ((x.priorites_proposees[i].justification = e.target.value), x))} />
            </label>
            <fieldset className="text-sm">
              <legend className="mb-1">{textes.l.acteurs}</legend>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {ACTEURS.map((a) => (
                  <label key={a} className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-ima-navy"
                      checked={p.acteurs.includes(a)}
                      onChange={(e) =>
                        maj((x) => {
                          const liste = x.priorites_proposees[i].acteurs;
                          x.priorites_proposees[i].acteurs = e.target.checked ? [...liste, a] : liste.filter((v) => v !== a);
                          return x;
                        })
                      }
                    />
                    {textes.acteursListe[a]}
                  </label>
                ))}
              </div>
            </fieldset>
            <div>
              <button type="button" className={lien} onClick={() => maj((x) => (x.priorites_proposees.splice(i, 1), x))}>
                {textes.l.remove}
              </button>
            </div>
          </div>
        ))}
        <div>
          <button type="button" className={bouton} onClick={() => maj((x) => (x.priorites_proposees.push({ priorite: "", justification: "", acteurs: [] }), x))}>
            {textes.l.addPriorite}
          </button>
        </div>
      </section>

      {listeTexte("orientations", textes.l.orientations)}
      {listeTexte("limites", textes.l.limites)}
      {listeTexte("questions_pour_le_praticien", textes.l.questions)}

      <div>
        <button
          type="button"
          disabled={enCours}
          className="rounded-md bg-ima-navy px-5 py-2.5 font-semibold text-white hover:bg-ima-navy-deep disabled:opacity-70"
          onClick={() => demarrer(async () => setEtat(await enregistrer(c)))}
        >
          {enCours ? textes.l.saving : textes.l.save}
        </button>
      </div>

      <section className="flex flex-col gap-3 rounded-md border-l-[3px] border-ima-gold bg-ima-cream p-4">
        <h3 className="text-lg">{textes.l.validateTitle}</h3>
        {!formationOk && <MessageErreur>{textes.l.trainingMissing}</MessageErreur>}
        {(["sources", "seuil", "langage", "limites"] as const).map((k) => (
          <label key={k} className="flex items-start gap-2">
            <input type="checkbox" className="mt-1 h-5 w-5 accent-ima-navy" checked={liste[k]} onChange={(e) => setListe((l) => ({ ...l, [k]: e.target.checked }))} />
            <span>{textes.l[`check_${k}`]}</span>
          </label>
        ))}
        <p className="text-sm text-ima-muted">{textes.l.validateHelp}</p>
        <div>
          <button
            type="button"
            disabled={enCours || !formationOk || !Object.values(liste).every(Boolean)}
            className="rounded-md bg-ima-navy px-5 py-2.5 font-semibold text-white hover:bg-ima-navy-deep disabled:opacity-50"
            onClick={() => demarrer(async () => setEtat(await valider(c, liste)))}
          >
            {enCours ? textes.l.validating : textes.l.validate}
          </button>
        </div>
      </section>
    </div>
  );
}
