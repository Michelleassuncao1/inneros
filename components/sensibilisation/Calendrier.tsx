// Calendrier de sensibilisation d'une entreprise (modules B2 et B3), commun à l'espace IMA et à l'espace référent :
// alertes réglementaires, propositions à accepter ou refuser, campagnes de l'année mois par mois, suivi
// « prévue → diffusée → réalisée », lien avec le plan de prévention, événements déclarés.
import { getTranslations } from "next-intl/server";
import {
  actionAccepterProposition,
  actionAjouterCampagne,
  actionDeclarerEvenement,
  actionLierAction,
  actionMajCampagne,
  actionProposerCalendrier,
  actionRefuserProposition,
} from "@/app/[locale]/calendrier/actions";
import { Champ, MessageInfo, Selection } from "@/components/Formulaire";
import { FormulaireAction } from "@/components/FormulaireAction";
import { Link } from "@/i18n/navigation";
import type { users } from "@/lib/db/schema";
import { getDb } from "@/lib/db/client";
import { lireCalendrier, peutModifierCalendrier, STATUTS_SENSIB, themesDisponibles } from "@/lib/sensibilisation/calendrier";
import { EVENEMENTS } from "@/lib/sensibilisation/contenu";
import {
  actionsPourLien,
  actualiserPropositions,
  alertesPour,
  causesAcceptees,
  decesRecent,
  lireEvenements,
  lirePropositions,
  type Cause,
} from "@/lib/sensibilisation/declencheurs";
import type { Theme } from "@/lib/sensibilisation/themes";

const COULEURS: Record<string, string> = {
  prevue: "border-ima-line text-ima-navy",
  diffusee: "border-repere-vigilance text-repere-vigilance",
  realisee: "border-repere-favorable text-repere-favorable",
  retiree: "border-ima-line text-ima-muted line-through",
};

export async function Calendrier({
  utilisateur,
  organizationId,
  locale,
  annee,
  base, // adresse de la page du calendrier (sans la langue)
}: {
  utilisateur: typeof users.$inferSelect;
  organizationId: string;
  locale: string;
  annee: number;
  base: string;
}) {
  const t = await getTranslations("Calendrier");
  const tr = await getTranslations("Risques");
  const db = getDb();
  const modifiable = peutModifierCalendrier(utilisateur, organizationId);
  if (modifiable) await actualiserPropositions(db, organizationId);
  const campagnes = await lireCalendrier(db, utilisateur, organizationId, annee);
  if (!campagnes) return null;
  const disponibles = modifiable ? (await themesDisponibles(db, organizationId, annee)).filter((th) => !th.dejaPrevu) : [];
  const alertes = await alertesPour(db, organizationId);
  const propositions = await lirePropositions(db, utilisateur, organizationId);
  const causes = await causesAcceptees(db, utilisateur, organizationId);
  const evenements = await lireEvenements(db, utilisateur, organizationId);
  const deces = modifiable && (await decesRecent(db, organizationId));
  const lien = await actionsPourLien(db, utilisateur, organizationId);

  const nomMois = (m: number, a = annee) => new Intl.DateTimeFormat(locale, { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(a, m - 1, 1)));
  const moisOptions = (a = annee) => Array.from({ length: 12 }, (_, i) => ({ valeur: String(i + 1), libelle: nomMois(i + 1, a) }));
  const titreTheme = (th: Theme) => th.kitsLus[locale as "fr"]?.titre || th.kitsLus.fr?.titre || th.code;
  const date = (d: string) => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const texteCause = (c: Cause | null) => {
    if (!c) return "";
    if (c.type === "registre") return t("causes.registre", { risque: c.risque, classe: tr(`classes.${c.classe}`) });
    if (c.type === "comportement") return t("causes.comportement");
    if (c.type === "evenement") return t("causes.evenement", { evenement: t(`evenements.${c.evenement}`), date: date(c.date) });
    return t("causes.alerte", { titre: c.titre });
  };

  return (
    <div className="flex flex-col gap-10">
      <nav className="flex items-center gap-4" aria-label={t("year")}>
        <Link href={`${base}?annee=${annee - 1}`} className="font-semibold text-ima-navy underline">← {annee - 1}</Link>
        <span className="text-xl font-semibold text-ima-navy">{annee}</span>
        <Link href={`${base}?annee=${annee + 1}`} className="font-semibold text-ima-navy underline">{annee + 1} →</Link>
      </nav>

      {!modifiable && <MessageInfo>{t("readOnly")}</MessageInfo>}

      {/* Décès déclaré : orientation vers un professionnel avant toute communication */}
      {deces && (
        <section className="max-w-3xl rounded-md border-l-[3px] border-repere-prioritaire bg-white px-5 py-4" role="note">
          <h2 className="text-lg">{t("decesTitle")}</h2>
          <p className="mt-2">{t("decesText")}</p>
        </section>
      )}

      {/* Alertes réglementaires d'IMA */}
      {alertes.length > 0 && (
        <section aria-labelledby="alertes" className="flex max-w-3xl flex-col gap-3">
          <h2 id="alertes" className="text-xl">{t("alertsTitle")}</h2>
          {alertes.map((a) => (
            <div key={a.id} className="rounded-md border-l-[3px] border-ima-gold bg-ima-cream px-5 py-4">
              <p className="font-semibold text-ima-navy">{a.title}</p>
              <p className="mt-1 whitespace-pre-line">{a.message}</p>
              <p className="mt-1 text-sm text-ima-muted">{t("alertMonth", { mois: `${nomMois(a.month, a.year)} ${a.year}` })}</p>
            </div>
          ))}
        </section>
      )}

      {/* Propositions à accepter ou refuser */}
      {modifiable && (
        <section aria-labelledby="propositions" className="flex max-w-3xl flex-col gap-3">
          <h2 id="propositions" className="text-xl">{t("suggestionsTitle", { n: propositions.length })}</h2>
          <p className="text-sm text-ima-muted">{t("suggestionsHelp")}</p>
          {propositions.map((p) => (
            <div key={p.id} className={`rounded-md border bg-white p-4 ${p.priority ? "border-repere-prioritaire" : "border-ima-line"}`}>
              <p>
                <span className="font-semibold text-ima-navy">{titreTheme(p.theme)}</span>
                {p.priority && <span className="ml-2 rounded-sm border border-repere-prioritaire px-2 py-0.5 text-sm font-semibold text-repere-prioritaire">{t("priority")}</span>}
              </p>
              <p className="mt-1 text-sm">{texteCause(p.cause)}</p>
              <p className="mt-1 text-sm text-ima-muted">
                {p.existante
                  ? t("alreadyPlanned", { mois: nomMois(p.existante.month, p.year), statut: t(`statuts.${p.existante.status}`) })
                  : t("suggestedFor", { mois: `${nomMois(p.month, p.year)} ${p.year}` })}
              </p>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <FormulaireAction
                  action={actionAccepterProposition.bind(null, locale, organizationId, p.id)}
                  libelle={t("accept")}
                  enCours={t("working")}
                  className="flex flex-col gap-3"
                >
                  <Selection id={`mois-p-${p.id}`} name="mois" label={t("month")} options={moisOptions(p.year)} defaultValue={String(p.month)} />
                </FormulaireAction>
                <FormulaireAction
                  action={actionRefuserProposition.bind(null, locale, organizationId, p.id)}
                  libelle={t("refuse")}
                  enCours={t("working")}
                  className="flex flex-col gap-3"
                >
                  <Champ id={`motif-${p.id}`} name="motif" label={t("refuseReason")} aide={t("refuseReasonHelp")} required minLength={3} maxLength={300} />
                </FormulaireAction>
              </div>
            </div>
          ))}
        </section>
      )}

      {modifiable && (
        <section className="max-w-3xl rounded-md border-l-[3px] border-ima-gold bg-ima-cream px-5 py-4">
          <p className="mb-3">{t("proposeHelp")}</p>
          <FormulaireAction action={actionProposerCalendrier.bind(null, locale, organizationId, annee)} libelle={t("propose", { annee })} enCours={t("working")} />
        </section>
      )}

      {campagnes.length === 0 ? (
        <p>{t("empty")}</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {campagnes.map((c) => {
            const action = lien && c.planId === lien.planId ? lien.actions.find((a) => a.id === c.planActionId) : undefined;
            // Actions qui traitent le risque à l'origine de la campagne en premier
            const actions = lien ? [...lien.actions].sort((a, b) => Number(b.risques.includes(c.originRef ?? "")) - Number(a.risques.includes(c.originRef ?? ""))) : [];
            return (
              <li key={c.id} className={`rounded-md border bg-white p-4 ${c.status === "retiree" ? "opacity-60" : ""}`}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p>
                    <span className="mr-3 text-sm font-semibold uppercase tracking-wide text-ima-gold-text">{nomMois(c.month)}</span>
                    <Link href={`${base}/${c.id}`} className="font-semibold text-ima-navy underline">
                      {titreTheme(c.theme)}
                    </Link>
                    {c.theme.fiche?.journee && <span className="block text-sm text-ima-muted">{c.theme.fiche.journee}</span>}
                  </p>
                  <span className={`rounded-sm border px-2 py-0.5 text-sm font-semibold ${COULEURS[c.status]}`}>
                    {t(`statuts.${c.status}`)}
                    {c.diffusedOn ? ` · ${date(c.diffusedOn)}` : ""}
                  </span>
                </div>
                <p className="mt-1 text-sm text-ima-muted">{t(`origines.${c.origin}`)}</p>
                {(causes.get(c.id) ?? []).map((cause, i) => (
                  <p key={i} className="mt-1 text-sm">{t("causeLine", { cause: texteCause(cause) })}</p>
                ))}
                {action && <p className="mt-1 text-sm">{t("linkedAction", { action: action.titre })}</p>}
                {c.comment && <p className="mt-1 text-sm">{c.comment}</p>}
                {modifiable && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm font-semibold text-ima-navy">{t("update")}</summary>
                    <div className="mt-3 flex flex-col gap-6">
                      <FormulaireAction action={actionMajCampagne.bind(null, locale, organizationId, c.id)} libelle={t("save")} enCours={t("working")} className="flex max-w-xl flex-col gap-3">
                        <div className="grid gap-3 sm:grid-cols-3">
                          <Selection id={`mois-${c.id}`} name="mois" label={t("month")} options={moisOptions()} defaultValue={String(c.month)} />
                          <Selection
                            id={`statut-${c.id}`}
                            name="statut"
                            label={t("status")}
                            options={STATUTS_SENSIB.map((st) => ({ valeur: st, libelle: t(`statuts.${st}`) }))}
                            defaultValue={c.status}
                          />
                          <Champ id={`date-${c.id}`} name="diffuseeLe" type="date" max={aujourdhui} label={t("diffusedOn")} defaultValue={c.diffusedOn ?? ""} />
                        </div>
                        <Champ id={`commentaire-${c.id}`} name="commentaire" label={t("comment")} aide={t("commentHelp")} maxLength={500} defaultValue={c.comment ?? ""} />
                      </FormulaireAction>
                      {lien && (
                        <FormulaireAction action={actionLierAction.bind(null, locale, organizationId, c.id)} libelle={t("link")} enCours={t("working")} className="flex max-w-xl flex-col gap-3">
                          <Selection
                            id={`action-${c.id}`}
                            name="action"
                            label={t("planAction")}
                            options={[
                              { valeur: "", libelle: t("noAction") },
                              ...actions.map((a) => ({ valeur: a.id, libelle: a.risques.includes(c.originRef ?? "") ? `${a.titre} ${t("suggestedAction")}` : a.titre })),
                            ]}
                            defaultValue={action?.id ?? ""}
                          />
                        </FormulaireAction>
                      )}
                    </div>
                  </details>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {modifiable && disponibles.length > 0 && (
        <section className="max-w-xl">
          <h2 className="mb-3 text-xl">{t("addTitle")}</h2>
          <FormulaireAction action={actionAjouterCampagne.bind(null, locale, organizationId, annee)} libelle={t("add")} enCours={t("working")} viderApresSucces>
            <Selection id="theme" name="theme" label={t("theme")} options={disponibles.map((th) => ({ valeur: th.id, libelle: titreTheme(th) }))} />
            <Selection id="mois" name="mois" label={t("month")} options={moisOptions()} />
          </FormulaireAction>
        </section>
      )}

      {/* Événements de l'entreprise : un type et une date, sans nom ni récit */}
      {modifiable && (
        <section aria-labelledby="evenements" className="flex max-w-xl flex-col gap-3">
          <h2 id="evenements" className="text-xl">{t("eventsTitle")}</h2>
          <p className="text-sm text-ima-muted">{t("eventsHelp")}</p>
          <FormulaireAction action={actionDeclarerEvenement.bind(null, locale, organizationId)} libelle={t("declare")} enCours={t("working")} viderApresSucces>
            <div className="grid gap-3 sm:grid-cols-2">
              <Selection id="type" name="type" label={t("eventType")} options={EVENEMENTS.map((e) => ({ valeur: e, libelle: t(`evenements.${e}`) }))} />
              <Champ id="date-evenement" name="date" type="date" max={aujourdhui} label={t("eventDate")} required defaultValue={aujourdhui} />
            </div>
          </FormulaireAction>
          {evenements.length > 0 && (
            <ul className="flex flex-col gap-1 text-sm">
              {evenements.map((e) => (
                <li key={e.id}>
                  {date(e.occurredOn)} · {t(`evenements.${e.type}`)}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
