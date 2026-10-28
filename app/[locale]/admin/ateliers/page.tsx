// Demandes d'appui des conseillers en prévention pour leurs ateliers (module C) : IMA accepte, désigne
// l'animateur IMA, ou refuse avec un message. Le conseiller est prévenu par e-mail.
import { getTranslations, setRequestLocale } from "next-intl/server";
import { actionRepondreAppui } from "@/app/[locale]/ateliers/actions";
import { EspaceAdmin, TitrePage } from "@/components/EspaceAdmin";
import { Selection, ZoneTexte } from "@/components/Formulaire";
import { FormulaireAction } from "@/components/FormulaireAction";
import { Link } from "@/i18n/navigation";
import { administrateursActifs, ateliersAvecAppui, FUSEAUX, phase } from "@/lib/ateliers/ateliers";
import { exigerAdmin } from "@/lib/auth/acces";
import { getDb } from "@/lib/db/client";

export default async function AteliersAppuiPage({ params }: PageProps<"/[locale]/admin/ateliers">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const admin = await exigerAdmin(locale);
  const t = await getTranslations("Ateliers");
  const db = getDb();
  const liste = (await ateliersAvecAppui(db, admin)) ?? [];
  const admins = await administrateursActifs(db);
  const quand = (d: Date, pays: string) => new Intl.DateTimeFormat(locale, { dateStyle: "full", timeStyle: "short", timeZone: FUSEAUX[pays] }).format(d);

  return (
    <EspaceAdmin locale={locale} actif="ateliers">
      <TitrePage surtitre={t("title")} titre={t("adminTitle")} />
      <p className="mb-8 max-w-[70ch] text-ima-muted">{t("adminHelp")}</p>
      {liste.length === 0 ? (
        <p>{t("adminEmpty")}</p>
      ) : (
        <ul className="flex max-w-3xl flex-col gap-4">
          {liste.map(({ atelier: a, entreprise, organizationId, pays }) => (
            <li key={a.id} className={`rounded-md border bg-white p-4 ${a.supportStatus === "demande" ? "border-ima-gold" : "border-ima-line"}`}>
              <p className="font-semibold text-ima-navy">
                {entreprise} · {a.title}
              </p>
              <p className="text-sm text-ima-muted">
                {t(`types.${a.type}`)} · {quand(a.startsAt, pays)} · {t(`phases.${phase(a)}`)}
              </p>
              <p className="mt-1 text-sm font-semibold text-ima-gold-text">{t(`supportStatus.${a.supportStatus}`)}</p>
              {a.supportRequest && <p className="mt-1 whitespace-pre-line text-sm">{t("request", { texte: a.supportRequest })}</p>}
              {a.supportReply && <p className="mt-1 text-sm">{t("imaReply", { texte: a.supportReply })}</p>}
              <p className="mt-2">
                <Link href={`/admin/entreprises/${organizationId}/ateliers/${a.id}`} className="text-sm font-semibold text-ima-navy underline">
                  {t("open")}
                </Link>
              </p>
              {a.supportStatus === "demande" && (
                <div className="mt-4 grid gap-6 sm:grid-cols-2">
                  <FormulaireAction action={actionRepondreAppui.bind(null, locale, a.id, true)} libelle={t("accept")} enCours={t("working")} className="flex flex-col gap-3">
                    <Selection id={`animateur-${a.id}`} name="animateur" label={t("facilitatorIma")} options={admins.map((x) => ({ valeur: x.id, libelle: x.name }))} defaultValue={admin.id} />
                    <ZoneTexte id={`ok-${a.id}`} name="reponse" label={t("reply")} aide={t("replyHelp")} maxLength={500} />
                  </FormulaireAction>
                  <FormulaireAction action={actionRepondreAppui.bind(null, locale, a.id, false)} libelle={t("refuse")} enCours={t("working")} secondaire className="flex flex-col gap-3">
                    <ZoneTexte id={`non-${a.id}`} name="reponse" label={t("reply")} aide={t("replyHelp")} required minLength={3} maxLength={500} />
                  </FormulaireAction>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </EspaceAdmin>
  );
}
