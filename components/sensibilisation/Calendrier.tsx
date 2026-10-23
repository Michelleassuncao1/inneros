// Calendrier de sensibilisation d'une entreprise (module B2), commun à l'espace IMA et à l'espace référent :
// campagnes de l'année mois par mois, calendrier proposé, ajout, suivi « prévue → diffusée → réalisée ».
import { getTranslations } from "next-intl/server";
import { actionAjouterCampagne, actionMajCampagne, actionProposerCalendrier } from "@/app/[locale]/calendrier/actions";
import { Champ, MessageInfo, Selection } from "@/components/Formulaire";
import { FormulaireAction } from "@/components/FormulaireAction";
import { Link } from "@/i18n/navigation";
import type { users } from "@/lib/db/schema";
import { getDb } from "@/lib/db/client";
import { lireCalendrier, peutModifierCalendrier, STATUTS_SENSIB, themesDisponibles } from "@/lib/sensibilisation/calendrier";

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
  const db = getDb();
  const campagnes = await lireCalendrier(db, utilisateur, organizationId, annee);
  if (!campagnes) return null;
  const modifiable = peutModifierCalendrier(utilisateur, organizationId);
  const disponibles = modifiable ? (await themesDisponibles(db, organizationId, annee)).filter((th) => !th.dejaPrevu) : [];
  const nomMois = (m: number) => new Intl.DateTimeFormat(locale, { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(annee, m - 1, 1)));
  const moisOptions = Array.from({ length: 12 }, (_, i) => ({ valeur: String(i + 1), libelle: nomMois(i + 1) }));
  const titre = (c: (typeof campagnes)[number]) => c.theme.kitsLus[locale as "fr"]?.titre || c.theme.kitsLus.fr?.titre || c.theme.code;
  const aujourdhui = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex flex-col gap-10">
      <nav className="flex items-center gap-4" aria-label={t("year")}>
        <Link href={`${base}?annee=${annee - 1}`} className="font-semibold text-ima-navy underline">← {annee - 1}</Link>
        <span className="text-xl font-semibold text-ima-navy">{annee}</span>
        <Link href={`${base}?annee=${annee + 1}`} className="font-semibold text-ima-navy underline">{annee + 1} →</Link>
      </nav>

      {!modifiable && <MessageInfo>{t("readOnly")}</MessageInfo>}

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
          {campagnes.map((c) => (
            <li key={c.id} className={`rounded-md border bg-white p-4 ${c.status === "retiree" ? "opacity-60" : ""}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p>
                  <span className="mr-3 text-sm font-semibold uppercase tracking-wide text-ima-gold-text">{nomMois(c.month)}</span>
                  <Link href={`${base}/${c.id}`} className="font-semibold text-ima-navy underline">
                    {titre(c)}
                  </Link>
                  {c.theme.fiche?.journee && <span className="block text-sm text-ima-muted">{c.theme.fiche.journee}</span>}
                </p>
                <span className={`rounded-sm border px-2 py-0.5 text-sm font-semibold ${COULEURS[c.status]}`}>
                  {t(`statuts.${c.status}`)}
                  {c.diffusedOn ? ` · ${new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${c.diffusedOn}T00:00:00Z`))}` : ""}
                </span>
              </div>
              <p className="mt-1 text-sm text-ima-muted">{t(`origines.${c.origin}`)}</p>
              {c.comment && <p className="mt-1 text-sm">{c.comment}</p>}
              {modifiable && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-sm font-semibold text-ima-navy">{t("update")}</summary>
                  <div className="mt-3">
                    <FormulaireAction action={actionMajCampagne.bind(null, locale, organizationId, c.id)} libelle={t("save")} enCours={t("working")} className="flex max-w-xl flex-col gap-3">
                      <div className="grid gap-3 sm:grid-cols-3">
                        <Selection id={`mois-${c.id}`} name="mois" label={t("month")} options={moisOptions} defaultValue={String(c.month)} />
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
                  </div>
                </details>
              )}
            </li>
          ))}
        </ol>
      )}

      {modifiable && disponibles.length > 0 && (
        <section className="max-w-xl">
          <h2 className="mb-3 text-xl">{t("addTitle")}</h2>
          <FormulaireAction action={actionAjouterCampagne.bind(null, locale, organizationId, annee)} libelle={t("add")} enCours={t("working")} viderApresSucces>
            <Selection
              id="theme"
              name="theme"
              label={t("theme")}
              options={disponibles.map((th) => ({ valeur: th.id, libelle: th.kitsLus[locale as "fr"]?.titre || th.kitsLus.fr?.titre || th.code }))}
            />
            <Selection id="mois" name="mois" label={t("month")} options={moisOptions} />
          </FormulaireAction>
        </section>
      )}
    </div>
  );
}
