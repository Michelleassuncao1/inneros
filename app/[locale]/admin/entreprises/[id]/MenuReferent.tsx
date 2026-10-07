// Menu « ⋯ » d'un référent : modifier, désactiver / réactiver, supprimer (avec confirmation).
"use client";

import { useEffect, useRef, useState } from "react";
import { Champ } from "@/components/Formulaire";
import { FormulaireAction, type EtatFormulaire } from "@/components/FormulaireAction";

type Libelles = {
  menu: string;
  edit: string;
  editTitle: string;
  editHelp: string;
  name: string;
  email: string;
  save: string;
  saving: string;
  toggle: string;
  delete: string;
  deleteTitle: string;
  deleteText: string;
  deleteConfirm: string;
  cancel: string;
};

const classeDialogue =
  "m-auto w-[min(32rem,calc(100vw-2rem))] rounded-md border-t-4 border-ima-navy bg-ima-paper p-6 text-ima-ink backdrop:bg-ima-navy-deep/60";

export function MenuReferent({
  referent,
  libelles,
  actionModifier,
  actionEtat,
  actionSupprimer,
}: {
  referent: { id: string; name: string; email: string };
  libelles: Libelles;
  actionModifier: (etat: EtatFormulaire, formData: FormData) => Promise<EtatFormulaire>;
  actionEtat: () => Promise<void>;
  actionSupprimer: () => Promise<void>;
}) {
  const [ouvert, setOuvert] = useState(false);
  // Position du menu à l'écran : il flotte au-dessus de la page, sans être coupé par le tableau
  const [position, setPosition] = useState({ top: 0, right: 0 });
  const conteneur = useRef<HTMLDivElement>(null);
  const bouton = useRef<HTMLButtonElement>(null);
  const dialogueModifier = useRef<HTMLDialogElement>(null);
  const dialogueSupprimer = useRef<HTMLDialogElement>(null);

  // Fermeture du menu au clic extérieur ou avec Échap
  useEffect(() => {
    if (!ouvert) return;
    const clic = (e: MouseEvent) => {
      if (!conteneur.current?.contains(e.target as Node)) setOuvert(false);
    };
    const touche = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOuvert(false);
        bouton.current?.focus();
      }
    };
    const fermer = () => setOuvert(false);
    document.addEventListener("mousedown", clic);
    document.addEventListener("keydown", touche);
    window.addEventListener("scroll", fermer, true);
    window.addEventListener("resize", fermer);
    return () => {
      document.removeEventListener("mousedown", clic);
      document.removeEventListener("keydown", touche);
      window.removeEventListener("scroll", fermer, true);
      window.removeEventListener("resize", fermer);
    };
  }, [ouvert]);

  const ouvrir = (dialogue: React.RefObject<HTMLDialogElement | null>) => {
    setOuvert(false);
    dialogue.current?.showModal();
  };

  const element = "block w-full px-4 py-2 text-left hover:bg-ima-cream focus:bg-ima-cream";

  return (
    <div ref={conteneur} className="relative inline-block">
      <button
        ref={bouton}
        type="button"
        aria-haspopup="menu"
        aria-expanded={ouvert}
        aria-label={libelles.menu}
        onClick={() => {
          const r = bouton.current?.getBoundingClientRect();
          if (r) setPosition({ top: r.bottom + 4, right: window.innerWidth - r.right });
          setOuvert((o) => !o);
        }}
        className="rounded-md px-3 py-1 text-xl font-bold leading-none text-ima-navy hover:bg-ima-cream"
      >
        ⋯
      </button>

      {ouvert && (
        <ul
          role="menu"
          style={{ top: position.top, right: position.right }}
          className="fixed z-20 w-48 overflow-hidden rounded-md border border-ima-line bg-white py-1 shadow-md"
        >
          <li role="none">
            <button type="button" role="menuitem" className={element} onClick={() => ouvrir(dialogueModifier)}>
              {libelles.edit}
            </button>
          </li>
          <li role="none">
            <form action={actionEtat} onSubmit={() => setOuvert(false)}>
              <button type="submit" role="menuitem" className={element}>
                {libelles.toggle}
              </button>
            </form>
          </li>
          <li role="none">
            <button
              type="button"
              role="menuitem"
              className={`${element} text-repere-prioritaire`}
              onClick={() => ouvrir(dialogueSupprimer)}
            >
              {libelles.delete}
            </button>
          </li>
        </ul>
      )}

      <dialog ref={dialogueModifier} aria-labelledby={`modifier-${referent.id}`} className={classeDialogue}>
        <h2 id={`modifier-${referent.id}`} className="text-xl">
          {libelles.editTitle}
        </h2>
        <p className="mb-5 mt-2 text-sm text-ima-muted">{libelles.editHelp}</p>
        <FormulaireAction
          action={actionModifier}
          libelle={libelles.save}
          enCours={libelles.saving}
          apresSucces={() => dialogueModifier.current?.close()}
        >
          <Champ
            id={`nom-${referent.id}`}
            name="name"
            label={libelles.name}
            defaultValue={referent.name}
            required
            maxLength={120}
          />
          <Champ
            id={`email-${referent.id}`}
            name="email"
            type="email"
            label={libelles.email}
            defaultValue={referent.email}
            required
            maxLength={254}
          />
        </FormulaireAction>
        <button
          type="button"
          onClick={() => dialogueModifier.current?.close()}
          className="mt-4 text-sm font-semibold text-ima-navy underline"
        >
          {libelles.cancel}
        </button>
      </dialog>

      <dialog ref={dialogueSupprimer} aria-labelledby={`supprimer-${referent.id}`} className={classeDialogue}>
        <h2 id={`supprimer-${referent.id}`} className="text-xl">
          {libelles.deleteTitle}
        </h2>
        <p className="mt-3">{libelles.deleteText}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <form action={actionSupprimer}>
            <button
              type="submit"
              className="rounded-md bg-repere-prioritaire px-5 py-2.5 font-semibold text-white hover:opacity-90"
            >
              {libelles.deleteConfirm}
            </button>
          </form>
          <button
            type="button"
            onClick={() => dialogueSupprimer.current?.close()}
            className="rounded-md border border-ima-navy px-5 py-2.5 font-semibold text-ima-navy hover:bg-ima-cream"
          >
            {libelles.cancel}
          </button>
        </div>
      </dialog>
    </div>
  );
}
