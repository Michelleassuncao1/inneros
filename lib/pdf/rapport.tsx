// Rapport collectif InnerOS en PDF (étape 8B), à la charte IMA : page de garde, en-têtes de tableaux
// bleu nuit, vague en pied de page, mention de l'assistance de l'IA, sources des questionnaires, limites.
// Tous les textes arrivent déjà traduits (voir contenu-rapport.ts).
import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { COULEURS, enregistrerPolices, logoIma, SERIF, Vague } from "./commun";

export type TableauResultats = {
  niveau: string;
  colonnes: string[]; // « Échelle », « Ensemble », puis un groupe par colonne
  lignes: { echelle: string; valeurs: string[] }[];
};

export type ContenuPdfRapport = {
  fichier: string; // nom du fichier téléchargé
  marque: string;
  titre: string;
  entreprise: string;
  reference: string;
  periode: string;
  validation: string; // « Rapport validé par … le … » ou bandeau de brouillon
  brouillon?: string; // présent seulement pour un aperçu non validé
  mention: string; // assistance de l'IA / validation humaine
  anonymat: string;
  participation: string[];
  sections: { titre: string; paragraphes?: string[]; puces?: string[]; numerotees?: boolean }[];
  resultats: { titre: string; lecture: string; legende: string; questionnaires: { titre: string; tableaux: TableauResultats[] }[] };
  cartographie: { titre: string; niveaux: { niveau: string; constats: { texte: string; detail: string }[] }[] };
  sources: { titre: string; lignes: string[] };
  pied: string;
};

const LARGEUR_PAGE = 595.28;

const s = StyleSheet.create({
  page: { paddingTop: 40, paddingHorizontal: 48, paddingBottom: 84, fontFamily: "Figtree", fontSize: 9.5, color: COULEURS.ink, lineHeight: 1.45 },
  entete: { flexDirection: "row", alignItems: "center", marginBottom: 28 },
  logo: { width: 52, height: 52, marginRight: 12 },
  marque: { fontSize: 8, fontWeight: 700, color: COULEURS.goldText, letterSpacing: 1.2 },
  titre: { fontFamily: SERIF, fontSize: 22, color: COULEURS.navy, lineHeight: 1.2 },
  filet: { width: 52, height: 2, backgroundColor: COULEURS.gold, marginVertical: 12 },
  entreprise: { fontSize: 14, color: COULEURS.navy, fontWeight: 700 },
  meta: { fontSize: 9.5, color: COULEURS.muted, marginTop: 3 },
  brouillon: { marginTop: 12, padding: 8, backgroundColor: COULEURS.cream, color: COULEURS.goldText, fontSize: 10, fontWeight: 700 },
  encadre: { marginTop: 16, padding: 12, backgroundColor: COULEURS.cream, borderLeftWidth: 3, borderLeftColor: COULEURS.gold },
  mention: { fontWeight: 700, color: COULEURS.navy, marginBottom: 4 },
  section: { marginTop: 14 },
  titreSection: { fontFamily: SERIF, fontSize: 13, color: COULEURS.navy, marginBottom: 5 },
  sousTitre: { fontWeight: 700, color: COULEURS.navy, marginTop: 8, marginBottom: 3 },
  paragraphe: { marginBottom: 4 },
  puce: { flexDirection: "row", marginBottom: 2 },
  point: { width: 12, color: COULEURS.gold, fontWeight: 700 },
  tableau: { marginTop: 4, marginBottom: 8 },
  ligneEntete: { flexDirection: "row", backgroundColor: COULEURS.navy },
  celluleEntete: { color: "#FFFFFF", fontWeight: 700, fontSize: 8.5, paddingVertical: 4, paddingHorizontal: 5 },
  ligne: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: COULEURS.line },
  cellule: { fontSize: 8.5, paddingVertical: 3, paddingHorizontal: 5 },
  constat: { marginBottom: 6, paddingLeft: 8, borderLeftWidth: 1.5, borderLeftColor: COULEURS.line },
  detail: { fontSize: 8, color: COULEURS.muted, marginTop: 1 },
  note: { fontSize: 8.5, color: COULEURS.muted, marginBottom: 4 },
  piedTexte: { position: "absolute", bottom: 56, left: 48, right: 110, fontSize: 7.5, color: COULEURS.muted },
  pagination: { position: "absolute", bottom: 56, right: 48, fontSize: 8, color: COULEURS.muted },
  vague: { position: "absolute", left: 0, right: 0, bottom: 0 },
});

function Tableau({ t }: { t: TableauResultats }) {
  const autres = t.colonnes.length - 1;
  const largeurEchelle = autres > 4 ? "34%" : "44%";
  const largeurValeur = `${(100 - Number.parseInt(largeurEchelle, 10)) / autres}%`;
  const largeur = (i: number) => (i === 0 ? largeurEchelle : largeurValeur);
  return (
    <View style={s.tableau} wrap={false}>
      <Text style={s.sousTitre}>{t.niveau}</Text>
      <View style={s.ligneEntete}>
        {t.colonnes.map((c, i) => (
          <Text key={c + i} style={[s.celluleEntete, { width: largeur(i) }]}>
            {c}
          </Text>
        ))}
      </View>
      {t.lignes.map((l) => (
        <View key={l.echelle} style={s.ligne}>
          <Text style={[s.cellule, { width: largeur(0) }]}>{l.echelle}</Text>
          {l.valeurs.map((v, i) => (
            <Text key={i} style={[s.cellule, { width: largeur(i + 1) }]}>
              {v}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

function Puces({ lignes }: { lignes: string[] }) {
  return (
    <>
      {lignes.map((p, i) => (
        <View key={i} style={s.puce}>
          <Text style={s.point}>•</Text>
          <Text style={{ flex: 1 }}>{p}</Text>
        </View>
      ))}
    </>
  );
}

export async function pdfRapport(c: ContenuPdfRapport) {
  enregistrerPolices();
  const pied = (
    <>
      <Text style={s.piedTexte} fixed>
        {c.pied}
      </Text>
      <Text style={s.pagination} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
      <View style={s.vague} fixed>
        <Vague largeur={LARGEUR_PAGE} hauteur={50} />
      </View>
    </>
  );
  return renderToBuffer(
    <Document title={`${c.titre} — ${c.reference}`} author="Institut Mindset en Action">
      {/* Page de garde */}
      <Page size="A4" style={s.page}>
        <View style={s.entete}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- Image de react-pdf, pas une balise HTML */}
          <Image src={logoIma()} style={s.logo} />
          <Text style={s.marque}>{c.marque}</Text>
        </View>
        <Text style={s.titre}>{c.titre}</Text>
        <View style={s.filet} />
        <Text style={s.entreprise}>{c.entreprise}</Text>
        <Text style={s.meta}>{c.reference}</Text>
        <Text style={s.meta}>{c.periode}</Text>
        <Text style={s.meta}>{c.validation}</Text>
        {c.brouillon && <Text style={s.brouillon}>{c.brouillon}</Text>}
        <View style={s.encadre}>
          <Text style={s.mention}>{c.mention}</Text>
          <Text>{c.anonymat}</Text>
        </View>
        <View style={s.section}>
          <Puces lignes={c.participation} />
        </View>
        {pied}
      </Page>

      {/* Analyse */}
      <Page size="A4" style={s.page}>
        {c.sections.map((sec) => (
          <View key={sec.titre} style={s.section}>
            <Text style={s.titreSection}>{sec.titre}</Text>
            {sec.paragraphes?.map((p, i) => (
              <Text key={i} style={s.paragraphe}>
                {p}
              </Text>
            ))}
            {sec.puces &&
              (sec.numerotees ? (
                sec.puces.map((p, i) => (
                  <View key={i} style={s.puce} wrap={false}>
                    <Text style={s.point}>{i + 1}.</Text>
                    <Text style={{ flex: 1 }}>{p}</Text>
                  </View>
                ))
              ) : (
                <Puces lignes={sec.puces} />
              ))}
          </View>
        ))}

        {c.cartographie.niveaux.length > 0 && (
        <View style={s.section}>
          <Text style={s.titreSection}>{c.cartographie.titre}</Text>
          {c.cartographie.niveaux.map((n) => (
            <View key={n.niveau}>
              <Text style={s.sousTitre}>{n.niveau}</Text>
              {n.constats.map((k, i) => (
                <View key={i} style={s.constat} wrap={false}>
                  <Text>{k.texte}</Text>
                  <Text style={s.detail}>{k.detail}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>
        )}
        {pied}
      </Page>

      {/* Résultats chiffrés et sources */}
      <Page size="A4" style={s.page}>
        <Text style={s.titreSection}>{c.resultats.titre}</Text>
        <Text style={s.note}>{c.resultats.lecture}</Text>
        <Text style={s.note}>{c.resultats.legende}</Text>
        {c.resultats.questionnaires.map((q) => (
          <View key={q.titre} style={s.section}>
            <Text style={[s.titreSection, { fontSize: 11.5 }]}>{q.titre}</Text>
            {q.tableaux.map((t) => (
              <Tableau key={t.niveau} t={t} />
            ))}
          </View>
        ))}
        <View style={s.section} wrap={false}>
          <Text style={s.titreSection}>{c.sources.titre}</Text>
          {c.sources.lignes.map((l, i) => (
            <Text key={i} style={[s.paragraphe, { fontSize: 8.5 }]}>
              {l}
            </Text>
          ))}
        </View>
        {pied}
      </Page>
    </Document>,
  );
}
