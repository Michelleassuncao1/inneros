// Page publique « Mentions légales » (étape 10) : identité de l'éditeur, hébergeurs, IA, propriété intellectuelle.
import { setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/SiteHeader";
import { WaveFooter } from "@/components/WaveFooter";
import { TEXTES_MENTIONS_LEGALES } from "@/lib/confidentialite/mentions-legales";

export default async function MentionsLegalesPage({ params }: PageProps<"/[locale]/mentions-legales">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const texte = TEXTES_MENTIONS_LEGALES[locale as keyof typeof TEXTES_MENTIONS_LEGALES] ?? TEXTES_MENTIONS_LEGALES.fr;

  return (
    <>
      <SiteHeader />
      <main id="contenu" className="mx-auto w-full max-w-3xl flex-1 px-4 py-12">
        <h1 className="text-3xl">{texte.titre}</h1>
        <div aria-hidden="true" className="mt-4 h-0.5 w-16 bg-ima-gold" />
        <p className="mt-6 text-sm font-semibold text-ima-gold-text">{texte.aValider}</p>
        <p className="mt-4 max-w-[70ch] text-lg text-ima-navy">{texte.intro}</p>
        {texte.sections.map((s) => (
          <section key={s.titre} className="mt-8 max-w-[70ch]">
            <h2 className="text-xl">{s.titre}</h2>
            {s.paragraphes?.map((p) => (
              <p key={p} className="mt-3">
                {p}
              </p>
            ))}
            {s.puces && (
              <ul className="mt-3 list-disc space-y-1 pl-5">
                {s.puces.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </main>
      <WaveFooter />
    </>
  );
}
