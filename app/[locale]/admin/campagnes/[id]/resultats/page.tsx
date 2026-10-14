// Tableau de bord IMA (F9) : scores par échelle et par groupe, effectifs affichés, rien sous le seuil.
// Sans valeurs de référence nationales, aucun repère de couleur n'est affiché (cahier, section 4).
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { z } from "zod";
import { Cellule, EspaceAdmin, Tableau, TitrePage } from "@/components/EspaceAdmin";
import { MessageInfo } from "@/components/Formulaire";
import { Link } from "@/i18n/navigation";
import { journaliser } from "@/lib/audit";
import { exigerAdmin } from "@/lib/auth/acces";
import { getDb } from "@/lib/db/client";
import { campaigns, organizations } from "@/lib/db/schema";
import { lireResultats } from "@/lib/resultats/agregats";

const ORDRE_NIVEAUX = ["travail", "roles", "interactions", "management", "organisation", "environnement", "sante", "aucun"] as const;

export default async function ResultatsPage({ params }: PageProps<"/[locale]/admin/campagnes/[id]/resultats">) {
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

  const t = await getTranslations("Resultats");
  const resultats = campagne.status === "closed" ? await lireResultats(db, id, locale) : null;
  if (resultats) await journaliser(db, { actorUserId: admin.id, action: "results_viewed", targetType: "campaign", targetId: id });
  const nombre = (v: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(v);

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
      ) : (
        <>
          <div className="mb-8 flex max-w-3xl flex-col gap-2">
            {campagne.rawDeletedAt && (
              <MessageInfo>
                {t("rawDeleted", { date: new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(campagne.rawDeletedAt) })}
              </MessageInfo>
            )}
            <MessageInfo>{t("noReference")}</MessageInfo>
            <p className="text-sm text-ima-muted">
              {t("computedOn", {
                date: new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(resultats.calculeLe),
                version: resultats.version,
              })}
            </p>
            <p className="text-sm text-ima-muted">
              {t("maskedGroups", { count: resultats.groupesMasques, seuil: campagne.groupMinSize })}
            </p>
            <p className="text-sm text-ima-muted">{t("howToRead")}</p>
          </div>

          {resultats.questionnaires.map((q) => (
            <section key={q.titre} className="mb-12">
              <h2 className="mb-4 text-xl">{q.titre}</h2>
              {ORDRE_NIVEAUX.map((niveau) => {
                const dims = q.dimensions.filter((d) => (d.niveau ?? "aucun") === niveau && d.resultats.length);
                if (!dims.length) return null;
                return (
                  <div key={niveau} className="mb-6">
                    <h3 className="mb-2 text-lg">{t(`levels.${niveau}`)}</h3>
                    <Tableau entetes={[t("scale"), t("all"), ...resultats.groupes.map((g) => g.libelle)]}>
                      {dims.map((d) => {
                        const cellule = (groupId: string | null) => {
                          const r = d.resultats.find((x) => x.groupId === groupId);
                          return r ? (
                            <>
                              <span className="font-semibold">{nombre(r.moyenne)}</span>{" "}
                              <span className="text-sm text-ima-muted">({r.n})</span>
                            </>
                          ) : (
                            <span className="text-ima-muted">{t("none")}</span>
                          );
                        };
                        return (
                          <tr key={d.id}>
                            <Cellule>{d.nom}</Cellule>
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
            </section>
          ))}
        </>
      )}
    </EspaceAdmin>
  );
}
