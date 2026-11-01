// Aide à la rédaction (module D2) : 1. notes brutes sans donnée personnelle, 2. brouillon préparé par l'IA,
// corrigé à l'écran, 3. approbation et téléchargement en Word. Le brouillon n'existe que dans ce navigateur.
"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { actionPreparerBrouillon } from "@/app/[locale]/redaction/actions";
import { Champ, MessageErreur, MessageInfo, Selection, ZoneTexte } from "@/components/Formulaire";
import { LONGUEUR_NOTES, TYPES_REDACTION } from "@/lib/redaction/constantes";

type Section = { titre: string; texte: string };

const bouton = "rounded-md bg-ima-navy px-5 py-2.5 font-semibold text-white hover:bg-ima-navy-deep disabled:opacity-60";
const boutonSecondaire = "rounded-md border border-ima-navy px-5 py-2.5 font-semibold text-ima-navy hover:bg-ima-cream";

export function AideRedaction({ locale, restantes }: { locale: string; restantes: number }) {
  const t = useTranslations("Redaction");
  const [type, setType] = useState<string>(TYPES_REDACTION[0]);
  const [notes, setNotes] = useState("");
  const [engagement, setEngagement] = useState(false);
  const [titre, setTitre] = useState("");
  const [sections, setSections] = useState<Section[] | null>(null);
  const [aCompleter, setACompleter] = useState<string[]>([]);
  const [approuve, setApprouve] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  const preparer = () =>
    demarrer(async () => {
      setErreur(null);
      const r = await actionPreparerBrouillon(locale, { type, langue: locale, notes, sansDonneesPersonnelles: engagement });
      if (r.erreur || !r.brouillon) return setErreur(r.erreur ?? t("error"));
      setTitre(r.brouillon.titre);
      setSections(r.brouillon.sections.map((s) => ({ titre: s.titre, texte: s.paragraphes.join("\n\n") })));
      setACompleter(r.brouillon.a_completer);
      setApprouve(false);
    });

  const telecharger = () =>
    demarrer(async () => {
      setErreur(null);
      const reponse = await fetch("/api/redaction/word", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type, langue: locale, titre, sections, approuve }),
      });
      if (!reponse.ok) return setErreur(reponse.status === 422 ? t("personalDataInDraft") : t("error"));
      const lien = URL.createObjectURL(await reponse.blob());
      const a = document.createElement("a");
      a.href = lien;
      a.download = "brouillon-ima.docx";
      a.click();
      URL.revokeObjectURL(lien);
    });

  if (!sections)
    return (
      <div className="flex max-w-3xl flex-col gap-5">
        <MessageInfo>{t("goodPractice")}</MessageInfo>
        <Selection id="type" label={t("type")} value={type} onChange={(e) => setType(e.target.value)} options={TYPES_REDACTION.map((x) => ({ valeur: x, libelle: t(`types.${x}`) }))} />
        <ZoneTexte id="notes" label={t("notes")} aide={t("notesHelp", { max: LONGUEUR_NOTES })} rows={12} maxLength={LONGUEUR_NOTES} value={notes} onChange={(e) => setNotes(e.target.value)} />
        <label className="flex items-start gap-2">
          <input type="checkbox" checked={engagement} onChange={(e) => setEngagement(e.target.checked)} className="mt-1 h-5 w-5 accent-ima-navy" />
          <span>{t("commitment")}</span>
        </label>
        {erreur && <MessageErreur>{erreur}</MessageErreur>}
        <div className="flex flex-wrap items-center gap-4">
          <button type="button" className={bouton} disabled={enCours || !engagement || notes.trim().length < 30 || restantes <= 0} onClick={preparer}>
            {enCours ? t("preparing") : t("prepare")}
          </button>
          <span className="text-sm text-ima-muted">{t("remaining", { n: restantes })}</span>
        </div>
      </div>
    );

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <MessageInfo>{t("draftNotice")}</MessageInfo>
      {aCompleter.length > 0 && (
        <div className="rounded-md border-l-[3px] border-repere-vigilance bg-white px-5 py-4">
          <p className="font-semibold text-ima-navy">{t("toComplete")}</p>
          <ul className="mt-2 list-disc pl-5">
            {aCompleter.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </div>
      )}
      <Champ id="titre" label={t("title")} value={titre} maxLength={200} onChange={(e) => setTitre(e.target.value)} />
      {sections.map((s, i) => (
        <fieldset key={i} className="flex flex-col gap-3 rounded-md border border-ima-line bg-white p-4">
          <Champ id={`section-${i}`} label={t("sectionTitle", { n: i + 1 })} value={s.titre} maxLength={200} onChange={(e) => setSections(sections.map((x, j) => (j === i ? { ...x, titre: e.target.value } : x)))} />
          <ZoneTexte id={`texte-${i}`} label={t("sectionText")} rows={Math.min(14, 3 + Math.ceil(s.texte.length / 90))} maxLength={12000} value={s.texte} onChange={(e) => setSections(sections.map((x, j) => (j === i ? { ...x, texte: e.target.value } : x)))} />
        </fieldset>
      ))}
      <label className="flex items-start gap-2">
        <input type="checkbox" checked={approuve} onChange={(e) => setApprouve(e.target.checked)} className="mt-1 h-5 w-5 accent-ima-navy" />
        <span>{t("approve")}</span>
      </label>
      {erreur && <MessageErreur>{erreur}</MessageErreur>}
      <div className="flex flex-wrap gap-3">
        <button type="button" className={bouton} disabled={enCours || !approuve || !titre.trim()} onClick={telecharger}>
          {enCours ? t("preparing") : t("download")}
        </button>
        <button type="button" className={boutonSecondaire} onClick={() => setSections(null)}>
          {t("restart")}
        </button>
      </div>
      <p className="text-sm text-ima-muted">{t("nothingStored")}</p>
    </div>
  );
}
