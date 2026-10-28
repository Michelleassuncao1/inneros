// Page publique d'un atelier (lien et QR code, module C) : avant l'atelier, inscription (nom, e-mail
// professionnel, liste d'attente) ; à partir du début et pendant 7 jours, avis anonyme. Jamais de liste
// d'inscrits ni d'avis ici.
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { actionAvis, actionInscrire } from "@/app/[locale]/atelier/actions";
import { Champ, MessageInfo, ZoneTexte } from "@/components/Formulaire";
import { SiteHeader } from "@/components/SiteHeader";
import { WaveFooter } from "@/components/WaveFooter";
import { FormulaireUnique } from "@/components/ateliers/FormulaireUnique";
import { Link } from "@/i18n/navigation";
import { atelierPublic, cookieAvis, dureesAteliers, QUESTIONS_AVIS } from "@/lib/ateliers/ateliers";
import { getDb } from "@/lib/db/client";

export const metadata: Metadata = {
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

export default async function AtelierPublicPage({ params }: PageProps<"/[locale]/atelier/[code]">) {
  const { locale, code } = await params;
  setRequestLocale(locale);
  const a = await atelierPublic(getDb(), code);
  if (!a) notFound();
  const t = await getTranslations("AtelierPublic");
  const ta = await getTranslations("Ateliers");
  const quand = new Intl.DateTimeFormat(locale, { dateStyle: "full", timeStyle: "short", timeZone: a.fuseau }).format(a.debut);
  const avisDonne = !!(await cookies()).get(cookieAvis(a.id));

  return (
    <>
      <SiteHeader />
      <main id="contenu" className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
        <p className="text-sm font-semibold uppercase tracking-widest text-ima-gold-text">{ta(`types.${a.type}`)}</p>
        <h1 className="mt-2 text-2xl sm:text-3xl">{a.titre}</h1>
        <div aria-hidden="true" className="mt-4 h-0.5 w-16 bg-ima-gold" />
        <div className="mt-6 flex flex-col gap-1">
          <p className="font-semibold text-ima-navy">{t("proposePar", { entreprise: a.entreprise })}</p>
          <p>{t("quand", { quand })}</p>
          <p>{t("duree", { n: a.duree })}</p>
          <p className="break-words">{t("lieu", { lieu: a.lieu })}</p>
          {a.animateur && <p>{t("animateur", { animateur: a.animateur })}</p>}
          {a.description && <p className="mt-3 whitespace-pre-line">{a.description}</p>}
        </div>

        {a.phase === "annule" && (
          <div className="mt-8">
            <MessageInfo>{t("cancelled")}</MessageInfo>
          </div>
        )}
        {a.phase === "termine" && (
          <div className="mt-8">
            <MessageInfo>{t("finished")}</MessageInfo>
          </div>
        )}

        {a.phase === "inscription" && (
          <section aria-labelledby="inscription" className="mt-10 flex flex-col gap-4">
            <h2 id="inscription" className="text-xl">{t("registerTitle")}</h2>
            {a.complet ? (
              <MessageInfo>{t("full")}</MessageInfo>
            ) : (
              <>
                <p className="font-semibold text-ima-gold-text">{t("places", { n: a.placesRestantes })}</p>
                <FormulaireUnique action={actionInscrire.bind(null, locale, code)} libelle={t("register")} enCours={t("registering")}>
                  <Champ id="nom" name="nom" label={t("name")} autoComplete="name" required minLength={2} maxLength={120} />
                  <Champ id="email" name="email" type="email" label={t("email")} aide={t("emailHelp")} autoComplete="email" required maxLength={254} />
                  {/* Champ piège pour les robots, invisible et ignoré par les lecteurs d'écran */}
                  <div aria-hidden="true" className="absolute -left-[9999px]">
                    <input type="text" name="site" tabIndex={-1} autoComplete="off" />
                  </div>
                </FormulaireUnique>
              </>
            )}
            <div className="mt-4 rounded-md border-l-[3px] border-ima-gold bg-ima-cream px-5 py-4 text-sm">
              <h3 className="font-semibold text-ima-navy">{t("privacyTitle")}</h3>
              <p className="mt-1">{t("privacy", { entreprise: a.entreprise, jours: dureesAteliers().inscriptionsJours })}</p>
              <p className="mt-2">
                <Link href="/confidentialite" className="font-semibold text-ima-navy underline">
                  {t("privacyLink")}
                </Link>
              </p>
            </div>
          </section>
        )}

        {a.phase === "avis" && (
          <section aria-labelledby="avis" className="mt-10 flex flex-col gap-4">
            <h2 id="avis" className="text-xl">{t("feedbackTitle")}</h2>
            {avisDonne ? (
              <MessageInfo>{t("alreadyGiven")}</MessageInfo>
            ) : (
              <>
                <p className="text-sm text-ima-muted">{t("feedbackIntro")}</p>
                <FormulaireUnique action={actionAvis.bind(null, locale, code, a.id)} libelle={t("send")} enCours={t("sending")}>
                  {QUESTIONS_AVIS.map((q) => (
                    <fieldset key={q} className="rounded-md border border-ima-line bg-white p-4">
                      <legend className="px-1 font-semibold text-ima-navy">{ta(`questions.${q}`)}</legend>
                      <div className="mt-2 flex flex-col gap-2">
                        {[1, 2, 3, 4, 5].map((v) => (
                          <label key={v} className="flex items-center gap-2">
                            <input type="radio" name={q} value={v} required className="h-5 w-5 accent-ima-navy" />
                            <span>
                              {v} · {t(`scale.${v}`)}
                            </span>
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  ))}
                  <ZoneTexte id="commentaire" name="commentaire" label={t("comment")} aide={t("commentHelp")} maxLength={1000} rows={4} />
                </FormulaireUnique>
              </>
            )}
          </section>
        )}
      </main>
      <WaveFooter />
    </>
  );
}
