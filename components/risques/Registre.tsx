// Contenu de la page « Registre des risques RPS » (module A1), commun à l'espace IMA et à l'espace
// du conseiller en prévention : matrice, tableau des risques, propositions des campagnes, ajout à la main.
import { getTranslations } from "next-intl/server";
import { actionCreerRisque, actionImporterCampagne } from "@/app/[locale]/registre/actions";
import { Cellule, Tableau } from "@/components/EspaceAdmin";
import { FormulaireAction } from "@/components/FormulaireAction";
import { Link } from "@/i18n/navigation";
import type { users } from "@/lib/db/schema";
import { getDb } from "@/lib/db/client";
import type { ClasseRisque } from "@/lib/risques/kinney";
import { lireRegistre, propositions } from "@/lib/risques/registre";
import { ChampsRisque } from "./ChampsRisque";

const COULEURS: Record<ClasseRisque, string> = {
  tres_eleve: "bg-repere-prioritaire text-white",
  eleve: "border border-repere-prioritaire text-repere-prioritaire",
  important: "border border-repere-vigilance text-repere-vigilance",
  possible: "border border-ima-line text-ima-muted",
  acceptable: "border border-repere-favorable text-repere-favorable",
};

export async function BadgeClasse({ classe }: { classe: ClasseRisque }) {
  const t = await getTranslations("Risques");
  return (
    <span className={`inline-block whitespace-nowrap rounded-sm px-2 py-0.5 text-sm font-semibold ${COULEURS[classe]}`}>
      {t(`classes.${classe}`)}
    </span>
  );
}

export async function Registre({
  utilisateur,
  organizationId,
  locale,
  base, // adresse de la page du registre (sans la langue)
}: {
  utilisateur: typeof users.$inferSelect;
  organizationId: string;
  locale: string;
  base: string;
}) {
  const t = await getTranslations("Risques");
  const tp = await getTranslations("Plan");
  const db = getDb();
  const [registre, liste] = await Promise.all([
    lireRegistre(db, utilisateur, organizationId),
    propositions(db, utilisateur, organizationId, locale),
  ]);
  if (!registre) return null;
  const nombre = (v: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(v);
  const aAjouter = liste.filter((p) => !p.dejaAuRegistre);

  return (
    <div className="flex flex-col gap-12">
      {utilisateur.role === "admin" && (
        <p>
          <Link
            href={`/admin/entreprises/${organizationId}/plan`}
            className="inline-block rounded-md bg-ima-navy px-5 py-2.5 font-semibold text-white hover:bg-ima-navy-deep"
          >
            {tp("open")}
          </Link>
        </p>
      )}
      <section className="max-w-3xl rounded-md border-l-[3px] border-ima-gold bg-ima-cream px-5 py-4">
        <h2 className="text-lg">{t("matrixTitle")}</h2>
        <p className="mt-2">{t("intro")}</p>
        <p className="mt-2 text-sm">{t("matrixClasses")}</p>
      </section>

      <section aria-labelledby="registre">
        <h2 id="registre" className="mb-4 text-xl">{t("title")}</h2>
        {registre.length === 0 ? (
          <p>{t("empty")}</p>
        ) : (
          <Tableau entetes={[t("colRisk"), "P", "E", "G", t("colScore"), t("colClass"), t("colStatus"), ""]}>
            {await Promise.all(
              registre.map(async (r) => (
                <tr key={r.id}>
                  <Cellule>
                    <span className="font-semibold">{r.title}</span>
                    <span className="block text-sm text-ima-muted">
                      {t(`sources.${r.source}`)}
                      {r.groupLabels.length > 0 && ` · ${t("groups", { groupes: r.groupLabels.join(", ") })}`}
                    </span>
                  </Cellule>
                  <Cellule>{nombre(r.p)}</Cellule>
                  <Cellule>{nombre(r.e)}</Cellule>
                  <Cellule>{nombre(r.g)}</Cellule>
                  <Cellule>
                    <span className="font-semibold">{nombre(r.score)}</span>
                  </Cellule>
                  <Cellule>
                    <BadgeClasse classe={r.classe} />
                    <span className="block text-xs text-ima-muted">{t(`delais.${r.classe}`)}</span>
                  </Cellule>
                  <Cellule>{t(`statuts.${r.status}`)}</Cellule>
                  <Cellule>
                    <Link href={`${base}/${r.id}`} className="font-semibold text-ima-navy underline">
                      {t("edit")}
                    </Link>
                  </Cellule>
                </tr>
              )),
            )}
          </Tableau>
        )}
      </section>

      <section aria-labelledby="propositions">
        <h2 id="propositions" className="text-xl">{t("proposalsTitle")}</h2>
        <p className="mb-4 mt-2 max-w-[70ch] text-sm text-ima-muted">{t("proposalsHelp")}</p>
        {aAjouter.length === 0 ? (
          <p>{t("proposalsNone")}</p>
        ) : (
          <>
          <div className="mb-4 flex flex-col gap-2">
            {[...new Map(aAjouter.map((p) => [p.campaignId, p.reference])).entries()].map(([campaignId, reference]) => (
              <FormulaireAction
                key={campaignId}
                action={actionImporterCampagne.bind(null, locale, organizationId, campaignId)}
                libelle={t("importAll", { reference })}
                enCours={t("adding")}
                className="flex max-w-xl flex-col gap-2"
              />
            ))}
            <p className="max-w-[70ch] text-sm text-ima-muted">{t("importHelp")}</p>
          </div>
          <ul className="flex flex-col gap-3">
            {aAjouter.map((p) => {
              const cle = `${p.campaignId}-${p.instrumentId}-${p.scaleId}`;
              return (
                <li key={cle} className={`rounded-md border bg-white ${p.obligatoire ? "border-repere-prioritaire" : "border-ima-line"}`}>
                  <details>
                    <summary className="cursor-pointer px-4 py-3">
                      <span className="font-semibold text-ima-navy">{p.nom}</span>
                      <span className="ml-2 text-sm text-ima-muted">
                        {t("campaign", { reference: p.reference })} · {t("result", { detail: p.detail })} · P {nombre(p.p)} · E {nombre(p.e)} · G {nombre(p.g)}
                        {p.citeDansRapport && ` · ${t("citedInReport")}`}
                      </span>
                      {p.obligatoire && <span className="block text-sm font-semibold text-repere-prioritaire">{t("mandatory")}</span>}
                    </summary>
                    <div className="border-t border-ima-line px-4 py-4">
                      <FormulaireAction
                        action={actionCreerRisque.bind(null, locale, organizationId, {
                          campaignId: p.campaignId,
                          instrumentId: p.instrumentId,
                          scaleId: p.scaleId,
                        })}
                        libelle={t("add")}
                        enCours={t("adding")}
                      >
                        <ChampsRisque id={cle} valeurs={{ titre: p.nom, niveau: p.niveau, p: p.p, e: p.e, g: p.g, groupes: p.groupesSuggeres }} groupesPossibles={p.groupes} />
                      </FormulaireAction>
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
          </>
        )}
      </section>

      <section aria-labelledby="manuel">
        <h2 id="manuel" className="text-xl">{t("manualTitle")}</h2>
        <p className="mb-4 mt-2 max-w-[70ch] text-sm text-ima-muted">{t("manualHelp")}</p>
        <FormulaireAction action={actionCreerRisque.bind(null, locale, organizationId, null)} libelle={t("add")} enCours={t("adding")} viderApresSucces>
          <ChampsRisque id="manuel" />
        </FormulaireAction>
      </section>
    </div>
  );
}
