"use client";

// Dernier filet (erreur dans la mise en page elle-même) : les traductions ne sont pas disponibles ici,
// le message est donc affiché dans les 4 langues. L'erreur est signalée comme dans app/[locale]/error.tsx.
import { useEffect } from "react";
import { signalerErreur } from "@/lib/erreurs/signaler";
import "./globals.css";

const MESSAGES = [
  { lang: "fr", texte: "Un problème est survenu. Réessayez dans un instant.", bouton: "Réessayer" },
  { lang: "nl", texte: "Er is een probleem opgetreden. Probeer het zo meteen opnieuw.", bouton: "Opnieuw proberen" },
  { lang: "en", texte: "Something went wrong. Please try again in a moment.", bouton: "Try again" },
  { lang: "pt-BR", texte: "Ocorreu um problema. Tente novamente em instantes.", bouton: "Tentar novamente" },
];

export default function ErreurGlobale({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => signalerErreur(error), [error]);
  return (
    <html lang="fr">
      <body className="mx-auto max-w-2xl px-4 py-16">
        {MESSAGES.map((m) => (
          <p key={m.lang} lang={m.lang} className="mb-3">
            {m.texte}
          </p>
        ))}
        <button type="button" onClick={reset} className="mt-6 rounded-md bg-ima-navy px-5 py-2.5 font-semibold text-white">
          {MESSAGES.map((m) => m.bouton).join(" · ")}
        </button>
      </body>
    </html>
  );
}
