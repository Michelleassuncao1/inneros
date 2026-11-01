// Documents Word aux couleurs d'IMA (charte : bleu nuit, or, Figtree ; titres en serif) pour les modèles vierges
// (module D1). En-tête : cadre « logo de votre entreprise » à remplacer (clic droit › Modifier l'image) et
// signature IMA ; pied de page : version du modèle et références légales.
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  ImageRun,
  Packer,
  PageNumber,
  PageOrientation,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TabStopPosition,
  TabStopType,
  TextRun,
  WidthType,
} from "docx";
import type { Bloc, ModeleIma } from "./contenu-ima";
import { VERSION_MODELES_IMA } from "./contenu-ima";

const NAVY = "08275A";
const GOLD = "C7952C";
const GOLD_TEXT = "8A651F";
const MUTED = "5A5A5A";
const LINE = "E4DACA";
const CREAM = "F3EBDD";
const POLICE = "Arial"; // présente sur tous les postes (Figtree n'est pas installée chez les clients)
const SERIF = "Georgia";

const TEXTES = {
  fr: { modele: "Modèle", references: "Références", version: "version", adapter: "à adapter à votre organisation", page: "Page", deuxPoints: " :" },
  "pt-BR": { modele: "Modelo", references: "Referências", version: "versão", adapter: "a adaptar à sua organização", page: "Página", deuxPoints: ":" },
} as const;

const image = (nom: string) => readFileSync(path.join(process.cwd(), "data/modeles/images", nom));
const logoIma = () => readFileSync(path.join(process.cwd(), "assets/logo-ima.png"));

const sansBordure = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const bordures = (couleur = LINE) => {
  const b = { style: BorderStyle.SINGLE, size: 4, color: couleur };
  return { top: b, bottom: b, left: b, right: b, insideHorizontal: b, insideVertical: b };
};

function entete(langue: ModeleIma["langue"]) {
  return new Header({
    children: [
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: { top: sansBordure, bottom: sansBordure, left: sansBordure, right: sansBordure, insideHorizontal: sansBordure, insideVertical: sansBordure },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 50, type: WidthType.PERCENTAGE },
                children: [new Paragraph({ children: [new ImageRun({ type: "png", data: image(`logo-entreprise-simple-${langue}.png`), transformation: { width: 150, height: 50 } })] })],
              }),
              new TableCell({
                width: { size: 50, type: WidthType.PERCENTAGE },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    children: [
                      new TextRun({ text: "INSTITUT MINDSET EN ACTION®  ", font: POLICE, size: 15, bold: true, color: GOLD_TEXT }),
                      new ImageRun({ type: "png", data: logoIma(), transformation: { width: 40, height: 40 } }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

function pied(m: ModeleIma) {
  const t = TEXTES[m.langue];
  return new Footer({
    children: [
      new Paragraph({
        border: { top: { style: BorderStyle.SINGLE, size: 6, color: GOLD, space: 4 } },
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ text: `${t.modele} Institut Mindset en Action® · ${t.version} ${VERSION_MODELES_IMA} · ${t.adapter}`, font: POLICE, size: 14, color: MUTED }),
        ],
      }),
      ...(m.references
        ? [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${t.references}${t.deuxPoints} ${m.references}`, font: POLICE, size: 14, color: MUTED })] })]
        : []),
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [new TextRun({ children: [`${t.page} `, PageNumber.CURRENT], font: POLICE, size: 16, color: NAVY })],
      }),
    ],
  });
}

// Lignes d'écriture : un tableau sans bordures verticales (des paragraphes bordés seraient fusionnés par Word)
function lignesVides(nombre: number) {
  const trait = { style: BorderStyle.SINGLE, size: 4, color: LINE };
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: sansBordure, left: sansBordure, right: sansBordure, bottom: trait, insideHorizontal: trait, insideVertical: sansBordure },
    rows: Array.from({ length: nombre }, () => new TableRow({ height: { value: 400, rule: "exact" }, children: [new TableCell({ width: { size: 100, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [] })] })] })),
  });
}

function bloc(b: Bloc, deuxPoints: string): (Paragraph | Table)[] {
  switch (b.type) {
    case "titre":
      return [new Paragraph({ spacing: { before: 320, after: 120 }, children: [new TextRun({ text: b.texte, font: SERIF, size: 26, bold: true, color: NAVY })] })];
    case "texte":
      return [new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: b.texte, font: POLICE, size: b.discret ? 18 : 20, italics: b.discret, color: b.discret ? MUTED : undefined })] })];
    case "champs":
      // Pointillés jusqu'à la marge droite (tabulation avec points de suite)
      return b.libelles.map(
        (l) =>
          new Paragraph({
            spacing: { before: 200 },
            tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX, leader: "dot" }],
            children: [new TextRun({ text: `${l}${deuxPoints}`, font: POLICE, size: 20, bold: true, color: NAVY }), new TextRun({ text: "\t", font: POLICE, size: 20, color: MUTED })],
          }),
      );
    case "lignes":
      return [lignesVides(b.nombre)];
    case "cases":
      return b.options.map((o) => new Paragraph({ spacing: { before: 80 }, children: [new TextRun({ text: `☐  ${o}`, font: POLICE, size: 20 })] }));
    case "tableau": {
      const largeurs = b.largeurs ?? b.colonnes.map(() => Math.floor(100 / b.colonnes.length));
      const cellule = (texte: string, i: number, entete: boolean) =>
        new TableCell({
          width: { size: largeurs[i], type: WidthType.PERCENTAGE },
          shading: entete ? { type: ShadingType.CLEAR, fill: CREAM, color: "auto" } : undefined,
          margins: { top: 60, bottom: 60, left: 80, right: 80 },
          children: [new Paragraph({ children: [new TextRun({ text: texte, font: POLICE, size: 18, bold: entete, color: entete ? NAVY : undefined })] })],
        });
      return [
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: bordures(),
          rows: [
            new TableRow({ tableHeader: true, children: b.colonnes.map((c, i) => cellule(c, i, true)) }),
            ...Array.from({ length: b.lignes }, () => new TableRow({ height: { value: 480, rule: "atLeast" }, children: b.colonnes.map((_, i) => cellule("", i, false)) })),
          ],
        }),
      ];
    }
    case "signatures":
      return [
        new Paragraph({ spacing: { before: 480 }, children: [] }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: { top: sansBordure, bottom: sansBordure, left: sansBordure, right: sansBordure, insideHorizontal: sansBordure, insideVertical: sansBordure },
          rows: [
            new TableRow({
              children: b.libelles.map(
                (l) =>
                  new TableCell({
                    width: { size: Math.floor(100 / b.libelles.length), type: WidthType.PERCENTAGE },
                    children: [
                      new Paragraph({ children: [new TextRun({ text: l, font: POLICE, size: 18, color: MUTED })] }),
                      new Paragraph({ spacing: { before: 720 }, border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: MUTED, space: 1 } }, children: [] }),
                    ],
                  }),
              ),
            }),
          ],
        }),
      ];
  }
}

export function documentModele(m: ModeleIma) {
  return new Document({
    creator: "Institut Mindset en Action",
    title: m.titre,
    description: m.description,
    styles: { default: { document: { run: { font: POLICE, size: 20 } } } },
    sections: [
      {
        properties: {
          page: {
            size: { orientation: m.paysage ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT },
            margin: { top: 1300, bottom: 1300, left: 1000, right: 1000, header: 500, footer: 500 },
          },
        },
        headers: { default: entete(m.langue) },
        footers: { default: pied(m) },
        children: [
          new Paragraph({ children: [new TextRun({ text: m.titre, font: SERIF, size: 40, bold: true, color: NAVY })] }),
          new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: GOLD, space: 1 } }, spacing: { after: 160 }, indent: { right: 8000 }, children: [] }),
          ...(m.confidentiel
            ? [
                new Paragraph({
                  shading: { type: ShadingType.CLEAR, fill: CREAM, color: "auto" },
                  border: { left: { style: BorderStyle.SINGLE, size: 18, color: GOLD, space: 6 } },
                  spacing: { before: 120, after: 160 },
                  children: [new TextRun({ text: m.confidentiel, font: POLICE, size: 18, bold: true, color: NAVY })],
                }),
              ]
            : []),
          new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: m.description, font: POLICE, size: 18, italics: true, color: MUTED })] }),
          ...m.blocs.flatMap((b) => bloc(b, TEXTES[m.langue].deuxPoints)),
        ],
      },
    ],
  });
}

export async function docxModele(m: ModeleIma) {
  return Packer.toBuffer(documentModele(m));
}
