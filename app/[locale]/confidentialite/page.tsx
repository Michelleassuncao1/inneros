// Page publique de confidentialité (étape 9), y compris l'information sur l'usage de l'IA (AI Act, art. 50).
import { setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/SiteHeader";
import { WaveFooter } from "@/components/WaveFooter";
import { dureesConservation } from "@/lib/confidentialite/conservation";
import { TEXTES_CONFIDENTIALITE } from "@/lib/confidentialite/textes";

export default async function ConfidentialitePage({ params }: PageProps<"/[locale]/confidentialite">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const texte = TEXTES_CONFIDENTIALITE[locale as keyof typeof TEXTES_CONFIDENTIALITE] ?? TEXTES_CONFIDENTIALITE.fr;
  const d = dureesConservation();
  const remplir = (s: string) =>
    s
      .replaceAll("{reponses}", String(d.reponsesApresAcceptation))
      .replaceAll("{secours}", String(d.reponsesApresCloture))
      .replaceAll("{journal}", String(d.journal));

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
                {remplir(p)}
              </p>
            ))}
            {s.puces && (
              <ul className="mt-3 list-disc space-y-1 pl-5">
                {s.puces.map((p) => (
                  <li key={p}>{remplir(p)}</li>
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
