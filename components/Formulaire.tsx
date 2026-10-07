// Éléments de formulaire à la charte IMA (charte, section 5).
"use client";

import { useFormStatus } from "react-dom";

export function Champ({
  label,
  aide,
  ...input
}: { label: string; aide?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const idAide = aide ? `${input.id}-aide` : undefined;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={input.id} className="font-semibold text-ima-navy">
        {label}
      </label>
      <input
        {...input}
        aria-describedby={idAide}
        className="w-full rounded-sm border border-ima-line bg-white px-3 py-2 text-base"
      />
      {aide && (
        <p id={idAide} className="text-sm text-ima-muted">
          {aide}
        </p>
      )}
    </div>
  );
}

export function Selection({
  label,
  options,
  ...select
}: {
  label: string;
  options: { valeur: string; libelle: string }[];
} & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={select.id} className="font-semibold text-ima-navy">
        {label}
      </label>
      <select
        {...select}
        className="w-full rounded-sm border border-ima-line bg-white px-3 py-2 text-base"
      >
        {options.map((o) => (
          <option key={o.valeur} value={o.valeur}>
            {o.libelle}
          </option>
        ))}
      </select>
    </div>
  );
}

export function ZoneTexte({
  label,
  aide,
  ...zone
}: { label: string; aide?: string } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const idAide = aide ? `${zone.id}-aide` : undefined;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={zone.id} className="font-semibold text-ima-navy">
        {label}
      </label>
      <textarea
        rows={3}
        {...zone}
        aria-describedby={idAide}
        className="w-full rounded-sm border border-ima-line bg-white px-3 py-2 text-base"
      />
      {aide && (
        <p id={idAide} className="text-sm text-ima-muted">
          {aide}
        </p>
      )}
    </div>
  );
}

export function CasesACocher({
  legende,
  name,
  options,
  cochees,
  aide,
}: {
  legende: string;
  name: string;
  options: { valeur: string; libelle: string }[];
  cochees: string[];
  aide?: string;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 font-semibold text-ima-navy">{legende}</legend>
      {options.map((o) => (
        <label key={o.valeur} className="flex items-center gap-2">
          <input
            type="checkbox"
            name={name}
            value={o.valeur}
            defaultChecked={cochees.includes(o.valeur)}
            className="h-5 w-5 accent-ima-navy"
          />
          {o.libelle}
        </label>
      ))}
      {aide && <p className="text-sm text-ima-muted">{aide}</p>}
    </fieldset>
  );
}

export function BoutonEnvoi({ libelle, enCours }: { libelle: string; enCours: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-ima-navy px-5 py-2.5 font-semibold text-white hover:bg-ima-navy-deep disabled:opacity-70"
    >
      {pending ? enCours : libelle}
    </button>
  );
}

export function MessageErreur({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="rounded-md border-l-[3px] border-repere-prioritaire bg-white px-4 py-3 text-repere-prioritaire">
      {children}
    </p>
  );
}

export function MessageInfo({ children }: { children: React.ReactNode }) {
  return (
    <p role="status" className="rounded-md border-l-[3px] border-ima-gold bg-ima-cream px-4 py-3">
      {children}
    </p>
  );
}
