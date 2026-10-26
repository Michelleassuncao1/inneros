// Certificat IMA personnalisé de la formation « IMA Talks — Utiliser l'IA dans InnerOS » (A4 paysage, charte IMA).
// Attestation pédagogique interne : la mention « pas une certification officielle AI Act » est toujours imprimée.
import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { DonneesCertificat } from "../formation/formation";
import { COULEURS, enregistrerPolices, logoIma, SERIF, Vague } from "./commun";

const LARGEUR = 841.89;

const s = StyleSheet.create({
  page: { padding: 28, fontFamily: "Figtree", fontSize: 10, color: COULEURS.ink },
  cadre: { flex: 1, borderWidth: 2, borderColor: COULEURS.gold, paddingVertical: 26, paddingHorizontal: 48, alignItems: "center" },
  logo: { width: 58, height: 58 },
  marque: { marginTop: 6, fontSize: 8, fontWeight: 700, color: COULEURS.goldText, letterSpacing: 1.4 },
  titre: { marginTop: 14, fontFamily: SERIF, fontSize: 32, color: COULEURS.navy },
  sousTitre: { marginTop: 2, fontSize: 10, color: COULEURS.muted },
  filet: { width: 70, height: 2, backgroundColor: COULEURS.gold, marginVertical: 12 },
  decerne: { fontSize: 11 },
  nom: { marginTop: 6, fontFamily: SERIF, fontSize: 28, color: COULEURS.navy },
  formation: { marginTop: 10, fontSize: 13, fontWeight: 700, color: COULEURS.navy, textAlign: "center" },
  details: { marginTop: 12, flexDirection: "row", gap: 24 },
  cle: { fontSize: 8, color: COULEURS.muted, textTransform: "uppercase", letterSpacing: 0.8 },
  valeur: { fontSize: 10.5, fontWeight: 600, color: COULEURS.navy },
  modules: { marginTop: 10, fontSize: 8.5, color: COULEURS.muted, textAlign: "center" },
  pied: { marginTop: "auto", width: "100%", flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  signature: { borderTopWidth: 1, borderTopColor: COULEURS.line, paddingTop: 4, width: 220, fontSize: 9 },
  avertissement: { marginTop: 8, fontSize: 7.5, color: COULEURS.muted, textAlign: "center" },
  vague: { position: "absolute", left: 0, right: 0, bottom: 0 },
});

const dateLongue = (d: string) => new Intl.DateTimeFormat("fr-BE", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));

function Detail({ cle, valeur }: { cle: string; valeur: string }) {
  return (
    <View>
      <Text style={s.cle}>{cle}</Text>
      <Text style={s.valeur}>{valeur}</Text>
    </View>
  );
}

export async function pdfCertificat(d: DonneesCertificat) {
  enregistrerPolices();
  return renderToBuffer(
    <Document title={`${d.titre} — ${d.nom}`} author="Institut Mindset en Action">
      <Page size="A4" orientation="landscape" style={s.page}>
        <View style={s.cadre}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- Image de react-pdf, pas une balise HTML */}
          <Image src={logoIma()} style={s.logo} />
          <Text style={s.marque}>INSTITUT MINDSET EN ACTION®</Text>
          <Text style={s.titre}>Certificat de formation</Text>
          <Text style={s.sousTitre}>{d.titre}</Text>
          <View style={s.filet} />
          <Text style={s.decerne}>décerné à</Text>
          <Text style={s.nom}>{d.nom}</Text>
          <Text style={s.formation}>
            {d.formation} — version {d.versionFormation} ({d.dureeMinutes} minutes)
          </Text>
          <View style={s.details}>
            <Detail cle="Date" valeur={dateLongue(d.date)} />
            <Detail cle="Score au quiz" valeur={`${d.score} % (seuil ${d.seuil} %)`} />
            <Detail cle="Guide interne lu" valeur={`v${d.versionGuide}, le ${dateLongue(d.guideLuLe)}`} />
            <Detail cle="N° de certificat" valeur={d.code} />
          </View>
          <Text style={[s.modules, { marginTop: 12 }]}>Formation générale déclarée : {d.formationGenerale}</Text>
          <Text style={s.modules}>Modules : {d.modules.join(" · ")}</Text>
          <View style={s.pied}>
            <Text style={s.signature}>Michelle Assunção — Institut Mindset en Action®</Text>
            <Text style={[s.signature, { textAlign: "right" }]}>Identifiant : {d.identifiant}</Text>
          </View>
          <Text style={s.avertissement}>{d.avertissement}</Text>
        </View>
        <View style={s.vague} fixed>
          <Vague largeur={LARGEUR} hauteur={36} />
        </View>
      </Page>
    </Document>,
  );
}
