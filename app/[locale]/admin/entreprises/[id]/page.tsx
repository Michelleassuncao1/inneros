import { and, asc, desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { z } from "zod";
import { Cellule, EspaceAdmin, Tableau, TitrePage } from "@/components/EspaceAdmin";
import { Champ } from "@/components/Formulaire";
import { FormulaireAction } from "@/components/FormulaireAction";
import { Link } from "@/i18n/navigation";
import { exigerAdmin } from "@/lib/auth/acces";
import { getDb } from "@/lib/db/client";
import { campaigns, organizations, users } from "@/lib/db/schema";
import {
  actionAjouterReferent,
  actionEtatReferent,
  actionModifierEntreprise,
  actionModifierReferent,
} from "../../actions";
import { ChampsEntreprise } from "../../ChampsFormulaires";

export default async function EntreprisePage({ params }: PageProps<"/[locale]/admin/entreprises/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await exigerAdmin(locale);
  if (!z.string().uuid().safeParse(id).success) notFound();

  const db = getDb();
  const [org] = await db.select().from(organizations).where(eq(organizations.id, id));
  if (!org) notFound();
  const [referents, listeCampagnes] = await Promise.all([
    db
      .select()
      .from(users)
      .where(and(eq(users.organizationId, id), eq(users.role, "referent")))
      .orderBy(asc(users.name)),
    db.select().from(campaigns).where(eq(campaigns.organizationId, id)).orderBy(desc(campaigns.createdAt)),
  ]);

  const t = await getTranslations("Entreprises");
  const tc = await getTranslations("Campagnes");
  const l = await getTranslations("Libelles");

  return (
    <EspaceAdmin locale={locale} actif="entreprises">
      <TitrePage surtitre={t("editTitle")} titre={org.name} />
      <p className="font-semibold text-ima-navy">
        {t("internalCode", { code: org.internalCode })}
      </p>
      <p className="mb-8 text-sm text-ima-muted">{t("internalCodeHelp")}</p>

      <FormulaireAction
        action={actionModifierEntreprise.bind(null, locale, id)}
        libelle={t("save")}
        enCours={t("saving")}
      >
        <ChampsEntreprise valeurs={org} />
      </FormulaireAction>

      <section aria-labelledby="referents" className="mt-12">
        <h2 id="referents" className="text-xl">{t("referentsTitle")}</h2>
        <p className="mb-4 mt-2 max-w-[70ch] text-sm text-ima-muted">{t("referentsHelp")}</p>
        {referents.length === 0 ? (
          <p className="mb-6">{t("noReferent")}</p>
        ) : (
          <div className="mb-6">
            <Tableau entetes={[t("colName"), t("colEmail"), t("colState"), ""]}>
              {referents.map((r) => (
                <tr key={r.id}>
                  <Cellule>{r.name}</Cellule>
                  <Cellule>{r.email}</Cellule>
                  <Cellule>{r.disabledAt ? t("disabled") : t("active")}</Cellule>
                  <Cellule>
                    <form action={actionEtatReferent.bind(null, locale, id, r.id, !!r.disabledAt)}>
                      <button type="submit" className="text-sm font-semibold text-ima-navy underline">
                        {r.disabledAt ? t("enable") : t("disable")}
                      </button>
                    </form>
                  </Cellule>
                </tr>
              ))}
            </Tableau>
            {referents.map((r) => (
              <details key={r.id} className="mt-3 rounded-md border border-ima-line bg-white px-4 py-3">
                <summary className="cursor-pointer font-semibold text-ima-navy">
                  {t("edit")} — {r.name}
                </summary>
                <p className="mb-4 mt-2 text-sm text-ima-muted">{t("editReferentHelp")}</p>
                <FormulaireAction
                  action={actionModifierReferent.bind(null, locale, id, r.id)}
                  libelle={t("save")}
                  enCours={t("saving")}
                  secondaire
                >
                  <Champ
                    id={`nom-${r.id}`}
                    name="name"
                    label={t("referentName")}
                    defaultValue={r.name}
                    required
                    maxLength={120}
                  />
                  <Champ
                    id={`email-${r.id}`}
                    name="email"
                    type="email"
                    label={t("referentEmail")}
                    defaultValue={r.email}
                    required
                    maxLength={254}
                  />
                </FormulaireAction>
              </details>
            ))}
          </div>
        )}
        <FormulaireAction
          action={actionAjouterReferent.bind(null, locale, id)}
          libelle={t("addReferent")}
          enCours={t("adding")}
          viderApresSucces
          secondaire
        >
          <Champ id="ref-name" name="name" label={t("referentName")} required maxLength={120} />
          <Champ id="ref-email" name="email" type="email" label={t("referentEmail")} required maxLength={254} />
        </FormulaireAction>
      </section>

      <section aria-labelledby="campagnes" className="mt-12">
        <h2 id="campagnes" className="text-xl">{t("campaignsTitle")}</h2>
        <div className="my-4">
          <Link
            href={`/admin/campagnes/nouvelle?entreprise=${id}`}
            className="inline-block rounded-md bg-ima-navy px-5 py-2.5 font-semibold text-white hover:bg-ima-navy-deep"
          >
            {t("newCampaign")}
          </Link>
        </div>
        {listeCampagnes.length === 0 ? (
          <p>{tc("none")}</p>
        ) : (
          <Tableau entetes={[tc("colMandate"), tc("colDates"), tc("colStatus")]}>
            {listeCampagnes.map((c) => (
              <tr key={c.id}>
                <Cellule>
                  <Link href={`/admin/campagnes/${c.id}`} className="font-semibold text-ima-navy underline">
                    {l(`mandate.${c.mandateType}`)} — {c.mandateReference}
                  </Link>
                </Cellule>
                <Cellule>
                  {c.startDate} → {c.endDate}
                </Cellule>
                <Cellule>{l(`status.${c.status}`)}</Cellule>
              </tr>
            ))}
          </Tableau>
        )}
      </section>
    </EspaceAdmin>
  );
}
