// Affiche A4 d'un atelier (module C) : titre, date, lieu et grand QR code, à afficher en salle ou à diffuser.
// Le même QR code sert à s'inscrire avant l'atelier, puis à donner un avis anonyme.
import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import QRCode from "qrcode";
import { COULEURS, enregistrerPolices, logoIma, SERIF, Vague } from "./commun";

const LARGEUR_PAGE = 595.28;

const s = StyleSheet.create({
  page: { paddingTop: 48, paddingHorizontal: 56, paddingBottom: 90, fontFamily: "Figtree", color: COULEURS.ink, alignItems: "center" },
  entete: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start" },
  logo: { width: 40, height: 40, marginRight: 10 },
  marque: { fontSize: 9, fontWeight: 700, color: COULEURS.goldText, letterSpacing: 1.2 },
  surtitre: { marginTop: 36, fontSize: 11, fontWeight: 700, color: COULEURS.goldText, letterSpacing: 1.5, textTransform: "uppercase" },
  titre: { marginTop: 8, fontFamily: SERIF, fontSize: 30, color: COULEURS.navy, textAlign: "center" },
  filet: { marginTop: 12, width: 56, height: 2, backgroundColor: COULEURS.gold },
  info: { marginTop: 10, fontSize: 13, textAlign: "center" },
  qr: { marginTop: 26, width: 230, height: 230 },
  url: { marginTop: 8, fontSize: 9, color: COULEURS.navy, fontWeight: 600 },
  consigne: { marginTop: 18, fontSize: 12, textAlign: "center", lineHeight: 1.4 },
  pied: { position: "absolute", left: 0, right: 0, bottom: 0 },
});

export async function pdfAfficheAtelier(d: {
  titre: string;
  surtitre: string;
  entreprise: string;
  quand: string;
  lieu: string;
  lien: string;
  avant: string;
  apres: string;
}) {
  enregistrerPolices();
  const qr = await QRCode.toDataURL(d.lien, { margin: 0, width: 600, color: { dark: COULEURS.navy, light: "#FFFFFF" } });
  return renderToBuffer(
    <Document title={d.titre} author="Institut Mindset en Action">
      <Page size="A4" style={s.page}>
        <View style={s.entete}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- Image de react-pdf, pas une balise HTML */}
          <Image src={logoIma()} style={s.logo} />
          <Text style={s.marque}>INSTITUT MINDSET EN ACTION®</Text>
        </View>
        <Text style={s.surtitre}>{d.surtitre}</Text>
        <Text style={s.titre}>{d.titre}</Text>
        <View style={s.filet} />
        <Text style={[s.info, { marginTop: 16, fontWeight: 600, color: COULEURS.navy }]}>{d.entreprise}</Text>
        <Text style={s.info}>{d.quand}</Text>
        <Text style={s.info}>{d.lieu}</Text>
        {/* eslint-disable-next-line jsx-a11y/alt-text -- Image de react-pdf, pas une balise HTML */}
        <Image src={qr} style={s.qr} />
        <Text style={s.url}>{d.lien.replace(/^https?:\/\//, "")}</Text>
        <Text style={s.consigne}>{d.avant}</Text>
        <Text style={[s.consigne, { marginTop: 6 }]}>{d.apres}</Text>
        <View style={s.pied} fixed>
          <Vague largeur={LARGEUR_PAGE} />
        </View>
      </Page>
    </Document>,
  );
}
