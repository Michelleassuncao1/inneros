import { and, asc, eq, isNull } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { z } from "zod";
import { Cellule, EspaceAdmin, Tableau, TitrePage } from "@/components/EspaceAdmin";
import { CasesACocher, Champ, MessageInfo } from "@/components/Formulaire";
import { FormulaireAction } from "@/components/FormulaireAction";
import { Pays } from "@/components/Drapeau";
import { Link } from "@/i18n/navigation";
import { exigerAdmin } from "@/lib/auth/acces";
import { getDb } from "@/lib/db/client";
import {
  campaignInstruments,
  campaignReferents,
  campaigns,
  groups,
  instruments,
  organizations,
  users,
} from "@/lib/db/schema";
import {
  actionAjouterGroupe,
  actionModifierCampagne,
  actionQuestionnaires,
  actionReferentsCampagne,
  actionSupprimerGroupe,
} from "../../actions";
import { ChampsCampagne } from "../../ChampsFormulaires";
import { SectionCycle, SectionJetons, SectionKit } from "./Sections";
import { languesDuPays } from "@/lib/pays";

export default async function CampagnePage({ params }: PageProps<"/[locale]/admin/campagnes/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await exigerAdmin(locale);
  if (!z.string().uuid().safeParse(id).success) notFound();

  const db = getDb();
  const [ligne] = await db
    .select({ campagne: campaigns, entreprise: organizations })
    .from(campaigns)
    .innerJoin(organizations, eq(campaigns.organizationId, organizations.id))
    .where(eq(campaigns.id, id));
  if (!ligne) notFound();
  const { campagne, entreprise } = ligne;

  const [listeGroupes, tousInstruments, choisis, referentsEntreprise, acces] = await Promise.all([
    db.select().from(groups).where(eq(groups.campaignId, id)).orderBy(asc(groups.label)),
    db.select().from(instruments).orderBy(asc(instruments.code)),
    db.select().from(campaignInstruments).where(eq(campaignInstruments.campaignId, id)),
    db
      .select()
      .from(users)
      .where(
        and(eq(users.organizationId, entreprise.id), eq(users.role, "referent"), isNull(users.disabledAt)),
      )
      .orderBy(asc(users.name)),
    db.select().from(campaignReferents).where(eq(campaignReferents.campaignId, id)),
  ]);

  const t = await getTranslations("Campagnes");
  const l = await getTranslations("Libelles");
  const brouillon = campagne.status === "draft";
  const total = listeGroupes.reduce((s, g) => s + g.expectedSize, 0);
  const critere = l(`grouping.${campagne.groupingCriterion}`);

  return (
    <EspaceAdmin locale={locale} actif="campagnes">
      <TitrePage
        surtitre={`${l(`mandate.${campagne.mandateType}`)} — ${campagne.mandateReference}`}
        titre={entreprise.name}
      />
      <ul className="mb-8 flex flex-wrap gap-x-6 gap-y-1 font-semibold text-ima-navy">
        <li>
          <Link href={`/admin/entreprises/${entreprise.id}`} className="underline">
            <Pays code={entreprise.country} nom={l(`country.${entreprise.country}`)} />
          </Link>
        </li>
        <li>{t("status", { status: l(`status.${campagne.status}`) })}</li>
        <li>{t("threshold", { seuil: campagne.groupMinSize })}</li>
        <li>{t("groupingInfo", { critere })}</li>
      </ul>
      {!brouillon && (
        <div className="mb-8">
          <MessageInfo>{t("locked")}</MessageInfo>
        </div>
      )}

      <SectionCycle locale={locale} campagne={campagne} />
      <SectionJetons locale={locale} campagne={campagne} effectifTotal={total} />
      <SectionKit campagne={campagne} />

      <section aria-labelledby="groupes">
        <h2 id="groupes" className="text-xl">{t("groupsTitle")}</h2>
        <p className="mb-4 mt-2 max-w-[70ch] text-sm text-ima-muted">
          {t("groupsHelp", { seuil: campagne.groupMinSize })}
        </p>
        {listeGroupes.length === 0 ? (
          <p className="mb-6">{t("noGroup")}</p>
        ) : (
          <div className="mb-6">
            <Tableau entetes={[t("colLabel"), t("colExpected"), ""]}>
              {listeGroupes.map((g) => (
                <tr key={g.id}>
                  <Cellule>{g.label}</Cellule>
                  <Cellule>{g.expectedSize}</Cellule>
                  <Cellule>
                    {brouillon && (
                      <form action={actionSupprimerGroupe.bind(null, locale, id, g.id)}>
                        <button type="submit" className="text-sm font-semibold text-ima-navy underline">
                          {t("deleteGroup")}
                        </button>
                      </form>
                    )}
                  </Cellule>
                </tr>
              ))}
            </Tableau>
            <p className="mt-2 font-semibold">{t("total", { total })}</p>
          </div>
        )}
        {brouillon && (
          <FormulaireAction
            action={actionAjouterGroupe.bind(null, locale, id)}
            libelle={t("addGroup")}
            enCours={t("adding")}
            viderApresSucces
            secondaire
          >
            <Champ id="label" name="label" label={t("labelFor", { critere })} aide={t("labelHelp")} required maxLength={80} />
            <Champ
              id="expectedSize"
              name="expectedSize"
              type="number"
              min={1}
              label={t("expectedSize")}
              required
            />
          </FormulaireAction>
        )}
      </section>

      <section aria-labelledby="acces" className="mt-12">
        <h2 id="acces" className="text-xl">{t("referentsTitle")}</h2>
        <p className="mb-4 mt-2 max-w-[70ch] text-sm text-ima-muted">{t("referentsHelp")}</p>
        {referentsEntreprise.length === 0 ? (
          <p>{t("referentsNone")}</p>
        ) : (
          <>
            {acces.length === 0 && (
              <div className="mb-4 max-w-xl">
                <MessageInfo>{t("referentsEmpty")}</MessageInfo>
              </div>
            )}
            <FormulaireAction
              action={actionReferentsCampagne.bind(null, locale, id)}
              libelle={t("saveReferents")}
              enCours={t("saving")}
              secondaire
            >
              <CasesACocher
                legende={t("referentsLegend")}
                name="referents"
                options={referentsEntreprise.map((r) => ({
                  valeur: r.id,
                  libelle: `${r.name} — ${r.email}`,
                }))}
                cochees={acces.map((a) => a.userId)}
              />
            </FormulaireAction>
          </>
        )}
      </section>

      <section aria-labelledby="questionnaires" className="mt-12">
        <h2 id="questionnaires" className="mb-4 text-xl">{t("instrumentsTitle")}</h2>
        {tousInstruments.length === 0 ? (
          <p>{t("instrumentsNone")}</p>
        ) : (
          <FormulaireAction
            action={actionQuestionnaires.bind(null, locale, id)}
            libelle={t("saveInstruments")}
            enCours={t("saving")}
            secondaire
          >
            <CasesACocher
              legende={t("instrumentsLegend")}
              name="instruments"
              options={tousInstruments.map((i) => ({
                valeur: i.id,
                libelle: `${i.code} ${i.version}${i.isTest ? ` (${l("test")})` : ""}`,
              }))}
              cochees={choisis.map((c) => c.instrumentId)}
              aide={t("instrumentsTestHelp")}
            />
          </FormulaireAction>
        )}
      </section>

      <section aria-labelledby="parametres" className="mt-12">
        <h2 id="parametres" className="mb-4 text-xl">{t("detailsTitle")}</h2>
        {brouillon ? (
          <FormulaireAction
            action={actionModifierCampagne.bind(null, locale, id)}
            libelle={t("save")}
            enCours={t("saving")}
          >
            <ChampsCampagne
              valeurs={campagne}
              langueParDefaut={entreprise.locale}
              languesPossibles={languesDuPays(entreprise.country)}
            />
          </FormulaireAction>
        ) : (
          <p>
            {campagne.startDate} → {campagne.endDate}
          </p>
        )}
      </section>
    </EspaceAdmin>
  );
}
