import { asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { z } from "zod";
import { Cellule, EspaceAdmin, Tableau, TitrePage } from "@/components/EspaceAdmin";
import { CasesACocher, Champ, MessageInfo } from "@/components/Formulaire";
import { FormulaireAction } from "@/components/FormulaireAction";
import { Link } from "@/i18n/navigation";
import { exigerAdmin } from "@/lib/auth/acces";
import { getDb } from "@/lib/db/client";
import { campaignInstruments, campaigns, groups, instruments, organizations } from "@/lib/db/schema";
import {
  actionAjouterGroupe,
  actionModifierCampagne,
  actionQuestionnaires,
  actionSupprimerGroupe,
} from "../../actions";
import { ChampsCampagne } from "../../ChampsFormulaires";

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

  const [listeGroupes, tousInstruments, choisis] = await Promise.all([
    db.select().from(groups).where(eq(groups.campaignId, id)).orderBy(asc(groups.label)),
    db.select().from(instruments).orderBy(asc(instruments.code)),
    db.select().from(campaignInstruments).where(eq(campaignInstruments.campaignId, id)),
  ]);

  const t = await getTranslations("Campagnes");
  const l = await getTranslations("Libelles");
  const brouillon = campagne.status === "draft";
  const total = listeGroupes.reduce((s, g) => s + g.expectedSize, 0);

  return (
    <EspaceAdmin locale={locale} actif="campagnes">
      <TitrePage
        surtitre={`${l(`mandate.${campagne.mandateType}`)} — ${campagne.mandateReference}`}
        titre={entreprise.name}
      />
      <ul className="mb-8 flex flex-wrap gap-x-6 gap-y-1 font-semibold text-ima-navy">
        <li>
          <Link href={`/admin/entreprises/${entreprise.id}`} className="underline">
            {l(`country.${entreprise.country}`)}
          </Link>
        </li>
        <li>{t("status", { status: l(`status.${campagne.status}`) })}</li>
        <li>{t("threshold", { seuil: campagne.groupMinSize })}</li>
      </ul>
      {!brouillon && (
        <div className="mb-8">
          <MessageInfo>{t("locked")}</MessageInfo>
        </div>
      )}

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
            <Champ id="label" name="label" label={t("label")} aide={t("labelHelp")} required maxLength={80} />
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
            <ChampsCampagne valeurs={campagne} langueParDefaut={entreprise.locale} />
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
