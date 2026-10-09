// Parcours du répondant (F6), sur téléphone d'abord. Le code arrive après « # » (QR code) ou par saisie ;
// il n'est envoyé qu'au corps des requêtes, jamais dans l'adresse. Les réponses restent sur l'appareil
// jusqu'à l'envoi, puis en sont effacées.
"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MessageErreur, MessageInfo } from "@/components/Formulaire";
import { NOMS_LANGUES } from "@/components/LanguageSwitcher";
import { useRouter } from "@/i18n/navigation";
import { cleItem, type FichierInstrument } from "@/lib/instruments/format";

type Donnees = {
  langue: string;
  langues: string[];
  pays: string;
  ue: boolean;
  critere: string;
  seuil: number;
  groupes: { id: string; label: string }[];
  questionnaires: FichierInstrument[];
  aides: { numero: string; cle: string }[];
};
type Raison = "invalide" | "utilise" | "expire" | "pasOuverte" | "indisponible" | "reseau" | "reponses" | "groupe";
type Etape =
  | { nom: "saisie" }
  | { nom: "chargement" }
  | { nom: "erreur"; raison: Raison }
  | { nom: "info" }
  | { nom: "groupe" }
  | { nom: "questions"; page: number }
  | { nom: "fin" };
type Sauvegarde = { groupe?: string; reponses: Record<string, number | null>; page?: number };

const normaliser = (code: string) => code.toUpperCase().replace(/[^0-9A-Z]/g, "");

// Clé de sauvegarde sur l'appareil : dérivée du code, sans le contenir
async function cleStockage(code: string) {
  const empreinte = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`inneros:${normaliser(code)}`));
  return `inneros-q-${[...new Uint8Array(empreinte)].slice(0, 12).map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}
function lireStockage(cle: string): Sauvegarde | null {
  try {
    const brut = localStorage.getItem(cle);
    return brut ? (JSON.parse(brut) as Sauvegarde) : null;
  } catch {
    return null;
  }
}
function ecrireStockage(cle: string, valeur: Sauvegarde | null) {
  try {
    if (valeur) localStorage.setItem(cle, JSON.stringify(valeur));
    else localStorage.removeItem(cle);
  } catch {
    // Stockage indisponible (navigation privée…) : le questionnaire fonctionne quand même, sans reprise
  }
}

const boutonPrincipal =
  "rounded-md bg-ima-navy px-5 py-3 font-semibold text-white hover:bg-ima-navy-deep disabled:opacity-60";
const boutonSecondaire =
  "rounded-md border border-ima-navy px-5 py-3 font-semibold text-ima-navy hover:bg-ima-cream disabled:opacity-60";

export function Questionnaire() {
  const t = useTranslations("Passation");
  const tk = useTranslations("Kit");
  const tp = useTranslations("Pays");
  const tl = useTranslations("Libelles");
  const locale = useLocale();
  const router = useRouter();

  const [etape, setEtape] = useState<Etape>({ nom: "chargement" });
  const [code, setCode] = useState("");
  const [saisie, setSaisie] = useState("");
  const [donnees, setDonnees] = useState<Donnees | null>(null);
  const [cle, setCle] = useState<string | null>(null);
  const [sauvegarde, setSauvegarde] = useState<Sauvegarde>({ reponses: {} });
  const [reprise, setReprise] = useState(false);
  const [incomplet, setIncomplet] = useState(false);
  const [envoi, setEnvoi] = useState(false);

  const charger = useCallback(
    async (codeSaisi: string) => {
      setEtape({ nom: "chargement" });
      let r: Response;
      try {
        r = await fetch("/api/q/ouvrir", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ code: codeSaisi, langue: locale }),
        });
      } catch {
        setEtape({ nom: "erreur", raison: "reseau" });
        return;
      }
      const d = await r.json();
      if (d.etat !== "ok") {
        setEtape({ nom: "erreur", raison: d.etat });
        return;
      }
      // La langue demandée n'est pas proposée pour cette campagne : on passe à une langue prévue
      if (d.langue !== locale) {
        router.replace(`/q#${normaliser(codeSaisi)}`, { locale: d.langue });
        return;
      }
      const k = await cleStockage(codeSaisi);
      const existant = lireStockage(k);
      setCode(codeSaisi);
      setCle(k);
      setDonnees(d);
      setSauvegarde(existant ?? { reponses: {} });
      setReprise(!!existant && Object.keys(existant.reponses).length > 0);
      setEtape({ nom: "info" });
    },
    [locale, router],
  );

  // Code transmis par le QR code (après « # ») : lu au chargement de la page
  // (l'adresse n'existe que dans le navigateur : la lecture est faite après le premier affichage)
  useEffect(() => {
    const depuisAdresse = decodeURIComponent(window.location.hash.slice(1));
    void Promise.resolve().then(() => (depuisAdresse ? charger(depuisAdresse) : setEtape({ nom: "saisie" })));
  }, [charger]);

  // Chaque modification est gardée sur l'appareil, pour pouvoir reprendre plus tard
  useEffect(() => {
    if (cle && etape.nom !== "fin") ecrireStockage(cle, sauvegarde);
  }, [cle, sauvegarde, etape.nom]);

  const pages = useMemo(
    () => donnees?.questionnaires.flatMap((q) => q.dimensions.map((d) => ({ q, d }))) ?? [],
    [donnees],
  );
  const toutesCles = useMemo(
    () => pages.flatMap(({ q, d }) => d.items.map((i) => cleItem(q.instrument, i.id))),
    [pages],
  );
  const faites = toutesCles.filter((k) => sauvegarde.reponses[k] !== undefined).length;

  const repondre = (k: string, valeur: number | null) =>
    setSauvegarde((s) => ({ ...s, reponses: { ...s.reponses, [k]: valeur } }));

  const allerPage = (page: number) => {
    setIncomplet(false);
    setSauvegarde((s) => ({ ...s, page }));
    setEtape({ nom: "questions", page });
    window.scrollTo({ top: 0 });
  };

  const effacer = () => {
    if (!window.confirm(t("clearConfirm"))) return;
    setSauvegarde({ reponses: {} });
    setReprise(false);
    setEtape({ nom: "info" });
  };

  const envoyer = async () => {
    setEnvoi(true);
    try {
      const r = await fetch("/api/q/reponses", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code, groupe: sauvegarde.groupe, reponses: sauvegarde.reponses }),
      });
      const d = await r.json();
      if (d.ok) {
        if (cle) ecrireStockage(cle, null);
        setEtape({ nom: "fin" });
      } else {
        setEtape({ nom: "erreur", raison: d.raison });
      }
    } catch {
      setEtape({ nom: "erreur", raison: "reseau" });
    } finally {
      setEnvoi(false);
      window.scrollTo({ top: 0 });
    }
  };

  const titre = (texte: string) => (
    <>
      <h1 className="text-2xl sm:text-3xl">{texte}</h1>
      <div aria-hidden="true" className="mb-6 mt-4 h-0.5 w-16 bg-ima-gold" />
    </>
  );

  const aides = donnees && (
    <section aria-labelledby="aide" className="mt-8 rounded-md border-l-[3px] border-ima-gold bg-ima-cream px-5 py-4">
      <h2 id="aide" className="text-lg">{tk("helpTitle")}</h2>
      <p className="mt-2 text-sm">{tk("help")}</p>
      <ul className="mt-3 space-y-1">
        {donnees.aides.map((a) => (
          <li key={a.numero} className="flex gap-3">
            <a href={`tel:${a.numero.replace(/\s/g, "")}`} className="w-28 shrink-0 font-bold text-ima-navy underline">
              {a.numero}
            </a>
            <span>{tp(`${donnees.pays}.aides.${a.cle}`)}</span>
          </li>
        ))}
      </ul>
    </section>
  );

  if (etape.nom === "chargement") return <p role="status">{t("loading")}</p>;

  if (etape.nom === "saisie" || etape.nom === "erreur") {
    return (
      <div className="max-w-xl">
        {titre(t("enterTitle"))}
        {etape.nom === "erreur" && (
          <div className="mb-6">
            {etape.raison === "utilise" ? <MessageInfo>{t("utilise")}</MessageInfo> : <MessageErreur>{t(etape.raison)}</MessageErreur>}
          </div>
        )}
        {etape.nom === "erreur" && etape.raison === "reseau" && code ? (
          <button type="button" className={boutonPrincipal} onClick={() => void charger(code)}>
            {t("retry")}
          </button>
        ) : (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              window.history.replaceState(null, "", `#${normaliser(saisie)}`);
              void charger(saisie);
            }}
          >
            <p>{t("enterIntro")}</p>
            <div className="flex flex-col gap-1">
              <label htmlFor="code" className="font-semibold text-ima-navy">
                {t("codeLabel")}
              </label>
              <input
                id="code"
                value={saisie}
                onChange={(e) => setSaisie(e.target.value)}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                required
                aria-describedby="code-aide"
                className="w-full rounded-sm border border-ima-line bg-white px-3 py-3 text-lg tracking-widest"
              />
              <p id="code-aide" className="text-sm text-ima-muted">
                {t("codeHelp")}
              </p>
            </div>
            <div>
              <button type="submit" className={boutonPrincipal}>
                {t("access")}
              </button>
            </div>
          </form>
        )}
      </div>
    );
  }

  if (!donnees) return null;

  if (etape.nom === "fin") {
    return (
      <div className="max-w-xl">
        {titre(t("thanksTitle"))}
        <p>{t("thanksText")}</p>
        {aides}
      </div>
    );
  }

  const choixLangue = donnees.langues.length > 1 && (
    <div className="mb-6 flex flex-col gap-1 sm:max-w-xs">
      <label htmlFor="langue" className="text-sm font-semibold text-ima-navy">
        {t("languageLabel")}
      </label>
      <select
        id="langue"
        value={locale}
        onChange={(e) => router.replace(`/q#${normaliser(code)}`, { locale: e.target.value })}
        className="rounded-sm border border-ima-line bg-white px-3 py-2"
      >
        {donnees.langues.map((l) => (
          <option key={l} value={l}>
            {NOMS_LANGUES[l as keyof typeof NOMS_LANGUES]}
          </option>
        ))}
      </select>
    </div>
  );

  const lienEffacer = (
    <button type="button" onClick={effacer} className="mt-10 text-sm text-ima-muted underline">
      {t("clearDevice")}
    </button>
  );

  if (etape.nom === "info") {
    const points = [
      t("infoDuration"),
      t("infoAnonymous"),
      t("infoThreshold", { seuil: donnees.seuil }),
      t("infoFree"),
      t("infoNoDiagnosis"),
      donnees.ue ? `${t("infoAi")} ${t("infoAiEu")}` : t("infoAi"),
    ];
    return (
      <div className="max-w-2xl">
        {choixLangue}
        {titre(t("infoTitle"))}
        <p className="max-w-[70ch]">{t("infoIntro")}</p>
        <ul className="mt-5 max-w-[70ch] list-disc space-y-2 pl-5 marker:text-ima-gold">
          {points.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
        {reprise && (
          <div className="mt-6">
            <MessageInfo>{t("resumeInfo")}</MessageInfo>
          </div>
        )}
        <div className="mt-8">
          <button
            type="button"
            className={boutonPrincipal}
            onClick={() =>
              sauvegarde.groupe ? allerPage(Math.min(sauvegarde.page ?? 0, pages.length - 1)) : setEtape({ nom: "groupe" })
            }
          >
            {reprise ? t("resume") : t("start")}
          </button>
        </div>
        {aides}
        {reprise && lienEffacer}
      </div>
    );
  }

  if (etape.nom === "groupe") {
    return (
      <div className="max-w-2xl">
        {titre(t("groupTitle"))}
        <fieldset>
          <legend className="mb-4 max-w-[70ch]">
            {t("groupIntro", { critere: tl(`grouping.${donnees.critere}`).toLowerCase(), seuil: donnees.seuil })}
          </legend>
          <div className="flex flex-col gap-2">
            {donnees.groupes.map((g) => (
              <label
                key={g.id}
                className="flex cursor-pointer items-center gap-3 rounded-md border border-ima-line bg-white px-4 py-3 has-[:checked]:border-ima-navy has-[:checked]:bg-ima-cream"
              >
                <input
                  type="radio"
                  name="groupe"
                  value={g.id}
                  checked={sauvegarde.groupe === g.id}
                  onChange={() => setSauvegarde((s) => ({ ...s, groupe: g.id }))}
                  className="h-5 w-5 accent-ima-navy"
                />
                {g.label}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="mt-8 flex gap-3">
          <button type="button" className={boutonSecondaire} onClick={() => setEtape({ nom: "info" })}>
            {t("previous")}
          </button>
          <button type="button" className={boutonPrincipal} disabled={!sauvegarde.groupe} onClick={() => allerPage(0)}>
            {t("next")}
          </button>
        </div>
      </div>
    );
  }

  // Questions : une partie (dimension) par page
  const { q, d } = pages[etape.page];
  const echelles = new Map(q.echelles_reponse.map((e) => [e.id, e.options]));
  const clesPage = d.items.map((i) => cleItem(q.instrument, i.id));
  const pageComplete = clesPage.every((k) => sauvegarde.reponses[k] !== undefined);
  const derniere = etape.page === pages.length - 1;

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <div className="flex justify-between text-sm text-ima-muted">
          <span>{t("part", { page: etape.page + 1, pages: pages.length })}</span>
          <span>{t("progress", { fait: faites, total: toutesCles.length })}</span>
        </div>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={toutesCles.length}
          aria-valuenow={faites}
          aria-label={t("progress", { fait: faites, total: toutesCles.length })}
          className="mt-2 h-2 overflow-hidden rounded-full bg-ima-line"
        >
          <div className="h-full bg-ima-navy" style={{ width: `${(faites / toutesCles.length) * 100}%` }} />
        </div>
      </div>

      <p className="text-sm font-semibold uppercase tracking-widest text-ima-gold-text">{q.titre}</p>
      <h1 className="mt-1 text-xl sm:text-2xl">{d.nom}</h1>
      {d.consigne && <p className="mt-3 max-w-[70ch]">{d.consigne}</p>}

      <div className="mt-6 flex flex-col gap-6">
        {d.items.map((item) => {
          const k = cleItem(q.instrument, item.id);
          const valeur = sauvegarde.reponses[k];
          const option = (libelle: string, v: number | null) => (
            <label
              key={String(v)}
              className="flex cursor-pointer items-center gap-3 rounded-md border border-ima-line bg-white px-4 py-3 has-[:checked]:border-ima-navy has-[:checked]:bg-ima-cream"
            >
              <input
                type="radio"
                name={k}
                checked={valeur === v}
                onChange={() => repondre(k, v)}
                className="h-5 w-5 shrink-0 accent-ima-navy"
              />
              <span>{libelle}</span>
            </label>
          );
          return (
            <fieldset key={k} className="rounded-md">
              <legend className="mb-3 font-semibold text-ima-navy">{item.texte}</legend>
              <div className="flex flex-col gap-2">
                {echelles.get(item.reponse)!.map((o) => option(o.libelle, o.code))}
                {option(t("preferNot"), null)}
              </div>
            </fieldset>
          );
        })}
      </div>

      {incomplet && !pageComplete && (
        <div className="mt-6">
          <MessageErreur>{t("incomplete")}</MessageErreur>
        </div>
      )}

      <div className="mt-8 flex flex-wrap gap-3">
        <button
          type="button"
          className={boutonSecondaire}
          onClick={() => (etape.page === 0 ? setEtape({ nom: "groupe" }) : allerPage(etape.page - 1))}
        >
          {t("previous")}
        </button>
        <button
          type="button"
          className={boutonPrincipal}
          disabled={envoi}
          onClick={() => {
            if (!pageComplete) {
              setIncomplet(true);
              return;
            }
            if (derniere) void envoyer();
            else allerPage(etape.page + 1);
          }}
        >
          {derniere ? (envoi ? t("sending") : t("submit")) : t("next")}
        </button>
      </div>

      <p className="mt-8 text-xs text-ima-muted">{t("source", { source: q.source })}</p>
      {lienEffacer}
    </div>
  );
}
