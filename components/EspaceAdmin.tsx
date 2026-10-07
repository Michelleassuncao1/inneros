// Mise en page commune de l'espace administrateur : en-tête, menu, contenu, vague IMA.
import { getTranslations } from "next-intl/server";
import { deconnexion } from "@/app/[locale]/deconnexion";
import { Link } from "@/i18n/navigation";
import { SiteHeader } from "./SiteHeader";
import { WaveFooter } from "./WaveFooter";

export async function EspaceAdmin({
  locale,
  actif,
  children,
}: {
  locale: string;
  actif: "accueil" | "entreprises" | "campagnes";
  children: React.ReactNode;
}) {
  const t = await getTranslations("AdminNav");
  const liens = [
    { cle: "accueil", href: "/admin", libelle: t("home") },
    { cle: "entreprises", href: "/admin/entreprises", libelle: t("organizations") },
    { cle: "campagnes", href: "/admin/campagnes", libelle: t("campaigns") },
  ] as const;

  return (
    <>
      <SiteHeader />
      <nav aria-label={t("label")} className="border-b border-ima-line bg-ima-cream">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-1 px-4 py-2">
          {liens.map((l) => (
            <Link
              key={l.cle}
              href={l.href}
              aria-current={actif === l.cle ? "page" : undefined}
              className={
                actif === l.cle
                  ? "rounded-md bg-ima-navy px-3 py-1.5 font-semibold text-white"
                  : "rounded-md px-3 py-1.5 font-semibold text-ima-navy hover:bg-white"
              }
            >
              {l.libelle}
            </Link>
          ))}
          <form action={deconnexion.bind(null, locale)} className="ml-auto">
            <button type="submit" className="rounded-md px-3 py-1.5 text-sm text-ima-navy underline">
              {t("signOut")}
            </button>
          </form>
        </div>
      </nav>
      <main id="contenu" className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
        {children}
      </main>
      <WaveFooter />
    </>
  );
}

export function TitrePage({ surtitre, titre }: { surtitre?: string; titre: string }) {
  return (
    <div className="mb-8">
      {surtitre && (
        <p className="text-sm font-semibold uppercase tracking-widest text-ima-gold-text">{surtitre}</p>
      )}
      <h1 className="mt-1 text-2xl sm:text-3xl">{titre}</h1>
      <div aria-hidden="true" className="mt-4 h-0.5 w-16 bg-ima-gold" />
    </div>
  );
}

// Tableau à la charte : en-tête bleu nuit, texte blanc, filets fins
export function Tableau({ entetes, children }: { entetes: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="bg-ima-navy text-white">
            {entetes.map((e) => (
              <th key={e} scope="col" className="px-3 py-2 font-semibold">
                {e}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white">{children}</tbody>
      </table>
    </div>
  );
}

export function Cellule({ children }: { children: React.ReactNode }) {
  return <td className="border-b border-ima-line px-3 py-2 align-top">{children}</td>;
}

export function FiltrePays({
  base,
  actuel,
  libelles,
  tous,
}: {
  base: string;
  actuel?: string;
  libelles: Record<string, string>;
  tous: string;
}) {
  const options = [{ valeur: undefined, libelle: tous }, ...Object.entries(libelles).map(([valeur, libelle]) => ({ valeur, libelle }))];
  return (
    <ul className="mb-6 flex flex-wrap gap-2 text-sm font-semibold">
      {options.map((o) => (
        <li key={o.libelle}>
          <Link
            href={o.valeur ? `${base}?pays=${o.valeur}` : base}
            aria-current={actuel === o.valeur ? "true" : undefined}
            className={
              actuel === o.valeur
                ? "inline-block rounded-full bg-ima-navy px-3 py-1 text-white"
                : "inline-block rounded-full border border-ima-navy px-3 py-1 text-ima-navy hover:bg-ima-cream"
            }
          >
            {o.libelle}
          </Link>
        </li>
      ))}
    </ul>
  );
}
