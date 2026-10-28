// Fiche d'un atelier (module C), commune à l'espace IMA et à l'espace du conseiller en prévention :
// lien et QR code, inscriptions et présences, avis des participants (à partir de 5), modification, annulation.
import { eq } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { actionAnnulerAtelier, actionModifierAtelier, actionPresences, actionRetirerInscription } from "@/app/[locale]/ateliers/actions";
import { MessageInfo } from "@/components/Formulaire";
import { FormulaireAction } from "@/components/FormulaireAction";
import { BoutonCopier } from "@/components/sensibilisation/BoutonCopier";
import { dateHeureLocales, dureesAteliers, JOURS_AVIS, lienPublic, lireAtelier, phase, SEUIL_AVIS } from "@/lib/ateliers/ateliers";
import { getDb } from "@/lib/db/client";
import { organizations, type users } from "@/lib/db/schema";
import { ChampsAtelier } from "./ChampsAtelier";
import { COULEURS_PHASE, optionsLiens } from "./ListeAteliers";

const bouton = "inline-block rounded-md border border-ima-navy px-4 py-2 font-semibold text-ima-navy hover:bg-ima-cream";

export async function DetailAtelier({ utilisateur, atelierId, locale }: { utilisateur: typeof users.$inferSelect; atelierId: string; locale: string }) {
  const t = await getTranslations("Ateliers");
  const db = getDb();
  const d = await lireAtelier(db, utilisateur, atelierId);
  if (!d) return null;
  const { atelier: a, fuseau, inscriptions, resultats } = d;
  const etat = phase(a);
  const [o] = await db.select({ locale: organizations.locale }).from(organizations).where(eq(organizations.id, a.organizationId));
  const lien = lienPublic(a.publicCode, o?.locale ?? locale);
  const quand = (x: Date) => new Intl.DateTimeFormat(locale, { dateStyle: "full", timeStyle: "short", timeZone: fuseau }).format(x);
  const jour = (x: Date) => new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: fuseau }).format(x);
  const inscrits = inscriptions.filter((r) => r.status === "inscrit");
  const attente = inscriptions.filter((r) => r.status === "attente");
  const { campagnes, actions } = etat === "inscription" ? await optionsLiens(db, utilisateur, a.organizationId, locale) : { campagnes: [], actions: [] };
  const local = dateHeureLocales(a.startsAt, fuseau);
  const orgId = a.organizationId;

  return (
    <div className="flex flex-col gap-10">
      {/* En-tête */}
      <section className="flex flex-col gap-1">
        <p className="text-sm text-ima-muted">{t(`types.${a.type}`)}</p>
        <p>
          <span className={`rounded-sm border px-2 py-0.5 text-sm font-semibold ${COULEURS_PHASE[etat]}`}>{t(`phases.${etat}`)}</span>
        </p>
        <p className="mt-2 font-semibold text-ima-navy">{quand(a.startsAt)}</p>
        <p>{a.place}</p>
        {a.facilitator && <p className="text-sm">{a.facilitator}</p>}
        {a.description && <p className="mt-2 max-w-[70ch] whitespace-pre-line">{a.description}</p>}
        {a.supportStatus && (
          <div className="mt-3 max-w-3xl rounded-md border-l-[3px] border-ima-gold bg-ima-cream px-5 py-3">
            <p className="font-semibold text-ima-navy">{t(`supportStatus.${a.supportStatus}`)}</p>
            {a.supportRequest && <p className="mt-1 text-sm">{t("request", { texte: a.supportRequest })}</p>}
            {d.animateurIma && <p className="mt-1 text-sm">{t("imaFacilitator", { nom: d.animateurIma })}</p>}
            {a.supportReply && <p className="mt-1 text-sm">{t("imaReply", { texte: a.supportReply })}</p>}
          </div>
        )}
      </section>

      {/* Lien et QR code */}
      {etat !== "annule" && (
        <section aria-labelledby="qr" className="flex max-w-3xl flex-col gap-3">
          <h2 id="qr" className="text-xl">{t("qrTitle")}</h2>
          <p className="text-sm text-ima-muted">{t("qrHelp", { jours: JOURS_AVIS })}</p>
          <div className="flex flex-wrap items-start gap-6">
            {/* eslint-disable-next-line @next/next/no-img-element -- image produite par l'API, protégée par la session */}
            <img src={`/api/ateliers/${a.id}/qr`} alt={t("qrAlt")} width={160} height={160} className="rounded-sm border border-ima-line bg-white p-2" />
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              <p className="break-all font-mono text-sm">{lien}</p>
              <p className="flex flex-wrap gap-3">
                <BoutonCopier texte={lien} libelle={t("copyLink")} copie={t("copied")} />
              </p>
              <p className="flex flex-wrap gap-3">
                <a href={`/api/ateliers/${a.id}/affiche?lang=${locale}`} className={bouton}>{t("downloadPoster")}</a>
                <a href={`/api/ateliers/${a.id}/qr`} className={bouton}>{t("downloadQr")}</a>
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Inscriptions */}
      <section aria-labelledby="inscriptions" className="flex max-w-3xl flex-col gap-3">
        <h2 id="inscriptions" className="text-xl">
          {t("registrationsTitle", {
            inscrits: a.registrationsPurgedAt ? (a.registeredCount ?? 0) : inscrits.length,
            places: a.capacity,
            attente: a.registrationsPurgedAt ? (a.waitlistCount ?? 0) : attente.length,
          })}
        </h2>
        {a.registrationsPurgedAt ? (
          <MessageInfo>{t("purged", { date: jour(a.registrationsPurgedAt), inscrits: a.registeredCount ?? 0, presents: a.attendedCount ?? 0 })}</MessageInfo>
        ) : (
          <>
            <p className="text-sm text-ima-muted">{t("registrationsHelp", { jours: dureesAteliers().inscriptionsJours })}</p>
            {inscriptions.length === 0 ? (
              <p>{t("noRegistration")}</p>
            ) : (
              <>
                {inscrits.length > 0 && (
                  <FormulaireAction action={actionPresences.bind(null, locale, orgId, a.id)} libelle={t("savePresence")} enCours={t("working")} secondaire className="flex flex-col gap-3">
                    <ul className="flex flex-col gap-2">
                      {inscrits.map((r) => (
                        <li key={r.id}>
                          <label className="flex flex-wrap items-center gap-2">
                            <input type="checkbox" name="present" value={r.id} defaultChecked={r.attended} className="h-5 w-5 accent-ima-navy" />
                            <span className="font-semibold">{r.name}</span>
                            <span className="break-all text-sm text-ima-muted">{r.email}</span>
                            <span className="sr-only">{t("present")}</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </FormulaireAction>
                )}
                {attente.length > 0 && (
                  <div>
                    <h3 className="text-lg">{t("statutsInscription.attente")}</h3>
                    <ol className="mt-2 list-decimal pl-5">
                      {attente.map((r) => (
                        <li key={r.id}>
                          <span className="font-semibold">{r.name}</span> <span className="break-all text-sm text-ima-muted">{r.email}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
                <p>
                  <a href={`/api/ateliers/${a.id}/inscrits?lang=${locale}`} className={bouton}>{t("exportCsv")}</a>
                </p>
                <details>
                  <summary className="cursor-pointer text-sm font-semibold text-ima-navy">{t("remove")}</summary>
                  <ul className="mt-3 flex flex-col gap-2">
                    {inscriptions.map((r) => (
                      <li key={r.id} className="flex flex-wrap items-center gap-3">
                        <span>
                          {r.name} · {t(`statutsInscription.${r.status}`)}
                        </span>
                        <FormulaireAction action={actionRetirerInscription.bind(null, locale, orgId, a.id, r.id)} libelle={t("remove")} enCours={t("working")} secondaire className="flex items-center gap-2" />
                      </li>
                    ))}
                  </ul>
                </details>
              </>
            )}
          </>
        )}
      </section>

      {/* Avis des participants */}
      <section aria-labelledby="avis" className="flex max-w-3xl flex-col gap-4">
        <h2 id="avis" className="text-xl">{t("resultsTitle")}</h2>
        {!resultats.visible ? (
          <p>{t("resultsHidden", { n: resultats.nombre, seuil: SEUIL_AVIS })}</p>
        ) : (
          <>
            <p className="text-sm text-ima-muted">{t("resultsMeta", { n: resultats.nombre })}</p>
            <ul className="flex flex-col gap-4">
              {resultats.questions.map((q) => (
                <li key={q.question}>
                  <p className="font-semibold text-ima-navy">{t(`questions.${q.question}`)}</p>
                  <div className="mt-1 flex items-center gap-3">
                    <div className="h-3 w-48 rounded-sm bg-ima-cream" aria-hidden="true">
                      <div className="h-3 rounded-sm bg-ima-navy" style={{ width: `${((q.moyenne ?? 0) / 5) * 100}%` }} />
                    </div>
                    <span>{t("average", { m: q.moyenne === null ? "—" : new Intl.NumberFormat(locale).format(q.moyenne) })}</span>
                  </div>
                  <p className="text-sm text-ima-muted">{t("distribution", { r: q.repartition.join(" · ") })}</p>
                </li>
              ))}
            </ul>
            <div>
              <h3 className="text-lg">{t("commentsTitle", { n: resultats.commentaires.length })}</h3>
              {resultats.commentaires.length === 0 ? (
                <p>{t("noComment")}</p>
              ) : (
                <>
                  <ul className="mt-2 flex flex-col gap-2">
                    {resultats.commentaires.map((c, i) => (
                      <li key={i} className="rounded-md border-l-[3px] border-ima-gold bg-white px-4 py-2 whitespace-pre-line">
                        {c}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-sm text-ima-muted">{t("commentsNote")}</p>
                </>
              )}
            </div>
          </>
        )}
      </section>

      {/* Modification et annulation, tant que l'atelier n'a pas commencé */}
      {etat === "inscription" ? (
        <>
          <section className="max-w-2xl">
            <details>
              <summary className="cursor-pointer text-xl font-semibold text-ima-navy">{t("editTitle")}</summary>
              <p className="mt-3 text-sm text-ima-muted">{t("changeNotice")}</p>
              <div className="mt-4">
                <FormulaireAction action={actionModifierAtelier.bind(null, locale, orgId, a.id)} libelle={t("save")} enCours={t("working")}>
                  <ChampsAtelier
                    prefixe="modif"
                    campagnes={campagnes}
                    actions={actions}
                    aujourdhui={new Date().toISOString().slice(0, 10)}
                    appuiVerrouille={a.supportStatus === "accepte" || a.supportStatus === "refuse"}
                    valeurs={{
                      type: a.type,
                      titre: a.title,
                      description: a.description ?? "",
                      date: local.date,
                      heure: local.heure,
                      duree: a.durationMinutes,
                      lieu: a.place,
                      places: a.capacity,
                      animateur: a.facilitator ?? "",
                      campagne: a.awarenessCampaignId ?? "",
                      action: a.planActionId ?? "",
                      appui: !!a.supportStatus,
                      demandeAppui: a.supportRequest ?? "",
                    }}
                  />
                </FormulaireAction>
              </div>
            </details>
          </section>
          <section className="max-w-2xl rounded-md border-l-[3px] border-repere-prioritaire bg-white px-5 py-4">
            <h2 className="text-lg">{t("cancelTitle")}</h2>
            <p className="mb-3 mt-1 text-sm">{t("cancelHelp")}</p>
            <FormulaireAction action={actionAnnulerAtelier.bind(null, locale, orgId, a.id)} libelle={t("cancel")} enCours={t("working")} secondaire />
          </section>
        </>
      ) : (
        etat !== "annule" && <p className="text-sm text-ima-muted">{t("notEditable")}</p>
      )}
    </div>
  );
}
