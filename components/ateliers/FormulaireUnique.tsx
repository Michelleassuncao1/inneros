// Formulaire de la page publique d'un atelier : après un envoi réussi, seul le message de confirmation reste
// (inscription, avis). Les champs saisis restent affichés en cas d'erreur.
"use client";

import { startTransition, useActionState } from "react";
import { MessageErreur, MessageInfo } from "@/components/Formulaire";
import type { EtatFormulaire } from "@/components/FormulaireAction";

export function FormulaireUnique({
  action,
  libelle,
  enCours,
  children,
}: {
  action: (etat: EtatFormulaire, formData: FormData) => Promise<EtatFormulaire>;
  libelle: string;
  enCours: string;
  children?: React.ReactNode;
}) {
  const [etat, envoyer, enAttente] = useActionState(action, {});
  if (etat.succes) return <MessageInfo>{etat.succes}</MessageInfo>;
  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        const donnees = new FormData(e.currentTarget);
        startTransition(() => envoyer(donnees));
      }}
    >
      {etat.erreur && <MessageErreur>{etat.erreur}</MessageErreur>}
      {children}
      <div>
        <button type="submit" disabled={enAttente} className="rounded-md bg-ima-navy px-5 py-2.5 font-semibold text-white hover:bg-ima-navy-deep disabled:opacity-70">
          {enAttente ? enCours : libelle}
        </button>
      </div>
    </form>
  );
}
