// Affichage en lecture seule d'un rapport (rapport validé ; repris dans l'espace référent et le PDF).
import type { ContenuRapport } from "@/lib/rapport/contenu";

export type TextesRapport = {
  l: Record<string, string>;
  natures: Record<string, string>;
  confiances: Record<string, string>;
  acteursListe: Record<string, string>;
  niveaux: Record<string, string>;
};

function Liste({ titre, lignes }: { titre: string; lignes: string[] }) {
  const pleines = lignes.filter((l) => l.trim());
  if (!pleines.length) return null;
  return (
    <section>
      <h3 className="mb-2 text-lg">{titre}</h3>
      <ul className="list-disc space-y-1 pl-5">
        {pleines.map((l, i) => (
          <li key={i} className="max-w-[70ch]">{l}</li>
        ))}
      </ul>
    </section>
  );
}

export function AffichageRapport({ contenu, textes }: { contenu: ContenuRapport; textes: TextesRapport }) {
  return (
    <div className="flex flex-col gap-8">
      <section>
        <h3 className="mb-2 text-lg">{textes.l.synthese}</h3>
        <p className="max-w-[70ch] whitespace-pre-line">{contenu.synthese}</p>
      </section>

      {contenu.cartographie.some((b) => b.constats.some((k) => k.texte.trim())) && (
      <section className="flex flex-col gap-4">
        <h3 className="text-lg">{textes.l.cartographie}</h3>
        {contenu.cartographie
          .filter((b) => b.constats.some((k) => k.texte.trim()))
          .map((b) => (
            <div key={b.niveau}>
              <h4 className="mb-2 font-semibold text-ima-navy">{textes.niveaux[b.niveau]}</h4>
              <ul className="flex flex-col gap-3">
                {b.constats
                  .filter((k) => k.texte.trim())
                  .map((k, i) => (
                    <li key={i} className="max-w-[70ch] border-l-2 border-ima-line pl-3">
                      <p>{k.texte}</p>
                      <p className="mt-1 text-sm text-ima-muted">
                        {textes.natures[k.nature]} · {textes.l.confiance} : {textes.confiances[k.confiance]}
                        {k.sources.length ? ` · ${k.sources.join(", ")}` : ""}
                      </p>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
      </section>
      )}

      {contenu.priorites_proposees.length > 0 && (
        <section>
          <h3 className="mb-2 text-lg">{textes.l.priorites}</h3>
          <ol className="flex list-decimal flex-col gap-3 pl-5">
            {contenu.priorites_proposees.map((p, i) => (
              <li key={i} className="max-w-[70ch]">
                <p className="font-semibold">{p.priorite}</p>
                <p className="mt-1">{p.justification}</p>
                {p.acteurs.length > 0 && (
                  <p className="mt-1 text-sm text-ima-muted">
                    {textes.l.acteurs} : {p.acteurs.map((a) => textes.acteursListe[a]).join(", ")}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}

      <Liste titre={textes.l.orientations} lignes={contenu.orientations} />
      <Liste titre={textes.l.limites} lignes={contenu.limites} />
    </div>
  );
}
