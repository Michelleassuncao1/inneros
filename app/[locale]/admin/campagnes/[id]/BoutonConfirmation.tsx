// Bouton qui demande confirmation dans une fenêtre avant une action définitive (révoquer, clôturer).
"use client";

import { useRef } from "react";

export function BoutonConfirmation({
  libelle,
  titre,
  texte,
  confirmer,
  annuler,
  action,
}: {
  libelle: string;
  titre: string;
  texte: string;
  confirmer: string;
  annuler: string;
  action: () => Promise<void>;
}) {
  const dialogue = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => dialogue.current?.showModal()}
        className="rounded-md border border-repere-prioritaire px-4 py-2 font-semibold text-repere-prioritaire hover:bg-white"
      >
        {libelle}
      </button>
      <dialog
        ref={dialogue}
        aria-label={titre}
        className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-md border-t-4 border-ima-navy bg-ima-paper p-6 text-ima-ink backdrop:bg-ima-navy-deep/60"
      >
        <h2 className="text-xl">{titre}</h2>
        <p className="mt-3">{texte}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <form action={action}>
            <button
              type="submit"
              className="rounded-md bg-repere-prioritaire px-5 py-2.5 font-semibold text-white hover:opacity-90"
            >
              {confirmer}
            </button>
          </form>
          <button
            type="button"
            onClick={() => dialogue.current?.close()}
            className="rounded-md border border-ima-navy px-5 py-2.5 font-semibold text-ima-navy hover:bg-ima-cream"
          >
            {annuler}
          </button>
        </div>
      </dialog>
    </>
  );
}
