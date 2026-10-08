// Kit d'information (F13) pour les travailleurs et leurs représentants, à la charte IMA.
// Contenu adapté au pays de l'entreprise (cadre légal, numéros d'aide) ; textes fournis par next-intl.
import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { COULEURS, enregistrerPolices, logoIma, SERIF, Vague } from "./commun";

export type ContenuKit = {
  marque: string;
  titre: string;
  sousTitre: string;
  periode: string;
  versionDeTravail?: string;
  sections: { titre: string; paragraphes?: string[]; puces?: string[]; aValider?: string }[];
  aides: { titre: string; intro: string; numeros: { numero: string; libelle: string }[] };
  contact: string;
};

const LARGEUR_PAGE = 595.28;

const s = StyleSheet.create({
  page: { paddingTop: 40, paddingHorizontal: 48, paddingBottom: 80, fontFamily: "Figtree", fontSize: 10, color: COULEURS.ink, lineHeight: 1.45 },
  entete: { flexDirection: "row", alignItems: "center", marginBottom: 18 },
  logo: { width: 48, height: 48, marginRight: 12 },
  marque: { fontSize: 8, fontWeight: 700, color: COULEURS.goldText, letterSpacing: 1.2 },
  titre: { fontFamily: SERIF, fontSize: 18, color: COULEURS.navy, lineHeight: 1.2 },
  filet: { width: 48, height: 2, backgroundColor: COULEURS.gold, marginVertical: 10 },
  sousTitre: { fontSize: 11, color: COULEURS.navy, fontWeight: 600 },
  periode: { fontSize: 9.5, color: COULEURS.muted, marginTop: 2 },
  travail: { marginTop: 10, padding: 8, backgroundColor: COULEURS.cream, color: COULEURS.goldText, fontSize: 9, fontWeight: 700 },
  section: { marginTop: 14 },
  titreSection: { fontFamily: SERIF, fontSize: 12.5, color: COULEURS.navy, marginBottom: 4 },
  paragraphe: { marginBottom: 4 },
  puce: { flexDirection: "row", marginBottom: 2 },
  point: { width: 10, color: COULEURS.gold, fontWeight: 700 },
  aValider: { fontSize: 8.5, color: COULEURS.goldText, fontWeight: 700, marginTop: 2 },
  encadre: { marginTop: 16, padding: 12, backgroundColor: COULEURS.cream, borderLeftWidth: 3, borderLeftColor: COULEURS.gold },
  numero: { flexDirection: "row", marginTop: 3 },
  chiffres: { width: 92, fontWeight: 700, color: COULEURS.navy },
  contact: { marginTop: 16, fontSize: 9, color: COULEURS.muted },
  pied: { position: "absolute", left: 0, right: 0, bottom: 0 },
  pagination: { position: "absolute", bottom: 52, right: 48, fontSize: 8, color: COULEURS.muted },
});

export async function pdfKit(contenu: ContenuKit) {
  enregistrerPolices();
  return renderToBuffer(
    <Document title={contenu.titre} author="Institut Mindset en Action">
      <Page size="A4" style={s.page}>
        <View style={s.entete}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- Image de react-pdf, pas une balise HTML */}
          <Image src={logoIma()} style={s.logo} />
          <Text style={s.marque}>{contenu.marque}</Text>
        </View>
        <Text style={s.titre}>{contenu.titre}</Text>
        <View style={s.filet} />
        <Text style={s.sousTitre}>{contenu.sousTitre}</Text>
        <Text style={s.periode}>{contenu.periode}</Text>
        {contenu.versionDeTravail && <Text style={s.travail}>{contenu.versionDeTravail}</Text>}

        {contenu.sections.map((section) => (
          <View key={section.titre} style={s.section} wrap={false}>
            <Text style={s.titreSection}>{section.titre}</Text>
            {section.paragraphes?.map((p) => (
              <Text key={p} style={s.paragraphe}>
                {p}
              </Text>
            ))}
            {section.puces?.map((p) => (
              <View key={p} style={s.puce}>
                <Text style={s.point}>•</Text>
                <Text style={{ flex: 1 }}>{p}</Text>
              </View>
            ))}
            {section.aValider && <Text style={s.aValider}>{section.aValider}</Text>}
          </View>
        ))}

        <View style={s.encadre} wrap={false}>
          <Text style={s.titreSection}>{contenu.aides.titre}</Text>
          <Text style={s.paragraphe}>{contenu.aides.intro}</Text>
          {contenu.aides.numeros.map((n) => (
            <View key={n.numero} style={s.numero}>
              <Text style={s.chiffres}>{n.numero}</Text>
              <Text style={{ flex: 1 }}>{n.libelle}</Text>
            </View>
          ))}
        </View>

        <Text style={s.contact}>{contenu.contact}</Text>
        <Text style={s.pagination} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
        <View style={s.pied} fixed>
          <Vague largeur={LARGEUR_PAGE} hauteur={50} />
        </View>
      </Page>
    </Document>,
  );
}
