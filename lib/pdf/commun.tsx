// Éléments communs des PDF InnerOS, à la charte IMA (polices, couleurs, vague, logo).
import { readFileSync } from "node:fs";
import path from "node:path";
import { Font, Path, Svg } from "@react-pdf/renderer";

// Couleurs de design/tokens.css (les PDF ne lisent pas le CSS)
export const COULEURS = {
  navy: "#08275A",
  navyDeep: "#051A3F",
  gold: "#C7952C",
  goldText: "#8A651F",
  cream: "#F3EBDD",
  ink: "#1C1C1A",
  muted: "#5A5A5A",
  line: "#E4DACA",
};

// Figtree (police du site IMA, licence libre) ; titres en serif intégrée proche de Georgia
const dossierPolices = path.join(process.cwd(), "node_modules/@fontsource/figtree/files");
let enregistrees = false;
export function enregistrerPolices() {
  if (enregistrees) return;
  Font.register({
    family: "Figtree",
    fonts: [
      { src: path.join(dossierPolices, "figtree-latin-400-normal.woff"), fontWeight: 400 },
      { src: path.join(dossierPolices, "figtree-latin-600-normal.woff"), fontWeight: 600 },
      { src: path.join(dossierPolices, "figtree-latin-700-normal.woff"), fontWeight: 700 },
    ],
  });
  Font.registerHyphenationCallback((mot) => [mot]); // pas de césure automatique
  enregistrees = true;
}

export const SERIF = "Times-Bold";
// Fichier lu en mémoire : sous Windows, un chemin « C:… » serait pris pour une adresse web
let logo: { data: Buffer; format: "png" } | undefined;
export function logoIma() {
  logo ??= { data: readFileSync(path.join(process.cwd(), "assets/logo-ima.png")), format: "png" };
  return logo;
}

// Signature IMA : la vague bleu nuit soulignée d'un filet or, en pied de page
export function Vague({ largeur, hauteur = 46 }: { largeur: number; hauteur?: number }) {
  const h = hauteur;
  const courbe = `M0,${h * 0.55} C${largeur * 0.17},${h * 0.05} ${largeur * 0.33},${h * 0.05} ${largeur * 0.5},${h * 0.4} C${largeur * 0.67},${h * 0.75} ${largeur * 0.83},${h * 0.85} ${largeur},${h * 0.45}`;
  return (
    <Svg width={largeur} height={h} viewBox={`0 0 ${largeur} ${h}`}>
      <Path d={`${courbe} L${largeur},${h} L0,${h} Z`} fill={COULEURS.navyDeep} />
      <Path d={courbe} stroke={COULEURS.gold} strokeWidth={2} fill="none" />
    </Svg>
  );
}
