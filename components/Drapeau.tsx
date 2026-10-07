// Drapeau d'un pays (image SVG : les drapeaux émoji ne s'affichent pas sous Windows).
// Sert uniquement à indiquer le pays d'une entreprise ou d'une campagne, jamais une langue.
import { BE, BR, FR, PT } from "country-flag-icons/react/3x2";

const DRAPEAUX = { BE, BR, FR, PT };

export function Drapeau({ pays, className = "h-3.5 w-auto" }: { pays: string; className?: string }) {
  const Svg = DRAPEAUX[pays as keyof typeof DRAPEAUX];
  if (!Svg) return null;
  return <Svg aria-hidden="true" className={`inline-block rounded-[2px] shadow-[0_0_0_1px_rgba(0,0,0,0.08)] ${className}`} />;
}

// Pays avec son drapeau, par exemple « 🇧🇪 Belgique »
export function Pays({ code, nom }: { code: string; nom: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <Drapeau pays={code} />
      {nom}
    </span>
  );
}
