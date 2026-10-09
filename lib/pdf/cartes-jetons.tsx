// PDF des cartes de jetons à imprimer et découper : 10 cartes par page A4, à la charte IMA.
// Chaque carte : logo, code, QR code menant au questionnaire, rappel d'anonymat.
import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import QRCode from "qrcode";
import { COULEURS, enregistrerPolices, logoIma, SERIF, Vague } from "./commun";
import { normaliserCode } from "../admin/jetons";

export type TextesCartes = {
  titre: string;
  votreCode: string;
  scanner: string;
  anonymat: string;
  duree: string;
  marque: string;
};

const LARGEUR_PAGE = 595.28; // A4 en points
const MARGE = 22;
const LARGEUR_CARTE = (LARGEUR_PAGE - 2 * MARGE) / 2;
const HAUTEUR_CARTE = 146;

const s = StyleSheet.create({
  page: { paddingTop: MARGE, paddingHorizontal: MARGE, paddingBottom: 60, fontFamily: "Figtree", color: COULEURS.ink },
  grille: { flexDirection: "row", flexWrap: "wrap" },
  carte: {
    width: LARGEUR_CARTE,
    height: HAUTEUR_CARTE,
    padding: 12,
    flexDirection: "row",
    borderWidth: 0.6,
    borderStyle: "dashed",
    borderColor: COULEURS.line,
  },
  gauche: { flex: 1, paddingRight: 8, justifyContent: "space-between" },
  entete: { flexDirection: "row", alignItems: "center" },
  logo: { width: 26, height: 26, marginRight: 6 },
  marque: { fontSize: 6, fontWeight: 700, color: COULEURS.goldText, letterSpacing: 0.8 },
  titre: { fontFamily: SERIF, fontSize: 10.5, color: COULEURS.navy, marginTop: 1 },
  libelleCode: { fontSize: 7, color: COULEURS.muted, marginTop: 6 },
  code: { fontSize: 15, fontWeight: 700, color: COULEURS.navy, letterSpacing: 1.2 },
  petit: { fontSize: 6.8, color: COULEURS.ink, lineHeight: 1.3 },
  url: { fontSize: 6.5, color: COULEURS.navy, fontWeight: 600 },
  qr: { width: 86, height: 86, alignSelf: "center" },
  pied: { position: "absolute", left: 0, right: 0, bottom: 0 },
});

export async function pdfCartesJetons({
  codes,
  textes,
  urlQuestionnaire,
}: {
  codes: string[];
  textes: TextesCartes;
  urlQuestionnaire: string; // ex. https://app.institutmindsetenaction.com/fr/q
}) {
  enregistrerPolices();
  const cartes = await Promise.all(
    codes.map(async (code) => ({
      code,
      // Le code est placé après « # » : le navigateur ne l'envoie jamais au serveur
      qr: await QRCode.toDataURL(`${urlQuestionnaire}#${normaliserCode(code)}`, {
        margin: 0,
        width: 300,
        color: { dark: COULEURS.navy, light: "#FFFFFF" },
      }),
    })),
  );
  const adresse = urlQuestionnaire.replace(/^https?:\/\//, "");
  const pages = Array.from({ length: Math.ceil(cartes.length / 10) }, (_, i) => cartes.slice(i * 10, i * 10 + 10));

  return renderToBuffer(
    <Document title={textes.titre} author="Institut Mindset en Action">
      {pages.map((lot, i) => (
        <Page key={i} size="A4" style={s.page}>
          <View style={s.grille}>
            {lot.map((c) => (
              <View key={c.code} style={s.carte} wrap={false}>
                <View style={s.gauche}>
                  <View>
                    <View style={s.entete}>
                      {/* eslint-disable-next-line jsx-a11y/alt-text -- Image de react-pdf, pas une balise HTML */}
                      <Image src={logoIma()} style={s.logo} />
                      <View style={{ flex: 1 }}>
                        <Text style={s.marque}>{textes.marque}</Text>
                        <Text style={s.titre}>{textes.titre}</Text>
                      </View>
                    </View>
                    <Text style={s.libelleCode}>{textes.votreCode}</Text>
                    <Text style={s.code}>{c.code}</Text>
                  </View>
                  <View>
                    <Text style={s.petit}>{textes.scanner}</Text>
                    <Text style={s.url}>{adresse}</Text>
                    <Text style={[s.petit, { marginTop: 3 }]}>{textes.anonymat}</Text>
                    <Text style={s.petit}>{textes.duree}</Text>
                  </View>
                </View>
                {/* eslint-disable-next-line jsx-a11y/alt-text -- Image de react-pdf, pas une balise HTML */}
                <Image src={c.qr} style={s.qr} />
              </View>
            ))}
          </View>
          <View style={s.pied} fixed>
            <Vague largeur={LARGEUR_PAGE} />
          </View>
        </Page>
      ))}
    </Document>,
  );
}
