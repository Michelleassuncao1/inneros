// Comportements indésirables (COPSOQ français Q55 à Q62) : nombre de personnes concernées, pour toute
// la campagne seulement (décision du 17/10/2026). Repris dans les résultats et la page du rapport.
import type { ResultatsComportements as Donnees } from "@/lib/resultats/agregats";

export type TextesComportements = {
  titre: string;
  intro: string;
  concernes: (v: { concernes: number; base: number; taux: string }) => string;
  frequence: string;
  auteurs: string;
  nonPrecise: (n: number) => string;
  cumulTitre: string;
  cumul: (v: { concernes: number; base: number; taux: string }) => string;
  parNombre: (v: { n: number; nombre: number }) => string;
};

// Textes à partir des messages « Comportements » (pages serveur, PDF)
export function textesComportements(t: (cle: string, valeurs?: Record<string, string | number>) => string): TextesComportements {
  return {
    titre: t("title"),
    intro: t("intro"),
    concernes: (v) => t("concernes", v),
    frequence: t("frequency"),
    auteurs: t("authors"),
    nonPrecise: (n) => t("notSpecified", { n }),
    cumulTitre: t("cumulTitle"),
    cumul: (v) => t("cumul", v),
    parNombre: (v) => t("byNumber", v),
  };
}

export function ResultatsComportements({ donnees, textes, locale }: { donnees: Donnees; textes: TextesComportements; locale: string }) {
  const taux = (n: number, base: number) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(base ? (n / base) * 100 : 0);
  return (
    <div className="mb-6 flex flex-col gap-6">
      <div>
        <h3 className="mb-2 text-lg">{textes.titre}</h3>
        <p className="max-w-[70ch] text-sm text-ima-muted">{textes.intro}</p>
      </div>
      {donnees.liste.map((c) => (
        <div key={c.id} className="max-w-3xl rounded-md border border-ima-line bg-white px-4 py-3">
          <h4 className="font-semibold text-ima-navy">{c.nom}</h4>
          <p className="mt-1 text-sm text-ima-muted">« {c.question} »</p>
          <p className="mt-2 font-semibold">{textes.concernes({ concernes: c.concernes, base: c.base, taux: taux(c.concernes, c.base) })}</p>
          {c.concernes > 0 && (
            <div className="mt-2 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm font-semibold">{textes.frequence}</p>
                <ul className="mt-1 text-sm">
                  {c.frequences.map((f) => (
                    <li key={f.libelle}>
                      {f.libelle} : {f.n}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-sm font-semibold">{textes.auteurs}</p>
                <ul className="mt-1 text-sm">
                  {c.auteurs.map((a) => (
                    <li key={a.libelle}>
                      {a.libelle} : {a.n}
                    </li>
                  ))}
                  {c.auteursNonPrecises > 0 && <li className="text-ima-muted">{textes.nonPrecise(c.auteursNonPrecises)}</li>}
                </ul>
              </div>
            </div>
          )}
        </div>
      ))}
      {donnees.cumul && (
        <div className="max-w-3xl rounded-md border-l-[3px] border-ima-gold bg-ima-cream px-4 py-3">
          <h4 className="font-semibold text-ima-navy">{textes.cumulTitre}</h4>
          <p className="mt-1">
            {textes.cumul({ concernes: donnees.cumul.concernes, base: donnees.cumul.base, taux: taux(donnees.cumul.concernes, donnees.cumul.base) })}
          </p>
          {donnees.cumul.parNombre.length > 0 && (
            <ul className="mt-1 list-disc pl-5 text-sm">
              {donnees.cumul.parNombre.map((p) => (
                <li key={p.nombre}>{textes.parNombre(p)}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
