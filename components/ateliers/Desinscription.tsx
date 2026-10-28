// Désinscription d'un atelier : le jeton est après « # » dans le lien de l'e-mail, il n'est donc jamais
// envoyé au serveur avec l'adresse de la page (ni dans les journaux du serveur).
"use client";

import { useEffect, useState, useTransition } from "react";
import { actionDesinscrire } from "@/app/[locale]/atelier/actions";
import { MessageErreur, MessageInfo } from "@/components/Formulaire";

export function Desinscription({
  locale,
  code,
  textes,
}: {
  locale: string;
  code: string;
  textes: { bouton: string; enCours: string; lienIncomplet: string };
}) {
  const [jeton, setJeton] = useState<string | null>(null);
  const [etat, setEtat] = useState<{ erreur?: string; succes?: string }>({});
  const [enAttente, demarrer] = useTransition();

  useEffect(() => {
    // Lecture unique au chargement : le jeton n'existe que dans l'adresse affichée par le navigateur
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setJeton(window.location.hash.slice(1));
  }, []);

  if (jeton === null) return null;
  if (etat.succes) return <MessageInfo>{etat.succes}</MessageInfo>;
  if (!/^[A-Za-z0-9_-]{32}$/.test(jeton)) return <MessageErreur>{textes.lienIncomplet}</MessageErreur>;
  return (
    <div className="flex flex-col gap-4">
      {etat.erreur && <MessageErreur>{etat.erreur}</MessageErreur>}
      <div>
        <button
          type="button"
          disabled={enAttente}
          onClick={() => demarrer(async () => setEtat(await actionDesinscrire(locale, code, jeton)))}
          className="rounded-md bg-ima-navy px-5 py-2.5 font-semibold text-white hover:bg-ima-navy-deep disabled:opacity-70"
        >
          {enAttente ? textes.enCours : textes.bouton}
        </button>
      </div>
    </div>
  );
}
