// Écran du rapport (étape 8A) : interrupteur IA, brouillon IA ou rédaction à la main, relecture à côté
// des données sources, refus motivé, validation IMA (liste de contrôle, praticien formé à l'IA).
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { z } from "zod";
import { AffichageRapport, type TextesRapport } from "@/components/AffichageRapport";
import { Cellule, EspaceAdmin, Tableau, TitrePage } from "@/components/EspaceAdmin";
import { MessageInfo, Selection, ZoneTexte } from "@/components/Formulaire";
import { FormulaireAction } from "@/components/FormulaireAction";
import { Link } from "@/i18n/navigation";
import { exigerAdmin } from "@/lib/auth/acces";
import { getDb } from "@/lib/db/client";
import { campaigns, organizations, users } from "@/lib/db/schema";
import { contenuVide, LANGUES_RAPPORT, lireContenu } from "@/lib/rapport/contenu";
import { iaActiveGlobalement, rapportCourant } from "@/lib/rapport/rapports";
import { lireResultats } from "@/lib/resultats/agregats";
import {
  actionEnregistrerRapport,
  actionGenererBrouillon,
  actionInterrupteurIA,
  actionRapportManuel,
  actionRefuserRapport,
  actionValiderRapport,
} from "./actions";
import { EditeurRapport } from "./EditeurRapport";

// La rédaction par l'IA peut prendre jusqu'à une minute
export const maxDuration = 300;

const NIVEAUX = ["travail", "roles", "interactions", "management", "organisation", "environnement", "sante", "aucun"] as const;

export default async function RapportPage({ params }: PageProps<"/[locale]/admin/campagnes/[id]/rapport">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const admin = await exigerAdmin(locale);
  if (!z.string().uuid().safeParse(id).success) notFound();

  const db = getDb();
  const [ligne] = await db
    .select({ campagne: campaigns, entreprise: organizations })
    .from(campaigns)
    .innerJoin(organizations, eq(campaigns.organizationId, organizations.id))
    .where(eq(campaigns.id, id));
  if (!ligne) notFound();
  const { campagne, entreprise } = ligne;

  const t = await getTranslations("Rapport");
  const tr = await getTranslations("Resultats");
  const l = await getTranslations("Libelles");
  const textes: TextesRapport = {
    l: {
    ...Object.fromEntries(
      ["synthese", "cartographie", "constat", "nature", "confiance", "sources", "addConstat", "remove", "priorites", "priorite", "justification", "acteurs", "addPriorite", "orientations", "limites", "questions", "addLigne", "save", "saving", "validateTitle", "validate", "validating", "validateHelp", "trainingMissing"].map((k) => [k, t(k)]),
    ),
    check_sources: t("checkSources"),
    check_seuil: t("checkSeuil", { seuil: campagne.groupMinSize }),
    check_langage: t("checkLangage"),
    check_limites: t("checkLimites"),
    },
    natures: t.raw("natures") as Record<string, string>,
    confiances: t.raw("confiances") as Record<string, string>,
    acteursListe: t.raw("acteursListe") as Record<string, string>,
    niveaux: tr.raw("levels") as Record<string, string>,
  };

  const rapport = campagne.status === "closed" ? await rapportCourant(db, id) : null;
  const resultats = campagne.status === "closed" ? await lireResultats(db, id, rapport?.language ?? locale) : null;
  const iaPossible = iaActiveGlobalement() && campagne.aiDraftingEnabled;
  const [moi] = await db.select({ aiLiteracyAt: users.aiLiteracyAt }).from(users).where(eq(users.id, admin.id));
  const date = (d: Date) => new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(d);
  const nombre = (v: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(v);
  const optionsLangue = LANGUES_RAPPORT.map((lg) => ({ valeur: lg, libelle: l(`locale.${lg}`) }));
  const validateur = rapport?.validatedBy
    ? (await db.select({ name: users.name }).from(users).where(eq(users.id, rapport.validatedBy)))[0]?.name
    : null;

  // Données sources, avec les identifiants transmis à l'IA (G1, G2… dans l'ordre alphabétique des groupes)
  const sources = resultats && (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-ima-muted">
        {resultats.groupes.map((g, i) => `G${i + 1} = ${g.libelle}`).join(" · ")}
      </p>
      {resultats.questionnaires.map((q) => (
        <div key={q.titre}>
          <h4 className="mb-2 font-semibold text-ima-navy">{q.titre}</h4>
          {NIVEAUX.map((niveau) => {
            const dims = q.dimensions.filter((d) => (d.niveau ?? "aucun") === niveau && d.resultats.length);
            if (!dims.length) return null;
            return (
              <div key={niveau} className="mb-3">
                <p className="mb-1 text-sm font-semibold">{tr(`levels.${niveau}`)}</p>
                <Tableau entetes={[tr("scale"), tr("all"), ...resultats.groupes.map((_, i) => `G${i + 1}`)]}>
                  {dims.map((d) => {
                    const cellule = (gid: string | null) => {
                      const r = d.resultats.find((x) => x.groupId === gid);
                      return r ? `${nombre(r.moyenne)} (${r.n})` : "—";
                    };
                    return (
                      <tr key={d.id}>
                        <Cellule>
                          {d.nom} <span className="text-xs text-ima-muted">[{d.id}]</span>
                        </Cellule>
                        <Cellule>{cellule(null)}</Cellule>
                        {resultats.groupes.map((g) => (
                          <Cellule key={g.id}>{cellule(g.id)}</Cellule>
                        ))}
                      </tr>
                    );
                  })}
                </Tableau>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );

  return (
    <EspaceAdmin locale={locale} actif="campagnes">
      <TitrePage surtitre={`${t("title")} — ${campagne.mandateReference}`} titre={entreprise.name} />
      <p className="mb-6">
        <Link href={`/admin/campagnes/${id}`} className="font-semibold text-ima-navy underline">
          {t("back")}
        </Link>
      </p>

      {campagne.status !== "closed" ? (
        <MessageInfo>{t("notClosed")}</MessageInfo>
      ) : !resultats ? (
        <MessageInfo>{t("noResults", { seuil: campagne.groupMinSize })}</MessageInfo>
      ) : rapport?.status === "validated" ? (
        // Rapport validé : lecture seule
        <div className="flex flex-col gap-6">
          <MessageInfo>{t("validatedBanner", { nom: validateur ?? "—", date: date(rapport.validatedAt!) })}</MessageInfo>
          <p className="font-semibold text-ima-navy">
            {rapport.aiModel ? t("mentionAi", { nom: validateur ?? "—" }) : t("mentionManual", { nom: validateur ?? "—" })}
          </p>
          <AffichageRapport contenu={lireContenu(rapport.finalText) ?? contenuVide()} textes={textes} />
        </div>
      ) : (
        <div className="flex flex-col gap-10">
          {/* Interrupteur IA */}
          <section className="max-w-3xl">
            <h2 className="text-xl">{t("aiSwitchTitle")}</h2>
            <p className="mt-2">{!iaActiveGlobalement() ? t("aiOffGlobal") : campagne.aiDraftingEnabled ? t("aiOnCampaign") : t("aiOffCampaign")}</p>
            <p className="mb-3 mt-1 text-sm text-ima-muted">{t("aiSwitchHelp")}</p>
            {iaActiveGlobalement() && (
              <FormulaireAction
                action={actionInterrupteurIA.bind(null, locale, id, !campagne.aiDraftingEnabled)}
                libelle={campagne.aiDraftingEnabled ? t("aiDisable") : t("aiEnable")}
                enCours={t("switching")}
                secondaire
              />
            )}
          </section>

          {!rapport ? (
            // Aucun rapport : générer avec l'IA ou rédiger à la main
            <section className="flex max-w-3xl flex-col gap-6">
              <h2 className="text-xl">{t("startTitle")}</h2>
              {iaPossible && (
                <div className="flex flex-col gap-2">
                  <p className="text-sm text-ima-muted">{t("generateHelp", { seuil: campagne.groupMinSize, code: entreprise.internalCode })}</p>
                  <FormulaireAction action={actionGenererBrouillon.bind(null, locale, id)} libelle={t("generate")} enCours={t("generating")}>
                    <Selection id="langue-ia" name="langue" label={t("language")} options={optionsLangue} defaultValue={entreprise.locale} />
                  </FormulaireAction>
                </div>
              )}
              <FormulaireAction action={actionRapportManuel.bind(null, locale, id)} libelle={t("manual")} enCours={t("creating")} secondaire>
                <Selection id="langue-main" name="langue" label={t("language")} options={optionsLangue} defaultValue={entreprise.locale} />
              </FormulaireAction>
            </section>
          ) : (
            // Brouillon en cours : relecture à côté des données sources
            <>
              <div className="rounded-md border-l-[3px] border-ima-gold bg-ima-cream px-4 py-3">
                <p className="font-semibold text-ima-gold-text">{rapport.status === "ai_draft" ? t("bannerAi") : t("bannerManual")}</p>
                {rapport.aiModel && rapport.aiGeneratedAt && (
                  <p className="mt-1 text-sm text-ima-muted">
                    {t("aiMeta", { modele: rapport.aiModel, version: rapport.aiPromptVersion ?? "—", date: date(rapport.aiGeneratedAt) })}
                  </p>
                )}
                <p className="mt-1 text-sm text-ima-muted">
                  {t("language")} : {l(`locale.${rapport.language ?? "fr"}`)}
                </p>
              </div>
              <div className="grid gap-8 lg:grid-cols-2">
                <div className="min-w-0">
                  <EditeurRapport
                    contenuInitial={lireContenu(rapport.finalText) ?? contenuVide()}
                    textes={textes}
                    formationOk={!!moi?.aiLiteracyAt}
                    enregistrer={actionEnregistrerRapport.bind(null, locale, id, rapport.id)}
                    valider={actionValiderRapport.bind(null, locale, id, rapport.id)}
                  />
                </div>
                <aside className="min-w-0 lg:sticky lg:top-4 lg:max-h-[90vh] lg:self-start lg:overflow-y-auto">
                  <h3 className="mb-3 text-lg">{t("sourcesTitle")}</h3>
                  {sources}
                </aside>
              </div>
              <section className="flex max-w-3xl flex-col gap-6 border-t border-ima-line pt-6">
                <div>
                  <h3 className="mb-2 text-lg">{t("rejectTitle")}</h3>
                  <FormulaireAction action={actionRefuserRapport.bind(null, locale, id, rapport.id)} libelle={t("reject")} enCours={t("rejecting")} secondaire>
                    <ZoneTexte id="motif" name="motif" label={t("rejectReason")} required />
                  </FormulaireAction>
                </div>
                {iaPossible && (
                  <div>
                    <h3 className="mb-2 text-lg">{t("regenerateTitle")}</h3>
                    <FormulaireAction action={actionGenererBrouillon.bind(null, locale, id)} libelle={t("regenerate")} enCours={t("generating")} secondaire>
                      <Selection id="langue-regen" name="langue" label={t("language")} options={optionsLangue} defaultValue={rapport.language ?? entreprise.locale} />
                    </FormulaireAction>
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      )}
    </EspaceAdmin>
  );
}
