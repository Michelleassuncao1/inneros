import { and, asc, desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { z } from "zod";
import { Cellule, EspaceAdmin, Tableau, TitrePage } from "@/components/EspaceAdmin";
import { Champ } from "@/components/Formulaire";
import { FormulaireAction } from "@/components/FormulaireAction";
import { Pays } from "@/components/Drapeau";
import { Link } from "@/i18n/navigation";
import { exigerAdmin } from "@/lib/auth/acces";
import { getDb } from "@/lib/db/client";
import { campaigns, organizations, users } from "@/lib/db/schema";
import {
  actionAjouterReferent,
  actionEtatReferent,
  actionModifierEntreprise,
  actionModifierReferent,
  actionSupprimerReferent,
} from "../../actions";
import { MenuReferent } from "./MenuReferent";
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
      <p className="flex flex-wrap gap-x-6 font-semibold text-ima-navy">
        <Pays code={org.country} nom={l(`country.${org.country}`)} />
        <span>{t("internalCode", { code: org.internalCode })}</span>
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
            <Tableau entetes={[t("colName"), t("colEmail"), t("colState"), t("colActions")]}>
              {referents.map((r) => (
                <tr key={r.id}>
                  <Cellule>{r.name}</Cellule>
                  <Cellule>{r.email}</Cellule>
                  <Cellule>{r.disabledAt ? t("disabled") : t("active")}</Cellule>
                  <Cellule>
                    <MenuReferent
                      referent={{ id: r.id, name: r.name, email: r.email }}
                      actionModifier={actionModifierReferent.bind(null, locale, id, r.id)}
                      actionEtat={actionEtatReferent.bind(null, locale, id, r.id, !!r.disabledAt)}
                      actionSupprimer={actionSupprimerReferent.bind(null, locale, id, r.id)}
                      libelles={{
                        menu: t("actionsFor", { name: r.name }),
                        edit: t("edit"),
                        editTitle: t("editReferentTitle"),
                        editHelp: t("editReferentHelp"),
                        name: t("referentName"),
                        email: t("referentEmail"),
                        save: t("save"),
                        saving: t("saving"),
                        toggle: r.disabledAt ? t("enable") : t("disable"),
                        delete: t("delete"),
                        deleteTitle: t("deleteTitle"),
                        deleteText: t("deleteText", { name: r.name, email: r.email }),
                        deleteConfirm: t("deleteConfirm"),
                        cancel: t("cancel"),
                      }}
                    />
                  </Cellule>
                </tr>
              ))}
            </Tableau>
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
