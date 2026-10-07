// Formulaire générique relié à une action serveur. Les champs saisis restent affichés
// en cas d'erreur (envoi par onSubmit plutôt que par l'attribut action, qui vide le formulaire).
"use client";

import { useActionState, useEffect, useRef, startTransition } from "react";
import { MessageErreur, MessageInfo } from "./Formulaire";

export type EtatFormulaire = { erreur?: string; succes?: string; envoi?: number };

export function FormulaireAction({
  action,
  libelle,
  enCours,
  children,
  viderApresSucces = false,
  secondaire = false,
  className = "flex max-w-xl flex-col gap-5",
}: {
  action: (etat: EtatFormulaire, formData: FormData) => Promise<EtatFormulaire>;
  libelle: string;
  enCours: string;
  children?: React.ReactNode;
  viderApresSucces?: boolean;
  secondaire?: boolean;
  className?: string;
}) {
  const [etat, envoyer, enAttente] = useActionState(action, {});
  const formulaire = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (etat.succes && viderApresSucces) formulaire.current?.reset();
  }, [etat, viderApresSucces]);

  return (
    <form
      ref={formulaire}
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        const donnees = new FormData(e.currentTarget);
        startTransition(() => envoyer(donnees));
      }}
    >
      {etat.erreur && <MessageErreur>{etat.erreur}</MessageErreur>}
      {etat.succes && <MessageInfo>{etat.succes}</MessageInfo>}
      {children}
      <div>
        <button
          type="submit"
          disabled={enAttente}
          className={
            secondaire
              ? "rounded-md border border-ima-navy px-4 py-2 font-semibold text-ima-navy hover:bg-ima-cream disabled:opacity-70"
              : "rounded-md bg-ima-navy px-5 py-2.5 font-semibold text-white hover:bg-ima-navy-deep disabled:opacity-70"
          }
        >
          {enAttente ? enCours : libelle}
        </button>
      </div>
    </form>
  );
}
