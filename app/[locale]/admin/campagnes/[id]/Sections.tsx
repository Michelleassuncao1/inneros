// Sections « Ouverture », « Jetons » et « Kit d'information » de la fiche campagne.
import { getTranslations } from "next-intl/server";
import { Champ, MessageInfo, Selection } from "@/components/Formulaire";
import { FormulaireAction } from "@/components/FormulaireAction";
import { CONTACTS_MAXIMUM, lireSoutien, ROLES_CONTACT } from "@/lib/admin/soutien";
import { compterJetons } from "@/lib/admin/jetons";
import { getDb } from "@/lib/db/client";
import {
  actionAjouterLangue,
  actionCloturerCampagne,
  actionGenererJetons,
  actionOuvrirCampagne,
  actionProlongerCampagne,
  actionRevoquerJetons,
  actionSoutien,
} from "../../actions";
import { BoutonConfirmation } from "./BoutonConfirmation";
import { GenerationJetons } from "./GenerationJetons";

type Campagne = {
  id: string;
  status: "draft" | "open" | "closed";
  mandateReference: string;
  mandateValidatedOn: string | null;
  endDate: string;
  closedAt: Date | null;
  locales: string[];
  supportContacts: unknown;
  imaSupport: unknown;
};

const dateLisible = (locale: string, d: string | Date) =>
  new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(
    typeof d === "string" ? new Date(`${d}T00:00:00Z`) : d,
  );

export async function SectionCycle({
  locale,
  campagne,
  languesAjoutables,
}: {
  locale: string;
  campagne: Campagne;
  languesAjoutables: string[];
}) {
  const t = await getTranslations("Cycle");
  const l = await getTranslations("Libelles");
  return (
    <section aria-labelledby="ouverture" className="mb-12">
      <h2 id="ouverture" className="text-xl">{t("title")}</h2>
      {campagne.status === "draft" && (
        <>
          <p className="mb-2 mt-2 max-w-[70ch]">{t("draftInfo")}</p>
          <p className="mb-4 max-w-[70ch] text-sm text-ima-muted">{t("checklist")}</p>
          <FormulaireAction
            action={actionOuvrirCampagne.bind(null, locale, campagne.id)}
            libelle={t("open")}
            enCours={t("opening")}
          >
            <Champ id="mandateValidatedOn" name="mandateValidatedOn" type="date" label={t("mandateDate")} required />
            <label className="flex items-start gap-2">
              <input type="checkbox" name="confirmation" value="oui" required className="mt-1 h-5 w-5 accent-ima-navy" />
              <span>{t("confirm")}</span>
            </label>
          </FormulaireAction>
        </>
      )}
      {campagne.status === "open" && (
        <div className="mt-3 flex max-w-xl flex-col items-start gap-4">
          <MessageInfo>{t("openInfo", { date: dateLisible(locale, campagne.mandateValidatedOn!) })}</MessageInfo>
          <p className="font-semibold text-ima-navy">{t("endsOn", { date: dateLisible(locale, campagne.endDate) })}</p>
          <details className="w-full rounded-md border border-ima-line bg-white px-4 py-3">
            <summary className="cursor-pointer font-semibold text-ima-navy">{t("extend")}</summary>
            <p className="mb-4 mt-2 text-sm text-ima-muted">{t("extendHelp")}</p>
            <FormulaireAction
              action={actionProlongerCampagne.bind(null, locale, campagne.id)}
              libelle={t("extendConfirm")}
              enCours={t("extending")}
              secondaire
            >
              <Champ id="endDate" name="endDate" type="date" min={campagne.endDate} label={t("newEndDate")} required />
            </FormulaireAction>
          </details>
          {languesAjoutables.length > 0 && (
            <details className="w-full rounded-md border border-ima-line bg-white px-4 py-3">
              <summary className="cursor-pointer font-semibold text-ima-navy">{t("addLanguage")}</summary>
              <p className="mb-4 mt-2 text-sm text-ima-muted">{t("addLanguageHelp")}</p>
              <FormulaireAction
                action={actionAjouterLangue.bind(null, locale, campagne.id)}
                libelle={t("addLanguageButton")}
                enCours={t("adding")}
                secondaire
              >
                <Selection
                  id="langue"
                  name="langue"
                  label={t("addLanguage")}
                  options={languesAjoutables.map((lg) => ({ valeur: lg, libelle: l(`locale.${lg}`) }))}
                />
              </FormulaireAction>
            </details>
          )}
          <BoutonConfirmation
            libelle={t("close")}
            titre={t("closeTitle")}
            texte={t("closeText")}
            confirmer={t("closeConfirm")}
            annuler={t("cancel")}
            action={actionCloturerCampagne.bind(null, locale, campagne.id)}
          />
        </div>
      )}
      {campagne.status === "closed" && campagne.closedAt && (
        <div className="mt-3 max-w-xl">
          <MessageInfo>{t("closedInfo", { date: dateLisible(locale, campagne.closedAt) })}</MessageInfo>
        </div>
      )}
    </section>
  );
}

export async function SectionJetons({
  locale,
  campagne,
  effectifTotal,
}: {
  locale: string;
  campagne: Campagne;
  effectifTotal: number;
}) {
  const t = await getTranslations("Jetons");
  const l = await getTranslations("Libelles");
  const nombres = await compterJetons(getDb(), campagne.id);

  return (
    <section aria-labelledby="jetons" className="mb-12">
      <h2 id="jetons" className="text-xl">{t("title")}</h2>
      {campagne.status === "closed" ? (
        <p className="mt-2">{t("closedInfo")}</p>
      ) : (
        <>
          <p className="mb-2 mt-2 max-w-[70ch] text-sm text-ima-muted">{t("help")}</p>
          <p className="mb-4 font-semibold text-ima-navy">{t("counts", nombres)}</p>
          <GenerationJetons
            action={actionGenererJetons.bind(null, locale, campagne.id)}
            campagneId={campagne.id}
            reference={campagne.mandateReference}
            langues={campagne.locales}
            urlQuestionnaire={process.env.APP_URL ?? "http://localhost:3000"}
            nombreSuggere={Math.max(1, Math.ceil(effectifTotal * 1.1))}
            textes={{
              number: t("number"),
              numberHelp: t("numberHelp"),
              generate: t("generate"),
              generating: t("generating"),
              readyTitle: t.raw("readyTitle") as string,
              readyText: t("readyText"),
              downloadCsv: t("downloadCsv"),
              downloadPdf: Object.fromEntries(
                campagne.locales.map((lg) => [lg, t("downloadPdf", { langue: l(`locale.${lg}`) })]),
              ),
              downloading: t("downloading"),
              downloaded: t("downloaded"),
              done: t("done"),
              leaveWarning: t("leaveWarning"),
              pdfError: t("pdfError"),
              csvHeader: t("csvHeader"),
            }}
          />
          {nombres.actifs > 0 && (
            <div className="mt-6">
              <BoutonConfirmation
                libelle={t("revoke")}
                titre={t("revokeTitle")}
                texte={t("revokeText", { count: nombres.actifs })}
                confirmer={t("revokeConfirm")}
                annuler={t("cancel")}
                action={actionRevoquerJetons.bind(null, locale, campagne.id)}
              />
            </div>
          )}
        </>
      )}
    </section>
  );
}

export async function SectionKit({ campagne }: { campagne: Campagne }) {
  const t = await getTranslations("KitAdmin");
  const l = await getTranslations("Libelles");
  return (
    <section aria-labelledby="kit" className="mb-12">
      <h2 id="kit" className="text-xl">{t("title")}</h2>
      <p className="mb-2 mt-2 max-w-[70ch] text-sm text-ima-muted">{t("help")}</p>
      <p className="mb-4 max-w-[70ch] text-sm font-semibold text-ima-gold-text">{t("draft")}</p>
      <ul className="flex flex-wrap gap-3">
        {campagne.locales.map((lg) => (
          <li key={lg}>
            <a
              href={`/api/admin/campagnes/${campagne.id}/kit?langue=${lg}`}
              className="inline-block rounded-md border border-ima-navy px-4 py-2 font-semibold text-ima-navy hover:bg-ima-cream"
            >
              {t("download", { langue: l(`locale.${lg}`) })}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

// Soutien affiché aux répondants : A. contacts internes, B. contact IMA (fixe), C. accompagnement IMA
export async function SectionSoutien({ locale, campagne }: { locale: string; campagne: Campagne }) {
  const t = await getTranslations("Soutien");
  const { contacts, ima } = lireSoutien(campagne);
  if (campagne.status === "closed") return null;

  return (
    <section aria-labelledby="soutien" className="mb-12">
      <h2 id="soutien" className="text-xl">{t("title")}</h2>
      <p className="mb-4 mt-2 max-w-[70ch] text-sm text-ima-muted">{t("help")}</p>
      <FormulaireAction
        action={actionSoutien.bind(null, locale, campagne.id)}
        libelle={t("save")}
        enCours={t("saving")}
        secondaire
        className="flex max-w-2xl flex-col gap-5"
      >
        <fieldset className="flex flex-col gap-4">
          <legend className="mb-1 font-semibold text-ima-navy">{t("contactsTitle")}</legend>
          <p className="text-sm text-ima-muted">{t("contactsHelp")}</p>
          {Array.from({ length: CONTACTS_MAXIMUM }, (_, i) => (
            <div key={i} className="grid gap-3 rounded-md border border-ima-line bg-white p-3 sm:grid-cols-3">
              <Selection
                id={`contact-${i}-role`}
                name={`contacts.${i}.role`}
                label={`${t("contactN", { n: i + 1 })} — ${t("role")}`}
                defaultValue={contacts[i]?.role ?? "personneConfiance"}
                options={ROLES_CONTACT.map((r) => ({ valeur: r, libelle: t(`roles.${r}`) }))}
              />
              <Champ
                id={`contact-${i}-libelle`}
                name={`contacts.${i}.libelle`}
                label={t("libelle")}
                defaultValue={contacts[i]?.libelle ?? ""}
                maxLength={80}
              />
              <Champ
                id={`contact-${i}-coord`}
                name={`contacts.${i}.coordonnees`}
                label={t("coordonnees")}
                defaultValue={contacts[i]?.coordonnees ?? ""}
                maxLength={200}
              />
            </div>
          ))}
        </fieldset>

        <p className="text-sm">{t("contactB")}</p>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 font-semibold text-ima-navy">{t("imaTitle")}</legend>
          <p className="text-sm font-semibold text-ima-gold-text">{t("imaWarning")}</p>
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              name="ima.actif"
              value="oui"
              defaultChecked={!!ima}
              className="mt-1 h-5 w-5 accent-ima-navy"
            />
            <span>{t("imaActif")}</span>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <Champ id="ima-telephone" name="ima.telephone" type="tel" label={t("telephone")} defaultValue={ima?.telephone ?? ""} maxLength={40} />
            <Champ id="ima-email" name="ima.email" type="email" label={t("email")} defaultValue={ima?.email ?? ""} maxLength={254} />
            <Champ id="ima-lien" name="ima.lien" type="url" label={t("lien")} defaultValue={ima?.lien ?? ""} maxLength={300} />
            <Champ id="ima-horaires" name="ima.horaires" label={t("horaires")} defaultValue={ima?.horaires ?? ""} maxLength={120} />
          </div>
        </fieldset>
      </FormulaireAction>
    </section>
  );
}

