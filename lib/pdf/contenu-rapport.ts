// Assemble le contenu du PDF du rapport, dans la langue du rapport (étape 8B).
// Les « questions pour le praticien » restent internes à IMA : elles ne figurent jamais dans le PDF.
import { eq } from "drizzle-orm";
import { campaigns, organizations, users } from "../db/schema";
import type { Db } from "../db/types";
import { lireContenu, NIVEAUX_MINDSET } from "../rapport/contenu";
import { rapportCourant } from "../rapport/rapports";
import { lireResultats } from "../resultats/agregats";
import { traducteur } from "../traduction";
import type { BlocComportements, ContenuPdfRapport, TableauResultats } from "./rapport";
import { textesComportements } from "../../components/ResultatsComportements";
import type { ResultatsComportements } from "../resultats/agregats";

const ORDRE = [...NIVEAUX_MINDSET, "sante", "aucun"] as const;

export async function contenuPdfRapport(db: Db, campaignId: string): Promise<ContenuPdfRapport | null> {
  const [ligne] = await db
    .select({ campagne: campaigns, entreprise: organizations })
    .from(campaigns)
    .innerJoin(organizations, eq(campaigns.organizationId, organizations.id))
    .where(eq(campaigns.id, campaignId));
  const rapport = await rapportCourant(db, campaignId);
  if (!ligne || !rapport) return null;
  const contenu = lireContenu(rapport.finalText);
  if (!contenu) return null;
  const { campagne, entreprise } = ligne;
  const langue = rapport.language ?? entreprise.locale;
  const t = traducteur(langue, "RapportPdf");
  const tr = traducteur(langue, "Rapport");
  const tres = traducteur(langue, "Resultats");
  const niveaux = tres.raw("levels") as Record<string, string>;
  const natures = tr.raw("natures") as Record<string, string>;
  const confiances = tr.raw("confiances") as Record<string, string>;
  const acteurs = tr.raw("acteursListe") as Record<string, string>;
  const date = (d: Date | string) =>
    new Intl.DateTimeFormat(langue, { dateStyle: "long", timeZone: "UTC" }).format(typeof d === "string" ? new Date(`${d}T00:00:00Z`) : d);
  const nombre = (v: number) => new Intl.NumberFormat(langue, { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(v);

  const valide = rapport.status === "validated";
  const [validateur] = rapport.validatedBy ? await db.select({ name: users.name }).from(users).where(eq(users.id, rapport.validatedBy)) : [];
  const nom = validateur?.name ?? "—";

  const resultats = await lireResultats(db, campaignId, langue);
  const groupes = resultats?.groupes ?? [];
  const codeGroupe = new Map(groupes.map((g, i) => [g.id, `G${i + 1}`]));
  const totalExploitable = Math.max(
    0,
    ...(resultats?.questionnaires.flatMap((q) => q.dimensions.flatMap((d) => d.resultats.filter((r) => r.groupId === null).map((r) => r.n))) ?? []),
  );

  const participation = [
    campagne.tokensIssued
      ? t("participation", { reponses: totalExploitable, codes: campagne.tokensIssued, taux: Math.round((totalExploitable / campagne.tokensIssued) * 100) })
      : t("participationSansCodes", { reponses: totalExploitable }),
    groupes.length ? t("groupesPresentes", { groupes: groupes.map((g, i) => `${g.libelle} (G${i + 1})`).join(", ") }) : t("aucunGroupe"),
  ];
  if (resultats?.groupesMasques) participation.push(t("groupesMasques", { count: resultats.groupesMasques, seuil: campagne.groupMinSize }));

  const tc = textesComportements(traducteur(langue, "Comportements"));
  const pourcent = (n: number, base: number) => new Intl.NumberFormat(langue, { maximumFractionDigits: 1 }).format(base ? (n / base) * 100 : 0);
  const comportements = (c: ResultatsComportements | null): BlocComportements | undefined =>
    c
      ? {
          titre: tc.titre,
          intro: tc.intro,
          blocs: [
            ...c.liste.map((b) => ({
              titre: b.nom,
              lignes: [
                tc.concernes({ concernes: b.concernes, base: b.base, taux: pourcent(b.concernes, b.base) }),
                ...(b.concernes
                  ? [
                      `${tc.frequence} : ${b.frequences.map((f) => `${f.libelle} ${f.n}`).join(" · ")}`,
                      `${tc.auteurs} : ${b.auteurs.map((a) => `${a.libelle} ${a.n}`).join(" · ")}${b.auteursNonPrecises ? ` · ${tc.nonPrecise(b.auteursNonPrecises)}` : ""}`,
                    ]
                  : []),
              ],
            })),
            ...(c.cumul
              ? [
                  {
                    titre: tc.cumulTitre,
                    lignes: [
                      tc.cumul({ concernes: c.cumul.concernes, base: c.cumul.base, taux: pourcent(c.cumul.concernes, c.cumul.base) }),
                      ...c.cumul.parNombre.map((p) => tc.parNombre(p)),
                    ],
                  },
                ]
              : []),
          ],
        }
      : undefined;

  const questionnaires = (resultats?.questionnaires ?? []).map((q) => ({
    titre: q.titre,
    comportements: comportements(q.comportements),
    tableaux: ORDRE.flatMap((niveau): TableauResultats[] => {
      const dims = q.dimensions.filter((d) => (d.niveau ?? "aucun") === niveau && d.resultats.length);
      if (!dims.length) return [];
      return [
        {
          niveau: niveaux[niveau],
          colonnes: [tres("scale"), tres("all"), ...groupes.map((g) => codeGroupe.get(g.id)!)],
          lignes: dims.map((d) => ({
            echelle: d.nom,
            valeurs: [null, ...groupes.map((g) => g.id)].map((gid) => {
              const r = d.resultats.find((x) => x.groupId === gid);
              return r ? `${nombre(r.moyenne)} (${r.n})` : "—";
            }),
          })),
        },
      ];
    }),
  }));

  const pleines = (l: string[]) => l.map((x) => x.trim()).filter(Boolean);
  const sections: ContenuPdfRapport["sections"] = [{ titre: tr("synthese"), paragraphes: contenu.synthese.split(/\n+/).filter(Boolean) }];
  if (contenu.priorites_proposees.length) {
    sections.push({
      titre: tr("priorites"),
      numerotees: true,
      puces: contenu.priorites_proposees.map(
        (p) => `${p.priorite} — ${p.justification}${p.acteurs.length ? ` (${tr("acteurs")} : ${p.acteurs.map((a) => acteurs[a]).join(", ")})` : ""}`,
      ),
    });
  }
  if (pleines(contenu.orientations).length) sections.push({ titre: tr("orientations"), puces: pleines(contenu.orientations) });
  sections.push({ titre: tr("limites"), puces: pleines(contenu.limites).length ? pleines(contenu.limites) : [t("limitesParDefaut")] });

  return {
    fichier: `rapport-${campagne.mandateReference.replace(/[^\w-]+/g, "_").slice(0, 60)}.pdf`,
    marque: "INSTITUT MINDSET EN ACTION®",
    titre: t("titre"),
    entreprise: entreprise.name,
    reference: t("reference", { reference: campagne.mandateReference }),
    periode: t("periode", { debut: date(campagne.startDate), fin: date(campagne.endDate) }),
    validation: valide && rapport.validatedAt ? t("validation", { nom, date: date(rapport.validatedAt) }) : t("nonValide"),
    brouillon: valide ? undefined : t("brouillon"),
    mention: rapport.aiModel ? tr("mentionAi", { nom }) : tr("mentionManual", { nom }),
    anonymat: t("anonymat", { seuil: campagne.groupMinSize }),
    participation,
    sections,
    resultats: {
      titre: t("resultatsTitre"),
      lecture: t("lecture"),
      legende: groupes.length ? t("legende", { legende: groupes.map((g, i) => `G${i + 1} = ${g.libelle}`).join(" · ") }) : "",
      questionnaires,
    },
    cartographie: {
      titre: tr("cartographie"),
      niveaux: contenu.cartographie
        .map((b) => ({
          niveau: niveaux[b.niveau],
          constats: b.constats
            .filter((k) => k.texte.trim())
            .map((k) => ({
              texte: k.texte,
              detail: `${natures[k.nature]} · ${tr("confiance")} : ${confiances[k.confiance]}${k.sources.length ? ` · ${k.sources.join(", ")}` : ""}`,
            })),
        }))
        .filter((n) => n.constats.length),
    },
    sources: { titre: t("sourcesTitre"), lignes: resultats?.questionnaires.map((q) => q.source) ?? [] },
    pied: t("pied"),
  };
}
