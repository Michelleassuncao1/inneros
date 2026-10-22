// Plan de prévention RPS d'une entreprise, côté IMA (module A2) : plan en vigueur, brouillon en cours
// (éditeur), démarrage d'un plan (IA ou à la main), historique des versions.
import { desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { z } from "zod";
import { Cellule, EspaceAdmin, Tableau, TitrePage } from "@/components/EspaceAdmin";
import { Champ, Selection } from "@/components/Formulaire";
import { FormulaireAction } from "@/components/FormulaireAction";
import { AffichagePlan } from "@/components/plan/AffichagePlan";
import { SuiviPlan } from "@/components/plan/SuiviPlan";
import { Link } from "@/i18n/navigation";
import { exigerAdmin } from "@/lib/auth/acces";
import { getDb } from "@/lib/db/client";
import { organizations, preventionPlans, users } from "@/lib/db/schema";
import { lireContenuPlan } from "@/lib/plan/contenu";
import { lirePlans, rapportDeReference } from "@/lib/plan/plans";
import { LANGUES_RAPPORT } from "@/lib/rapport/contenu";
import { iaActiveGlobalement } from "@/lib/rapport/rapports";
import { lireRegistre } from "@/lib/risques/registre";
import { actionEnregistrerPlan, actionGenererPlan, actionPlanManuel, actionRefuserPlan, actionValiderPlan } from "./actions";
import { EditeurPlan } from "./EditeurPlan";

// Textes de l'éditeur (bruts : les repères {n} et {annee} sont remplacés dans l'éditeur)
const CLES_EDITEUR = [
  "pgpTitle", "rappel", "objectifs", "objectif", "mesures", "mesure", "niveauPrevention", "moyens", "roles", "fonction", "role",
  "calendrier", "annee", "evaluation", "cadre", "paaTitle", "actionTitre", "actionDescription", "colResponsable", "colEcheance",
  "colBudget", "colIndicateur", "colEffort", "trimestre", "risquesVises", "noName", "add", "addAction", "remove", "up", "questions", "save",
  "saving", "validateTitle", "trainingMissing", "check_risques", "check_fonctions", "check_cadre", "check_langage", "validateHelp",
  "validate", "validating",
] as const;

export default async function PlanAdminPage({ params }: PageProps<"/[locale]/admin/entreprises/[id]/plan">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const admin = await exigerAdmin(locale);
  if (!z.string().uuid().safeParse(id).success) notFound();
  const db = getDb();
  const [org] = await db.select().from(organizations).where(eq(organizations.id, id));
  if (!org) notFound();

  const t = await getTranslations("Plan");
  const tr = await getTranslations("Risques");
  const tres = await getTranslations("Resultats");
  const te = await getTranslations("Erreurs");
  const l = await getTranslations("Libelles");
  const tj = await getTranslations("Journal");
  const [{ valide, brouillon }, ref, registre, historique] = await Promise.all([
    lirePlans(db, id),
    rapportDeReference(db, id),
    lireRegistre(db, admin, id),
    db.select().from(preventionPlans).where(eq(preventionPlans.organizationId, id)).orderBy(desc(preventionPlans.createdAt)),
  ]);
  const risques = registre ?? [];
  const nomsRisques = new Map(risques.map((r) => [r.id, r.title]));
  const date = (d: Date) => new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(d);
  const nomDe = async (uid: string | null) =>
    uid ? ((await db.select({ name: users.name }).from(users).where(eq(users.id, uid)))[0]?.name ?? "—") : "—";
  const contenuValide = valide ? lireContenuPlan(valide.content) : null;
  const contenuBrouillon = brouillon ? lireContenuPlan(brouillon.content) : null;
  const iaPossible = iaActiveGlobalement() && !!ref?.campagne.aiDraftingEnabled;
  const anneeParDefaut = new Date().getFullYear() + 1;
  const optionsLangue = LANGUES_RAPPORT.map((lg) => ({ valeur: lg, libelle: l(`locale.${lg}`) }));
  const champsDepart = (prefixe: string) => (
    <div className="grid gap-4 sm:grid-cols-2">
      <Selection id={`${prefixe}-langue`} name="langue" label={t("language")} options={optionsLangue} defaultValue={org.locale} />
      <Champ id={`${prefixe}-annee`} name="annee" type="number" min={2020} max={2100} label={t("startYear")} defaultValue={anneeParDefaut} required />
    </div>
  );

  return (
    <EspaceAdmin locale={locale} actif="entreprises">
      <TitrePage surtitre={t("title")} titre={org.name} />
      <p className="mb-4">
        <Link href={`/admin/entreprises/${id}/risques`} className="font-semibold text-ima-navy underline">
          {t("backRegister")}
        </Link>
      </p>
      <p className="mb-10 max-w-[70ch] text-ima-muted">{t("intro")}</p>

      <section aria-labelledby="vigueur" className="mb-12">
        <h2 id="vigueur" className="mb-2 text-2xl">{t("validTitle")}</h2>
        {valide && contenuValide ? (
          <>
            <p className="mb-2 text-sm text-ima-muted">
              {t("validMeta", { debut: valide.startYear, fin: valide.startYear + 4, nom: await nomDe(valide.validatedBy), date: date(valide.validatedAt!) })}
            </p>
            <p className="mb-6 text-sm font-semibold">
              {valide.aiModel ? t("mentionAi", { nom: await nomDe(valide.validatedBy) }) : t("mentionManual", { nom: await nomDe(valide.validatedBy) })}
            </p>
            <div className="mb-10">
              <SuiviPlan plan={valide} locale={locale} peutAdopter={false} peutSuivre />
            </div>
            <AffichagePlan contenu={contenuValide} startYear={valide.startYear} risques={nomsRisques} avecQuestions />
          </>
        ) : (
          <p>{t("noValid")}</p>
        )}
      </section>

      {brouillon && contenuBrouillon ? (
        <section aria-labelledby="brouillon" className="mb-12 flex flex-col gap-6">
          <h2 id="brouillon" className="text-2xl">{t("draftTitle")}</h2>
          <p className="text-sm text-ima-muted">
            {t("draftMeta", {
              debut: brouillon.startYear,
              fin: brouillon.startYear + 4,
              origine: brouillon.aiModel ? t("fromAi", { modele: brouillon.aiModel }) : t("manual"),
            })}
          </p>
          <p>
            <a href={`/api/plan/${brouillon.id}/pdf?lang=${locale}`} className="font-semibold text-ima-navy underline">
              {t("previewPdf")}
            </a>
          </p>
          <EditeurPlan
            contenuInitial={contenuBrouillon}
            startYear={brouillon.startYear}
            risques={risques.map((r) => ({ id: r.id, title: r.title, classe: r.classe, source: r.source, status: r.status, libelleClasse: tr(`classes.${r.classe}`) }))}
            formationOk={!!admin.aiLiteracyAt}
            textes={{
              l: { ...Object.fromEntries(CLES_EDITEUR.map((k) => [k, t.raw(k) as string])), manquants: te("planRisquesNonCouverts") },
              niveaux: tres.raw("levels") as Record<string, string>,
              prevention: t.raw("niveaux") as Record<string, string>,
              efforts: t.raw("efforts") as Record<string, string>,
            }}
            enregistrer={actionEnregistrerPlan.bind(null, locale, id, brouillon.id)}
            valider={actionValiderPlan.bind(null, locale, id, brouillon.id)}
          />
          <details className="max-w-xl rounded-md border border-ima-line bg-white px-4 py-3">
            <summary className="cursor-pointer font-semibold text-ima-navy">{t("rejectTitle")}</summary>
            <div className="mt-3">
              <FormulaireAction action={actionRefuserPlan.bind(null, locale, id, brouillon.id)} libelle={t("reject")} enCours={t("rejecting")} secondaire>
                <Champ id="motif" name="motif" label={t("rejectReason")} required minLength={5} maxLength={1000} />
              </FormulaireAction>
            </div>
          </details>
        </section>
      ) : (
        <section aria-labelledby="depart" className="mb-12 flex flex-col gap-6">
          <h2 id="depart" className="text-2xl">{t("startTitle")}</h2>
          {!ref ? (
            <p>{t("noReport")}</p>
          ) : (
            <>
              <div className="max-w-xl rounded-md border border-ima-line bg-white p-4">
                {iaPossible ? (
                  <FormulaireAction action={actionGenererPlan.bind(null, locale, id)} libelle={t("generate")} enCours={t("generating")}>
                    {champsDepart("ia")}
                    <p className="text-sm text-ima-muted">{t("aiCost")}</p>
                  </FormulaireAction>
                ) : (
                  <p className="text-sm">{t("aiOff")}</p>
                )}
              </div>
              <div className="max-w-xl rounded-md border border-ima-line bg-white p-4">
                <FormulaireAction action={actionPlanManuel.bind(null, locale, id, false)} libelle={t("manualStart")} enCours={t("starting")} secondaire>
                  {champsDepart("main")}
                </FormulaireAction>
              </div>
              {valide && (
                <div className="max-w-xl rounded-md border border-ima-line bg-white p-4">
                  <FormulaireAction action={actionPlanManuel.bind(null, locale, id, true)} libelle={t("newVersion")} enCours={t("starting")} secondaire>
                    {champsDepart("version")}
                  </FormulaireAction>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {historique.length > 0 && (
        <section aria-labelledby="historique">
          <h2 id="historique" className="mb-4 text-xl">{t("history")}</h2>
          <Tableau entetes={[t("startYear"), tj("date"), tr("colStatus")]}>
            {historique.map((p) => (
              <tr key={p.id}>
                <Cellule>
                  {p.startYear} → {p.startYear + 4}
                </Cellule>
                <Cellule>{date(p.createdAt)}</Cellule>
                <Cellule>
                  {t(`statuts.${p.status}`)}
                  {p.rejectionReason && <span className="block text-sm text-ima-muted">{p.rejectionReason}</span>}
                </Cellule>
              </tr>
            ))}
          </Tableau>
        </section>
      )}
    </EspaceAdmin>
  );
}
