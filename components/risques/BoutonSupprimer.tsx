// Bouton de suppression avec confirmation (registre des risques)
"use client";

import { useActionState } from "react";
import type { EtatFormulaire } from "@/components/FormulaireAction";
import { MessageErreur } from "@/components/Formulaire";

export function BoutonSupprimer({
  action,
  libelle,
  confirmation,
}: {
  action: (etat: EtatFormulaire) => Promise<EtatFormulaire>;
  libelle: string;
  confirmation: string;
}) {
  const [etat, envoyer, enAttente] = useActionState(action, {});
  return (
    <form
      action={envoyer}
      onSubmit={(e) => {
        if (!window.confirm(confirmation)) e.preventDefault();
      }}
      className="flex flex-col gap-3"
    >
      {etat.erreur && <MessageErreur>{etat.erreur}</MessageErreur>}
      <div>
        <button type="submit" disabled={enAttente} className="text-sm text-repere-prioritaire underline disabled:opacity-60">
          {libelle}
        </button>
      </div>
    </form>
  );
}
