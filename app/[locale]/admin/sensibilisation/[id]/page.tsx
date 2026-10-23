// Un thème de sensibilisation (module B1), côté IMA : fiche, kit par langue (à la main ou avec l'IA),
// validation par un praticien formé à l'IA, archivage.
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { z } from "zod";
import { EspaceAdmin, TitrePage } from "@/components/EspaceAdmin";
import { Champ, MessageErreur, MessageInfo, ZoneTexte } from "@/components/Formulaire";
import { FormulaireAction } from "@/components/FormulaireAction";
import { Link } from "@/i18n/navigation";
import { exigerAdmin } from "@/lib/auth/acces";
import { getDb } from "@/lib/db/client";
import { iaActiveGlobalement } from "@/lib/rapport/rapports";
import { kitComplet, kitVide, LANGUES_THEME, type LangueTheme } from "@/lib/sensibilisation/contenu";
import { themeParId } from "@/lib/sensibilisation/themes";
import { actionArchiverTheme, actionFiche, actionGenererKit, actionKit, actionValiderTheme } from "../actions";
import { ChampsFiche } from "../ChampsFiche";

export default async function ThemePage({ params, searchParams }: PageProps<"/[locale]/admin/sensibilisation/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const admin = await exigerAdmin(locale);
  if (!z.string().uuid().safeParse(id).success) notFound();
  const th = await themeParId(getDb(), id);
  if (!th) notFound();
  const t = await getTranslations("Sensibilisation");
  const l = await getTranslations("Libelles");
  const demandee = (await searchParams).langue;
  const langue: LangueTheme = (LANGUES_THEME as readonly string[]).includes(String(demandee)) ? (demandee as LangueTheme) : "fr";
  const kit = th.kitsLus[langue] ?? { ...kitVide(), titre: th.kitsLus.fr?.titre ?? "", objectif: th.kitsLus.fr?.objectif ?? "" };
  const archive = th.status === "archived";

  return (
    <EspaceAdmin locale={locale} actif="sensibilisation">
      <TitrePage surtitre={t("title")} titre={th.kitsLus.fr?.titre || th.code} />
      <p className="mb-4">
        <Link href="/admin/sensibilisation" className="font-semibold text-ima-navy underline">
          {t("back")}
        </Link>
      </p>
      <p className="mb-8 font-semibold">
        {t(`statuts.${th.status}`)}
        {th.aiModel && <span className="ml-2 text-sm font-normal text-ima-muted">{t("aiDraft", { modele: th.aiModel })}</span>}
      </p>
      {th.fiche?.sensible && (
        <div className="mb-8 max-w-3xl">
          <MessageErreur>{t("sensitiveWarning")}</MessageErreur>
        </div>
      )}

      {!archive && (
        <>
          {/* Kit de la langue choisie */}
          <section aria-labelledby="kit" className="mb-12 max-w-3xl">
            <h2 id="kit" className="mb-3 text-xl">{t("kitTitle")}</h2>
            <nav className="mb-4 flex flex-wrap gap-2" aria-label={t("languages")}>
              {LANGUES_THEME.map((lg) => (
                <Link
                  key={lg}
                  href={`/admin/sensibilisation/${id}?langue=${lg}`}
                  aria-current={lg === langue ? "page" : undefined}
                  className={`rounded-md px-3 py-1.5 text-sm font-semibold ${lg === langue ? "bg-ima-navy text-white" : "border border-ima-line text-ima-navy"}`}
                >
                  {l(`locale.${lg}`)} {kitComplet(th.kitsLus[lg]) ? "✓" : ""}
                </Link>
              ))}
            </nav>
            {iaActiveGlobalement() && (
              <div className="mb-6 rounded-md border border-ima-line bg-white p-4">
                <FormulaireAction action={actionGenererKit.bind(null, locale, id, langue)} libelle={t("generate", { langue: l(`locale.${langue}`) })} enCours={t("generating")} secondaire>
                  <p className="text-sm text-ima-muted">{t("aiHelp")}</p>
                </FormulaireAction>
              </div>
            )}
            <FormulaireAction key={langue} action={actionKit.bind(null, locale, id, langue)} libelle={t("saveKit")} enCours={t("saving")}>
              <p className="text-sm text-ima-muted">{t("supportAuto")}</p>
              <Champ id="k-titre" name="titre" label={t("kTitle")} maxLength={120} defaultValue={kit.titre} />
              <ZoneTexte id="k-objectif" name="objectif" label={t("kObjective")} rows={2} maxLength={500} defaultValue={kit.objectif} />
              <ZoneTexte id="k-article" name="article" label={t("kArticle")} rows={14} maxLength={5000} defaultValue={kit.article} />
              <ZoneTexte id="k-message" name="message_court" label={t("kShort")} rows={3} maxLength={700} defaultValue={kit.message_court} />
              <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
                <Champ id="k-affiche-titre" name="affiche_titre" label={t("kPosterTitle")} maxLength={90} defaultValue={kit.affiche.titre} />
                <ZoneTexte id="k-affiche-texte" name="affiche_texte" label={t("kPosterText")} rows={3} maxLength={450} defaultValue={kit.affiche.texte} />
              </div>
              <ZoneTexte id="k-questions" name="questions" label={t("kQuestions")} aide={t("onePerLine")} rows={5} defaultValue={kit.questions.join("\n")} />
              <Champ id="k-email-objet" name="email_objet" label={t("kEmailSubject")} maxLength={140} defaultValue={kit.email_managers.objet} />
              <ZoneTexte id="k-email-texte" name="email_texte" label={t("kEmailText")} rows={8} maxLength={3000} defaultValue={kit.email_managers.texte} />
              <Champ id="k-duree" name="duree" type="number" min={5} max={60} label={t("kDuration")} defaultValue={kit.fiche_animation.duree_minutes} />
              <ZoneTexte id="k-deroule" name="deroule" label={t("kSteps")} aide={t("onePerLine")} rows={6} defaultValue={kit.fiche_animation.deroule.join("\n")} />
              <ZoneTexte id="k-conseils" name="conseils" label={t("kTips")} aide={t("onePerLine")} rows={4} defaultValue={kit.fiche_animation.conseils.join("\n")} />
            </FormulaireAction>
          </section>

          {/* Validation */}
          <section aria-labelledby="validation" className="mb-12 max-w-3xl rounded-md border-l-[3px] border-ima-gold bg-ima-cream p-4">
            <h2 id="validation" className="text-lg">{t("validateTitle")}</h2>
            <p className="mb-3 mt-1 text-sm">{t("validateHelp")}</p>
            {!admin.aiLiteracyAt && <MessageErreur>{t("trainingMissing")}</MessageErreur>}
            {th.status === "validated" ? (
              <MessageInfo>{t("isValidated")}</MessageInfo>
            ) : (
              <FormulaireAction action={actionValiderTheme.bind(null, locale, id)} libelle={t("validate")} enCours={t("validating")} />
            )}
          </section>

          {/* Fiche */}
          <section aria-labelledby="fiche" className="mb-12 max-w-3xl">
            <h2 id="fiche" className="mb-4 text-xl">{t("sheetTitle")}</h2>
            <FormulaireAction action={actionFiche.bind(null, locale, id)} libelle={t("saveSheet")} enCours={t("saving")} secondaire>
              <ChampsFiche fiche={th.fiche} locale={locale} />
            </FormulaireAction>
          </section>

          <details className="max-w-xl">
            <summary className="cursor-pointer text-sm text-ima-muted underline">{t("archiveTitle")}</summary>
            <div className="mt-3">
              <FormulaireAction action={actionArchiverTheme.bind(null, locale, id)} libelle={t("archive")} enCours={t("saving")} secondaire>
                <p className="text-sm">{t("archiveHelp")}</p>
              </FormulaireAction>
            </div>
          </details>
        </>
      )}
      {archive && <MessageInfo>{t("isArchived")}</MessageInfo>}
    </EspaceAdmin>
  );
}
