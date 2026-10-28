// Liste des ateliers d'une entreprise et création d'un atelier (module C), commune à l'espace IMA
// et à l'espace du conseiller en prévention.
import { getTranslations } from "next-intl/server";
import { actionCreerAtelier } from "@/app/[locale]/ateliers/actions";
import { FormulaireAction } from "@/components/FormulaireAction";
import { Link } from "@/i18n/navigation";
import { FUSEAUX, lireAteliers, phase } from "@/lib/ateliers/ateliers";
import type { Db } from "@/lib/db/types";
import { getDb } from "@/lib/db/client";
import { organizations, type users } from "@/lib/db/schema";
import { lireCalendrier } from "@/lib/sensibilisation/calendrier";
import { actionsPourLien } from "@/lib/sensibilisation/declencheurs";
import { eq } from "drizzle-orm";
import { ChampsAtelier } from "./ChampsAtelier";

type Utilisateur = typeof users.$inferSelect;

export const COULEURS_PHASE: Record<string, string> = {
  inscription: "border-ima-navy text-ima-navy",
  avis: "border-repere-vigilance text-repere-vigilance",
  termine: "border-repere-favorable text-repere-favorable",
  annule: "border-ima-line text-ima-muted",
};

// Campagnes de sensibilisation (année en cours et suivante) et actions du plan validé, pour les liens
export async function optionsLiens(db: Db, u: Utilisateur, organizationId: string, locale: string) {
  const annee = new Date().getUTCFullYear();
  const nomMois = (a: number, m: number) => new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(a, m - 1, 1)));
  const campagnes = [...((await lireCalendrier(db, u, organizationId, annee)) ?? []), ...((await lireCalendrier(db, u, organizationId, annee + 1)) ?? [])]
    .filter((c) => c.status !== "retiree")
    .map((c) => ({
      valeur: c.id,
      libelle: `${c.theme.kitsLus[locale as "fr"]?.titre || c.theme.kitsLus.fr?.titre || c.theme.code} (${nomMois(c.year, c.month)})`,
    }));
  const lien = await actionsPourLien(db, u, organizationId);
  return { campagnes, actions: (lien?.actions ?? []).map((a) => ({ valeur: a.id, libelle: a.titre })) };
}

export async function ListeAteliers({
  utilisateur,
  organizationId,
  locale,
  base, // adresse de la liste (sans la langue)
}: {
  utilisateur: Utilisateur;
  organizationId: string;
  locale: string;
  base: string;
}) {
  const t = await getTranslations("Ateliers");
  const db = getDb();
  const liste = await lireAteliers(db, utilisateur, organizationId);
  if (!liste) return null;
  const [org] = await db.select({ country: organizations.country }).from(organizations).where(eq(organizations.id, organizationId));
  const fuseau = FUSEAUX[org?.country ?? "BE"];
  const quand = (d: Date) => new Intl.DateTimeFormat(locale, { dateStyle: "full", timeStyle: "short", timeZone: fuseau }).format(d);
  const { campagnes, actions } = await optionsLiens(db, utilisateur, organizationId, locale);

  return (
    <div className="flex flex-col gap-10">
      <section aria-labelledby="liste-ateliers" className="flex flex-col gap-3">
        <h2 id="liste-ateliers" className="text-xl">{t("listTitle")}</h2>
        {liste.length === 0 ? (
          <p>{t("empty")}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {liste.map((a) => {
              const etat = phase(a);
              return (
                <li key={a.id} className={`rounded-md border border-ima-line bg-white p-4 ${etat === "annule" ? "opacity-60" : ""}`}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p>
                      <Link href={`${base}/${a.id}`} className="font-semibold text-ima-navy underline">
                        {a.title}
                      </Link>
                      <span className="block text-sm text-ima-muted">{t(`types.${a.type}`)}</span>
                    </p>
                    <span className={`rounded-sm border px-2 py-0.5 text-sm font-semibold ${COULEURS_PHASE[etat]}`}>{t(`phases.${etat}`)}</span>
                  </div>
                  <p className="mt-1 text-sm">{quand(a.startsAt)}</p>
                  <p className="mt-1 text-sm text-ima-muted">{t("counts", { inscrits: a.inscrits, attente: a.attente, avis: a.avis })}</p>
                  {a.supportStatus && <p className="mt-1 text-sm font-semibold text-ima-gold-text">{t(`supportStatus.${a.supportStatus}`)}</p>}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="nouvel-atelier" className="max-w-2xl">
        <h2 id="nouvel-atelier" className="mb-3 text-xl">{t("createTitle")}</h2>
        <FormulaireAction action={actionCreerAtelier.bind(null, locale, organizationId)} libelle={t("create")} enCours={t("working")} viderApresSucces>
          <ChampsAtelier prefixe="nouveau" campagnes={campagnes} actions={actions} aujourdhui={new Date().toISOString().slice(0, 10)} />
        </FormulaireAction>
      </section>
    </div>
  );
}
