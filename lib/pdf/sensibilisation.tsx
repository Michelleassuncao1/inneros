// PDF du kit de sensibilisation (module B2), à la charte IMA : affiche A4 et fiche d'animation du
// « quart d'heure bien-être ». Les personnes de soutien et les numéros d'aide sont toujours ajoutés.
import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { Kit } from "../sensibilisation/contenu";
import type { RessourcesAide } from "../sensibilisation/calendrier";
import { traducteur } from "../traduction";
import { COULEURS, enregistrerPolices, logoIma, SERIF, Vague } from "./commun";

const LARGEUR = 595.28;

const s = StyleSheet.create({
  page: { paddingTop: 48, paddingHorizontal: 48, paddingBottom: 90, fontFamily: "Figtree", fontSize: 10.5, color: COULEURS.ink, lineHeight: 1.45 },
  entete: { flexDirection: "row", alignItems: "center", marginBottom: 24 },
  logo: { width: 44, height: 44, marginRight: 10 },
  marque: { fontSize: 8, fontWeight: 700, color: COULEURS.goldText, letterSpacing: 1.2 },
  titreAffiche: { fontFamily: SERIF, fontSize: 40, color: COULEURS.navy, lineHeight: 1.15, marginTop: 40 },
  filet: { width: 64, height: 3, backgroundColor: COULEURS.gold, marginVertical: 20 },
  texteAffiche: { fontSize: 18, lineHeight: 1.5 },
  titre: { fontFamily: SERIF, fontSize: 22, color: COULEURS.navy, lineHeight: 1.2 },
  sousTitre: { fontWeight: 700, color: COULEURS.navy, marginTop: 14, marginBottom: 4, fontSize: 12 },
  meta: { color: COULEURS.muted, marginTop: 4 },
  ligne: { flexDirection: "row", marginBottom: 4 },
  numero: { width: 18, color: COULEURS.goldText, fontWeight: 700 },
  aide: { marginTop: 24, padding: 12, backgroundColor: COULEURS.cream, borderLeftWidth: 3, borderLeftColor: COULEURS.gold },
  aideTitre: { fontWeight: 700, color: COULEURS.navy, marginBottom: 4 },
  aideLigne: { fontSize: 9.5, marginBottom: 2 },
  vague: { position: "absolute", left: 0, right: 0, bottom: 0 },
});

function Aide({ aide, langue, grand = false }: { aide: RessourcesAide; langue: string; grand?: boolean }) {
  const t = traducteur(langue, "Calendrier");
  const taille = grand ? { fontSize: 12 } : {};
  return (
    <View style={s.aide} wrap={false}>
      <Text style={[s.aideTitre, taille]}>{t("helpTitle")}</Text>
      {aide.contacts.map((c, i) => (
        <Text key={i} style={[s.aideLigne, taille]}>
          {c.role}
          {c.nom ? ` — ${c.nom}` : ""}
          {[c.telephone, c.email].filter(Boolean).length ? ` : ${[c.telephone, c.email].filter(Boolean).join(" · ")}` : ""}
        </Text>
      ))}
      {aide.aides.map((a) => (
        <Text key={a.numero} style={[s.aideLigne, taille]}>
          {a.numero} — {a.libelle}
        </Text>
      ))}
    </View>
  );
}

function Entete() {
  return (
    <View style={s.entete}>
      {/* eslint-disable-next-line jsx-a11y/alt-text -- Image de react-pdf, pas une balise HTML */}
      <Image src={logoIma()} style={s.logo} />
      <Text style={s.marque}>INSTITUT MINDSET EN ACTION®</Text>
    </View>
  );
}

const pied = (
  <View style={s.vague} fixed>
    <Vague largeur={LARGEUR} hauteur={50} />
  </View>
);

export async function pdfAffiche(kit: Kit, aide: RessourcesAide, langue: string) {
  enregistrerPolices();
  return renderToBuffer(
    <Document title={kit.affiche.titre} author="Institut Mindset en Action">
      <Page size="A4" style={s.page}>
        <Entete />
        <Text style={s.titreAffiche}>{kit.affiche.titre}</Text>
        <View style={s.filet} />
        <Text style={s.texteAffiche}>{kit.affiche.texte}</Text>
        <View style={{ marginTop: 36 }}>
          <Aide aide={aide} langue={langue} grand />
        </View>
        {pied}
      </Page>
    </Document>,
  );
}

export async function pdfFicheAnimation(kit: Kit, aide: RessourcesAide, langue: string) {
  enregistrerPolices();
  const t = traducteur(langue, "Calendrier");
  return renderToBuffer(
    <Document title={`${t("ficheTitle")} — ${kit.titre}`} author="Institut Mindset en Action">
      <Page size="A4" style={s.page}>
        <Entete />
        <Text style={s.titre}>{kit.titre}</Text>
        <Text style={s.meta}>{t("ficheMeta", { minutes: kit.fiche_animation.duree_minutes })}</Text>
        <View style={s.filet} />
        <Text>{kit.objectif}</Text>
        <Text style={s.sousTitre}>{t("ficheSteps")}</Text>
        {kit.fiche_animation.deroule.map((d, i) => (
          <View key={i} style={s.ligne} wrap={false}>
            <Text style={s.numero}>{i + 1}.</Text>
            <Text style={{ flex: 1 }}>{d}</Text>
          </View>
        ))}
        <Text style={s.sousTitre}>{t("ficheQuestions")}</Text>
        {kit.questions.map((q, i) => (
          <View key={i} style={s.ligne} wrap={false}>
            <Text style={s.numero}>•</Text>
            <Text style={{ flex: 1 }}>{q}</Text>
          </View>
        ))}
        <Text style={s.sousTitre}>{t("ficheTips")}</Text>
        {kit.fiche_animation.conseils.map((c, i) => (
          <View key={i} style={s.ligne} wrap={false}>
            <Text style={s.numero}>•</Text>
            <Text style={{ flex: 1 }}>{c}</Text>
          </View>
        ))}
        <Aide aide={aide} langue={langue} />
        {pied}
      </Page>
    </Document>,
  );
}
