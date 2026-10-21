// Rapport validé, vu par un référent de l'entreprise (étape 8B). Jamais de brouillon ni de question
// interne d'IMA. Le référent signataire peut accepter le rapport ou demander une correction.
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { z } from "zod";
import { AffichageRapport, type TextesRapport } from "@/components/AffichageRapport";
import { MessageInfo, ZoneTexte } from "@/components/Formulaire";
import { FormulaireAction } from "@/components/FormulaireAction";
import { SiteHeader } from "@/components/SiteHeader";
import { WaveFooter } from "@/components/WaveFooter";
import { Link } from "@/i18n/navigation";
import { exigerReferent } from "@/lib/auth/acces";
import { getDb } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { contenuVide, lireContenu } from "@/lib/rapport/contenu";
import { rapportPourReferent } from "@/lib/rapport/entreprise";
import { actionAccepterRapport, actionDefinirDelegation, actionDemanderCorrection } from "../../actions";

export default async function RapportReferentPage({ params }: PageProps<"/[locale]/espace/campagnes/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const referent = await exigerReferent(locale);
  if (!z.string().uuid().safeParse(id).success) notFound();
  const db = getDb();
  const vue = await rapportPourReferent(db, referent.id, id);
  if (!vue) notFound();

  const te = await getTranslations("EspaceRapport");
  const tr = await getTranslations("Rapport");
  const tres = await getTranslations("Resultats");
  const textes: TextesRapport = {
    l: Object.fromEntries(["synthese", "cartographie", "confiance", "priorites", "acteurs", "orientations", "limites"].map((k) => [k, tr(k)])),
    natures: tr.raw("natures") as Record<string, string>,
    confiances: tr.raw("confiances") as Record<string, string>,
    acteursListe: tr.raw("acteursListe") as Record<string, string>,
    niveaux: tres.raw("levels") as Record<string, string>,
  };
  const date = (d: Date) => new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(d);
  const nomDe = async (uid: string | null) =>
    uid ? ((await db.select({ name: users.name }).from(users).where(eq(users.id, uid)))[0]?.name ?? "—") : "—";
  const rapport = vue.rapport;

  return (
    <>
      <SiteHeader />
      <main id="contenu" className="mx-auto w-full max-w-4xl flex-1 px-4 py-12">
        <p className="text-sm font-semibold uppercase tracking-widest text-ima-gold-text">{tr("title")}</p>
        <h1 className="mt-2 text-2xl sm:text-3xl">{vue.campagne.mandateReference}</h1>
        <div aria-hidden="true" className="mt-4 h-0.5 w-16 bg-ima-gold" />
        <p className="mb-6 mt-4">
          <Link href="/espace" className="font-semibold text-ima-navy underline">
            {te("back")}
          </Link>
        </p>

        {/* Délégation au conseiller en prévention : réservée au signataire (décision du 21/10/2026) */}
        {vue.estSignataire && (
          <section className="mb-8 max-w-2xl rounded-md border border-ima-line bg-white p-4">
            <h2 className="text-lg">{te("delegationTitle")}</h2>
            <p className="mb-3 mt-1 text-sm text-ima-muted">{te("delegationHelp")}</p>
            <FormulaireAction
              action={actionDefinirDelegation.bind(null, locale, id)}
              libelle={te("delegationSave")}
              enCours={te("sending")}
              secondaire
              className="flex flex-col gap-3"
            >
              <label className="flex items-start gap-2">
                <input type="checkbox" name="delegation" value="oui" defaultChecked={vue.campagne.advisorDelegation} className="mt-1 h-5 w-5 accent-ima-navy" />
                <span>{te("delegationLabel")}</span>
              </label>
            </FormulaireAction>
          </section>
        )}
        {vue.parDelegation && <p className="mb-6 text-sm text-ima-muted">{te("byDelegation")}</p>}

        {!rapport ? (
          <MessageInfo>{vue.etat === "enCorrection" ? te("inCorrection") : te("notAvailable")}</MessageInfo>
        ) : (
          <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-2">
              <p className="font-semibold text-ima-navy">
                {rapport.aiModel ? tr("mentionAi", { nom: await nomDe(rapport.validatedBy) }) : tr("mentionManual", { nom: await nomDe(rapport.validatedBy) })}
              </p>
              {rapport.acceptedAt && <MessageInfo>{te("acceptedBy", { nom: await nomDe(rapport.acceptedBy), date: date(rapport.acceptedAt) })}</MessageInfo>}
              <a href={`/api/rapport/${id}/pdf`} className="w-fit rounded-md border border-ima-navy px-4 py-2 font-semibold text-ima-navy hover:bg-ima-cream">
                {te("download")}
              </a>
            </div>

            <AffichageRapport contenu={lireContenu(rapport.finalText) ?? contenuVide()} textes={textes} />

            {!rapport.acceptedAt &&
              (vue.peutSigner ? (
                <div className="flex flex-col gap-8 border-t border-ima-line pt-8">
                  <section className="max-w-2xl">
                    <h2 className="text-xl">{te("acceptTitle")}</h2>
                    <p className="mb-4 mt-2 text-sm text-ima-muted">{te("acceptHelp")}</p>
                    <FormulaireAction action={actionAccepterRapport.bind(null, locale, id, rapport.id)} libelle={te("accept")} enCours={te("accepting")}>
                      <label className="flex items-start gap-2">
                        <input type="checkbox" name="perimetre" value="oui" required className="mt-1 h-5 w-5 accent-ima-navy" />
                        <span>{te("checkPerimetre")}</span>
                      </label>
                      <label className="flex items-start gap-2">
                        <input type="checkbox" name="effectifs" value="oui" required className="mt-1 h-5 w-5 accent-ima-navy" />
                        <span>{te("checkEffectifs")}</span>
                      </label>
                    </FormulaireAction>
                  </section>
                  <section className="max-w-2xl">
                    <h2 className="text-xl">{te("correctionTitle")}</h2>
                    <p className="mb-4 mt-2 text-sm text-ima-muted">{te("correctionHelp")}</p>
                    <FormulaireAction action={actionDemanderCorrection.bind(null, locale, id, rapport.id)} libelle={te("correction")} enCours={te("sending")} secondaire>
                      <ZoneTexte id="commentaire" name="commentaire" label={te("correctionLabel")} required minLength={10} maxLength={2000} />
                    </FormulaireAction>
                  </section>
                </div>
              ) : (
                <p className="text-sm text-ima-muted">{te("signatoryOnly")}</p>
              ))}
          </div>
        )}
      </main>
      <WaveFooter />
    </>
  );
}
