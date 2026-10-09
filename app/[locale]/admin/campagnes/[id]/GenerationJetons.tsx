// Génération d'un lot de jetons. Les codes ne restent que dans la mémoire de cette page :
// l'administrateur télécharge le tableau CSV et les cartes PDF, puis ils disparaissent.
"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import { Champ, MessageErreur } from "@/components/Formulaire";
import type { EtatJetons } from "../../actions";

type Textes = {
  number: string;
  numberHelp: string;
  generate: string;
  generating: string;
  readyTitle: string;
  readyText: string;
  downloadCsv: string;
  downloadPdf: Record<string, string>; // par langue
  downloading: string;
  downloaded: string;
  done: string;
  leaveWarning: string;
  pdfError: string;
  csvHeader: string;
};

function telecharger(contenu: Blob, nom: string) {
  const lien = document.createElement("a");
  lien.href = URL.createObjectURL(contenu);
  lien.download = nom;
  lien.click();
  setTimeout(() => URL.revokeObjectURL(lien.href), 1000);
}

export function GenerationJetons({
  action,
  campagneId,
  reference,
  langues,
  urlQuestionnaire,
  nombreSuggere,
  textes,
}: {
  action: (etat: EtatJetons, formData: FormData) => Promise<EtatJetons>;
  campagneId: string;
  reference: string;
  langues: string[];
  urlQuestionnaire: string; // sans la langue, ex. http://localhost:3000
  nombreSuggere: number;
  textes: Textes;
}) {
  const [etat, envoyer, enAttente] = useActionState(action, {});
  // Lot affiché : celui que vient de renvoyer l'action, tant que l'administrateur n'a pas cliqué « J'ai terminé »
  const [termine, setTermine] = useState<number>();
  const codes = etat.codes && etat.envoi !== termine ? etat.codes : [];
  const [suivi, setSuivi] = useState<{ envoi?: number; faits: Record<string, boolean> }>({ faits: {} });
  const faits = suivi.envoi === etat.envoi ? suivi.faits : {};
  const marquer = (cle: string) =>
    setSuivi((p) => ({ envoi: etat.envoi, faits: { ...(p.envoi === etat.envoi ? p.faits : {}), [cle]: true } }));
  const [pdfEnCours, setPdfEnCours] = useState<string | null>(null);
  const [erreurPdf, setErreurPdf] = useState(false);

  // Avertissement si l'on quitte la page avant d'avoir téléchargé quoi que ce soit
  const rienTelecharge = codes.length > 0 && Object.keys(faits).length === 0;
  useEffect(() => {
    if (!rienTelecharge) return;
    const avertir = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", avertir);
    return () => window.removeEventListener("beforeunload", avertir);
  }, [rienTelecharge]);

  const nomFichier = reference.replace(/[^\w-]/g, "_");

  const csv = () => {
    const lignes = codes.map((c) => `${c};${urlQuestionnaire}/${langues[0]}/q#${c.replace(/-/g, "")}`);
    // BOM : Excel reconnaît ainsi les accents
    telecharger(new Blob(["﻿" + [textes.csvHeader, ...lignes].join("\r\n")], { type: "text/csv;charset=utf-8" }), `jetons-${nomFichier}.csv`);
    marquer("csv");
  };

  const pdf = async (langue: string) => {
    setPdfEnCours(langue);
    setErreurPdf(false);
    try {
      const reponse = await fetch(`/api/admin/campagnes/${campagneId}/cartes`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ langue, codes }),
      });
      if (!reponse.ok) throw new Error(String(reponse.status));
      telecharger(await reponse.blob(), `cartes-jetons-${nomFichier}-${langue}.pdf`);
      marquer(langue);
    } catch {
      setErreurPdf(true);
    } finally {
      setPdfEnCours(null);
    }
  };

  if (codes.length) {
    const bouton =
      "rounded-md bg-ima-navy px-4 py-2 font-semibold text-white hover:bg-ima-navy-deep disabled:opacity-70";
    return (
      <div role="status" className="max-w-xl rounded-md border-l-[3px] border-ima-gold bg-ima-cream px-5 py-4">
        <p className="font-display text-lg font-bold text-ima-navy">
          {textes.readyTitle.replace("{count}", String(codes.length))}
        </p>
        <p className="mt-2">{textes.readyText}</p>
        {erreurPdf && (
          <div className="mt-3">
            <MessageErreur>{textes.pdfError}</MessageErreur>
          </div>
        )}
        <div className="mt-4 flex flex-col items-start gap-2">
          <button type="button" onClick={csv} className={bouton}>
            {textes.downloadCsv} {faits.csv && `✓ ${textes.downloaded}`}
          </button>
          {langues.map((l) => (
            <button key={l} type="button" disabled={pdfEnCours !== null} onClick={() => pdf(l)} className={bouton}>
              {pdfEnCours === l ? textes.downloading : textes.downloadPdf[l]} {faits[l] && `✓ ${textes.downloaded}`}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setTermine(etat.envoi)}
            className="mt-2 text-sm font-semibold text-ima-navy underline"
          >
            {textes.done}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      className="flex max-w-xl flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const donnees = new FormData(e.currentTarget);
        startTransition(() => envoyer(donnees));
      }}
    >
      {etat.erreur && <MessageErreur>{etat.erreur}</MessageErreur>}
      <Champ
        id="nombre"
        name="nombre"
        type="number"
        min={1}
        max={5000}
        label={textes.number}
        aide={textes.numberHelp}
        defaultValue={nombreSuggere}
        required
      />
      <div>
        <button
          type="submit"
          disabled={enAttente}
          className="rounded-md bg-ima-navy px-5 py-2.5 font-semibold text-white hover:bg-ima-navy-deep disabled:opacity-70"
        >
          {enAttente ? textes.generating : textes.generate}
        </button>
      </div>
    </form>
  );
}
