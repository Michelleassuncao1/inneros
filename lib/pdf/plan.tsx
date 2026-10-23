// Plan de prévention RPS en PDF (module A3, partie 2), à la charte IMA : page de garde (validation, adoption,
// mention de l'IA), plan global sur 5 ans, plan d'action avec l'état de chaque action, cadre légal.
// Les « questions pour le praticien » restent internes à IMA : elles ne figurent jamais dans le PDF.
import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { traducteur } from "../traduction";
import type { DonneesPlan } from "../plan/export";
import { COULEURS, enregistrerPolices, logoIma, SERIF, Vague } from "./commun";

const LARGEUR_PAGE = 595.28; // A4 portrait ; paysage : 841.89

const s = StyleSheet.create({
  page: { paddingTop: 40, paddingHorizontal: 40, paddingBottom: 84, fontFamily: "Figtree", fontSize: 9.5, color: COULEURS.ink, lineHeight: 1.45 },
  entete: { flexDirection: "row", alignItems: "center", marginBottom: 28 },
  logo: { width: 52, height: 52, marginRight: 12 },
  marque: { fontSize: 8, fontWeight: 700, color: COULEURS.goldText, letterSpacing: 1.2 },
  titre: { fontFamily: SERIF, fontSize: 22, color: COULEURS.navy, lineHeight: 1.2 },
  filet: { width: 52, height: 2, backgroundColor: COULEURS.gold, marginVertical: 12 },
  entreprise: { fontSize: 14, color: COULEURS.navy, fontWeight: 700 },
  meta: { fontSize: 9.5, color: COULEURS.muted, marginTop: 3 },
  brouillon: { marginTop: 12, padding: 8, backgroundColor: COULEURS.cream, color: COULEURS.goldText, fontSize: 10, fontWeight: 700 },
  encadre: { marginTop: 16, padding: 12, backgroundColor: COULEURS.cream, borderLeftWidth: 3, borderLeftColor: COULEURS.gold },
  mention: { fontWeight: 700, color: COULEURS.navy },
  section: { marginTop: 14 },
  titreSection: { fontFamily: SERIF, fontSize: 13, color: COULEURS.navy, marginBottom: 5 },
  sousTitre: { fontWeight: 700, color: COULEURS.navy, marginTop: 8, marginBottom: 3 },
  puce: { flexDirection: "row", marginBottom: 2 },
  point: { width: 12, color: COULEURS.gold, fontWeight: 700 },
  ligneEntete: { flexDirection: "row", backgroundColor: COULEURS.navy },
  celluleEntete: { color: "#FFFFFF", fontWeight: 700, fontSize: 8, paddingVertical: 4, paddingHorizontal: 4 },
  ligne: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: COULEURS.line },
  cellule: { fontSize: 8, paddingVertical: 3, paddingHorizontal: 4 },
  detail: { fontSize: 7.5, color: COULEURS.muted },
  piedTexte: { position: "absolute", bottom: 56, left: 40, right: 110, fontSize: 7.5, color: COULEURS.muted },
  pagination: { position: "absolute", bottom: 56, right: 40, fontSize: 8, color: COULEURS.muted },
  vague: { position: "absolute", left: 0, right: 0, bottom: 0 },
});

function Puces({ lignes }: { lignes: string[] }) {
  return (
    <>
      {lignes
        .filter((l) => l.trim())
        .map((p, i) => (
          <View key={i} style={s.puce}>
            <Text style={s.point}>•</Text>
            <Text style={{ flex: 1 }}>{p}</Text>
          </View>
        ))}
    </>
  );
}

// Colonnes du tableau d'actions (largeurs en %)
const COLONNES = [30, 15, 9, 9, 13, 12, 12];

export async function pdfPlan(d: DonneesPlan, langueInterface?: string) {
  enregistrerPolices();
  const langue = langueInterface ?? d.plan.language;
  const t = traducteur(langue, "Plan");
  const tres = traducteur(langue, "Resultats");
  const tr = traducteur(langue, "Risques");
  const date = (x: string | Date) =>
    new Intl.DateTimeFormat(langue, { dateStyle: "long", timeZone: "UTC" }).format(typeof x === "string" ? new Date(`${x}T00:00:00Z`) : x);
  const titres = new Map(d.registre.map((r) => [r.id, r.title]));
  const noms = (ids: string[]) => ids.map((id) => titres.get(id) ?? t("unknownRisk")).join(" · ");
  const { plan, contenu } = d;
  const valide = plan.status === "validated" || plan.status === "replaced";
  const nomValidateur = d.validePar ?? "—";

  const pied = (largeur = LARGEUR_PAGE) => (
    <>
      <Text style={s.piedTexte} fixed>
        {t("pdfFooter")}
      </Text>
      <Text style={s.pagination} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
      <View style={s.vague} fixed>
        <Vague largeur={largeur} hauteur={50} />
      </View>
    </>
  );

  return renderToBuffer(
    <Document title={`${t("title")} — ${d.org.name}`} author="Institut Mindset en Action">
      <Page size="A4" style={s.page}>
        <View style={s.entete}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- Image de react-pdf, pas une balise HTML */}
          <Image src={logoIma()} style={s.logo} />
          <Text style={s.marque}>INSTITUT MINDSET EN ACTION®</Text>
        </View>
        <Text style={s.titre}>{t("title")}</Text>
        <View style={s.filet} />
        <Text style={s.entreprise}>{d.org.name}</Text>
        <Text style={s.meta}>{t("pdfPeriode", { debut: plan.startYear, fin: plan.startYear + 4, annee: plan.actionYear })}</Text>
        {valide && plan.validatedAt ? (
          <Text style={s.meta}>{t("pdfValidation", { nom: nomValidateur, date: date(plan.validatedAt) })}</Text>
        ) : (
          <Text style={s.brouillon}>{t("pdfDraft")}</Text>
        )}
        {plan.adoptedAt ? (
          <Text style={s.meta}>
            {t("adoptedMeta", {
              nom: d.adoptePar ?? "—",
              date: date(plan.adoptedAt),
              organe: t(`organes.${plan.consultationBody ?? "aucun_cse"}`),
              avis: plan.consultationDate ? date(plan.consultationDate) : "—",
            })}
          </Text>
        ) : (
          <Text style={s.meta}>{t("notAdopted")}</Text>
        )}
        <View style={s.encadre}>
          <Text style={s.mention}>{plan.aiModel ? t("mentionAi", { nom: nomValidateur }) : t("mentionManual", { nom: nomValidateur })}</Text>
        </View>

        <View style={s.section}>
          <Text style={s.titreSection}>{t("pgpTitle")}</Text>
          {contenu.rappel_risques.trim() && (
            <>
              <Text style={s.sousTitre}>{t("rappel")}</Text>
              <Text>{contenu.rappel_risques}</Text>
            </>
          )}
          {contenu.objectifs.length > 0 && (
            <>
              <Text style={s.sousTitre}>{t("objectifs")}</Text>
              {contenu.objectifs.map((o, i) => (
                <View key={i} style={s.puce} wrap={false}>
                  <Text style={s.point}>{i + 1}.</Text>
                  <View style={{ flex: 1 }}>
                    <Text>
                      {tres(`levels.${o.niveau}`)} — {o.objectif}
                    </Text>
                    {o.risques.length > 0 && <Text style={s.detail}>{noms(o.risques)}</Text>}
                  </View>
                </View>
              ))}
            </>
          )}
          {contenu.mesures.length > 0 && (
            <>
              <Text style={s.sousTitre}>{t("mesures")}</Text>
              <Puces lignes={contenu.mesures.map((m) => `${m.mesure} (${t(`niveaux.${m.niveau_prevention}`)})`)} />
            </>
          )}
          {contenu.moyens.some((m) => m.trim()) && (
            <>
              <Text style={s.sousTitre}>{t("moyens")}</Text>
              <Puces lignes={contenu.moyens} />
            </>
          )}
          {contenu.roles.length > 0 && (
            <>
              <Text style={s.sousTitre}>{t("roles")}</Text>
              <Puces lignes={contenu.roles.map((r) => `${r.fonction} : ${r.role}`)} />
            </>
          )}
          {contenu.calendrier.some((c) => c.etapes.some((e) => e.trim())) && (
            <>
              <Text style={s.sousTitre}>{t("calendrier")}</Text>
              {contenu.calendrier.map((c) => (
                <View key={c.annee} wrap={false} style={{ marginBottom: 4 }}>
                  <Text style={{ fontWeight: 700 }}>{t("annee", { n: c.annee, annee: plan.startYear + c.annee - 1 })}</Text>
                  <Puces lignes={c.etapes} />
                </View>
              ))}
            </>
          )}
          {contenu.evaluation.some((e) => e.trim()) && (
            <>
              <Text style={s.sousTitre}>{t("evaluation")}</Text>
              <Puces lignes={contenu.evaluation} />
            </>
          )}
        </View>
        {pied()}
      </Page>

      <Page size="A4" orientation="landscape" style={s.page}>
        <Text style={s.titreSection}>{t("paaTitle", { annee: plan.actionYear })}</Text>
        <View style={s.ligneEntete} fixed>
          {[t("colAction"), t("colResponsable"), t("colEcheance"), t("colEffort"), t("colBudget"), t("colIndicateur"), t("colStatut")].map((c, i) => (
            <Text key={c} style={[s.celluleEntete, { width: `${COLONNES[i]}%` }]}>
              {c}
            </Text>
          ))}
        </View>
        {[...contenu.actions]
          .sort((a, b) => a.trimestre - b.trimestre)
          .map((a) => {
            const suivi = d.avancement.get(a.id);
            return (
              <View key={a.id} style={s.ligne} wrap={false}>
                <View style={[s.cellule, { width: `${COLONNES[0]}%` }]}>
                  <Text style={{ fontWeight: 700 }}>{a.titre}</Text>
                  {a.description ? <Text>{a.description}</Text> : null}
                  <Text style={s.detail}>
                    {t(`niveaux.${a.niveau_prevention}`)}
                    {a.risques.length ? ` · ${noms(a.risques)}` : ""}
                  </Text>
                </View>
                <Text style={[s.cellule, { width: `${COLONNES[1]}%` }]}>{a.responsable}</Text>
                <Text style={[s.cellule, { width: `${COLONNES[2]}%` }]}>
                  {t("trimestre", { n: a.trimestre })} {plan.actionYear}
                </Text>
                <Text style={[s.cellule, { width: `${COLONNES[3]}%` }]}>{t(`efforts.${a.effort}`)}</Text>
                <Text style={[s.cellule, { width: `${COLONNES[4]}%` }]}>{a.budget}</Text>
                <Text style={[s.cellule, { width: `${COLONNES[5]}%` }]}>{a.indicateur}</Text>
                <View style={[s.cellule, { width: `${COLONNES[6]}%` }]}>
                  <Text>{t(`statutsAction.${suivi?.status ?? "a_faire"}`)}</Text>
                  {suivi?.doneOn ? <Text style={s.detail}>{date(suivi.doneOn)}</Text> : null}
                </View>
              </View>
            );
          })}

        <View style={s.section} wrap={false}>
          <Text style={s.titreSection}>{tr("title")}</Text>
          {d.registre
            .filter((r) => r.status !== "clos")
            .sort((a, b) => b.score - a.score)
            .map((r) => (
              <Text key={r.id} style={{ fontSize: 8 }}>
                {r.title} — P {r.p} × E {r.e} × G {r.g} = {r.score} · {tr(`classes.${r.classe}`)}
              </Text>
            ))}
        </View>
        {contenu.cadre_legal.trim() && (
          <View style={s.section} wrap={false}>
            <Text style={s.titreSection}>{t("cadre")}</Text>
            <Text>{contenu.cadre_legal}</Text>
          </View>
        )}
        {pied(841.89)}
      </Page>
    </Document>,
  );
}
