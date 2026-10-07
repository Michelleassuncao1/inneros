// Liste des questions diagnostiques types (validées par IMA le 7 octobre 2026).
// Suit le type de mandat choisi dans le formulaire et remplit le champ « Question diagnostique ».
"use client";

import { useEffect, useState } from "react";

export function ChoixQuestionType({
  questions,
  libelles,
  idMandat,
  idQuestion,
  mandatInitial,
}: {
  questions: Record<string, string[]>;
  libelles: { choose: string; placeholder: string; help: string; confirmReplace: string };
  idMandat: string;
  idQuestion: string;
  mandatInitial: string;
}) {
  const [mandat, setMandat] = useState(mandatInitial);
  const [choix, setChoix] = useState("");

  // Le type de mandat est un autre champ du formulaire : on suit ses changements
  useEffect(() => {
    const champ = document.getElementById(idMandat) as HTMLSelectElement | null;
    if (!champ) return;
    const suivre = () => {
      setMandat(champ.value);
      setChoix("");
    };
    champ.addEventListener("change", suivre);
    return () => champ.removeEventListener("change", suivre);
  }, [idMandat]);

  const liste = questions[mandat] ?? [];

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor="question-type" className="font-semibold text-ima-navy">
        {libelles.choose}
      </label>
      <select
        id="question-type"
        value={choix}
        onChange={(e) => {
          const texte = e.target.value;
          const zone = document.getElementById(idQuestion) as HTMLTextAreaElement | null;
          if (!texte || !zone) return;
          if (zone.value.trim() && zone.value !== texte && !window.confirm(libelles.confirmReplace)) return;
          zone.value = texte;
          zone.focus();
          setChoix(texte);
        }}
        className="w-full rounded-sm border border-ima-line bg-white px-3 py-2 text-base"
      >
        <option value="">{libelles.placeholder}</option>
        {liste.map((q) => (
          <option key={q} value={q}>
            {q}
          </option>
        ))}
      </select>
      <p className="text-sm text-ima-muted">{libelles.help}</p>
    </div>
  );
}
