// Bouton « Copier » : met un texte du kit dans le presse-papiers, prêt à coller (intranet, messagerie, e-mail)
"use client";

import { useState } from "react";

export function BoutonCopier({ texte, libelle, copie }: { texte: string; libelle: string; copie: string }) {
  const [fait, setFait] = useState(false);
  return (
    <button
      type="button"
      className="rounded-md border border-ima-navy px-3 py-1.5 text-sm font-semibold text-ima-navy hover:bg-ima-cream"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(texte);
          setFait(true);
          setTimeout(() => setFait(false), 2500);
        } catch {
          // Presse-papiers indisponible : le texte reste sélectionnable à l'écran
        }
      }}
    >
      {fait ? copie : libelle}
    </button>
  );
}
