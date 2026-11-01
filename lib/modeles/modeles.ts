// Bibliothèque de modèles vierges (module D1, décisions de Michelle du 29 et 30/10/2026) :
// - IMA tient la bibliothèque ; un modèle n'est proposé aux entreprises qu'après validation par Michelle
//   (champ « valide », mis à jour dans ce fichier) ;
// - seul le conseiller en prévention télécharge les modèles validés du pays de son entreprise ;
// - on télécharge un document vierge : aucun modèle rempli n'est jamais enregistré dans InnerOS ;
// - formulaires officiels : contenu inchangé, mis aux couleurs d'IMA par scripts/modeles/personnaliser_spf.py,
//   avec un cadre pour le logo de l'entreprise et la source citée (conditions d'utilisation du SPF) ;
// - modèles rédigés par IMA (lib/modeles/contenu-ima.ts) : produits en Word et en PDF par npm run modeles:ima.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { journaliser } from "../audit";
import { organizations, type users } from "../db/schema";
import type { Db } from "../db/types";
import { MODELES_IMA } from "./contenu-ima";

type Utilisateur = typeof users.$inferSelect;

export const CATEGORIES_MODELE = ["rapport_annuel", "plan", "reunion", "sensibilisation", "atelier", "psychosocial"] as const;

export type Modele = {
  id: string;
  pays: "BE" | "FR" | "BR" | "PT";
  langue: "fr" | "nl" | "en" | "pt-BR";
  categorie: (typeof CATEGORIES_MODELE)[number];
  titre: string; // dans la langue du document
  description: string;
  fichier: string; // chemin sous data/modeles/fichiers
  format: "docx" | "pdf";
  pdf?: string; // version PDF du même modèle, sous data/modeles/fichiers
  source?: { libelle: string; url: string };
  valide: boolean;
};

const URL_SIPP = "https://emploi.belgique.be/fr/themes/bien-etre-au-travail/structures-organisationnelles/service-interne-pour-la-prevention-et-0";
const SOURCE_SIPP = { libelle: "SPF Emploi, Travail et Concertation sociale, exercice 2025", url: URL_SIPP };
const SOURCE_IDPB = {
  libelle: "FOD Werkgelegenheid, Arbeid en Sociaal Overleg, dienstjaar 2025",
  url: "https://werk.belgie.be/nl/themas/welzijn-op-het-werk/organisatorische-structuren/interne-dienst-voor-preventie-en-0",
};

const OFFICIELS: readonly Modele[] = [
  {
    id: "be-fr-rapport-annuel-sipp-2025-a",
    pays: "BE",
    langue: "fr",
    categorie: "rapport_annuel",
    titre: "Rapport annuel du SIPP 2025 — formulaire A",
    description: "Employeur ayant un service interne de prévention et de protection au travail sans sections (cas le plus fréquent).",
    fichier: "BE/fr/rapport-annuel-sipp-2025-A.docx",
    format: "docx",
    source: SOURCE_SIPP,
    valide: false,
  },
  {
    id: "be-fr-rapport-annuel-sipp-2025-b",
    pays: "BE",
    langue: "fr",
    categorie: "rapport_annuel",
    titre: "Rapport annuel du SIPP 2025 — formulaire B",
    description: "Employeur ayant un service interne de prévention et de protection au travail avec sections.",
    fichier: "BE/fr/rapport-annuel-sipp-2025-B.docx",
    format: "docx",
    source: SOURCE_SIPP,
    valide: false,
  },
  {
    id: "be-fr-rapport-annuel-sipp-2025-c",
    pays: "BE",
    langue: "fr",
    categorie: "rapport_annuel",
    titre: "Rapport annuel du SIPP 2025 — formulaire C",
    description: "Groupe d'employeurs organisant un service commun de prévention et de protection au travail.",
    fichier: "BE/fr/rapport-annuel-sipp-2025-C.docx",
    format: "docx",
    source: SOURCE_SIPP,
    valide: false,
  },
  {
    id: "be-fr-rapport-annuel-sipp-2025-notice",
    pays: "BE",
    langue: "fr",
    categorie: "rapport_annuel",
    titre: "Rapport annuel du SIPP 2025 — notice explicative",
    description: "Explication de chaque rubrique des formulaires A, B et C (document officiel du SPF, non modifié).",
    fichier: "BE/fr/rapport-annuel-sipp-2025-notice.pdf",
    format: "pdf",
    source: SOURCE_SIPP,
    valide: false,
  },
  {
    id: "be-nl-jaarverslag-idpb-2025-a",
    pays: "BE",
    langue: "nl",
    categorie: "rapport_annuel",
    titre: "Jaarverslag IDPB 2025 — formulier A",
    description: "Werkgever met een interne dienst voor preventie en bescherming op het werk zonder afdelingen (meest voorkomend geval).",
    fichier: "BE/nl/jaarverslag-idpb-2025-A.docx",
    format: "docx",
    source: SOURCE_IDPB,
    valide: false,
  },
  {
    id: "be-nl-jaarverslag-idpb-2025-b",
    pays: "BE",
    langue: "nl",
    categorie: "rapport_annuel",
    titre: "Jaarverslag IDPB 2025 — formulier B",
    description: "Werkgever met een interne dienst voor preventie en bescherming op het werk met afdelingen.",
    fichier: "BE/nl/jaarverslag-idpb-2025-B.docx",
    format: "docx",
    source: SOURCE_IDPB,
    valide: false,
  },
  {
    id: "be-nl-jaarverslag-idpb-2025-c",
    pays: "BE",
    langue: "nl",
    categorie: "rapport_annuel",
    titre: "Jaarverslag IDPB 2025 — formulier C",
    description: "Groep van werkgevers die een gemeenschappelijke dienst voor preventie en bescherming op het werk organiseren.",
    fichier: "BE/nl/jaarverslag-idpb-2025-C.docx",
    format: "docx",
    source: SOURCE_IDPB,
    valide: false,
  },
  {
    id: "be-nl-jaarverslag-idpb-2025-nota",
    pays: "BE",
    langue: "nl",
    categorie: "rapport_annuel",
    titre: "Jaarverslag IDPB 2025 — verklarende nota",
    description: "Toelichting bij elke rubriek van de formulieren A, B en C (officieel document van de FOD, niet gewijzigd).",
    fichier: "BE/nl/jaarverslag-idpb-2025-verklarende-nota.pdf",
    format: "pdf",
    source: SOURCE_IDPB,
    valide: false,
  },
];

export const CATALOGUE: readonly Modele[] = [
  ...OFFICIELS,
  ...MODELES_IMA.map((m) => ({
    id: m.id,
    pays: m.pays,
    langue: m.langue,
    categorie: m.categorie,
    titre: m.titre,
    description: m.description,
    fichier: `${m.pays}/${m.langue}/${m.id}.docx`,
    format: "docx" as const,
    pdf: `${m.pays}/${m.langue}/${m.id}.pdf`,
    valide: m.valide,
  })),
];

export const TYPES_MIME = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf: "application/pdf",
} as const;

async function paysDe(db: Db, organizationId: string | null) {
  if (!organizationId) return null;
  const [o] = await db.select({ country: organizations.country }).from(organizations).where(eq(organizations.id, organizationId));
  return o?.country ?? null;
}

// IMA voit toute la bibliothèque (modèles à valider compris) ; le conseiller en prévention, les modèles
// validés du pays de son entreprise ; les autres référents, rien.
export async function modelesVisibles(db: Db, u: Utilisateur, catalogue: readonly Modele[] = CATALOGUE) {
  if (u.disabledAt) return [];
  if (u.role === "admin") return [...catalogue];
  if (u.role !== "referent" || !u.preventionAdvisor) return [];
  const pays = await paysDe(db, u.organizationId);
  return catalogue.filter((m) => m.valide && m.pays === pays);
}

const DOSSIER = path.join(process.cwd(), "data/modeles/fichiers");

export async function telechargerModele(db: Db, u: Utilisateur, id: string, enPdf = false, catalogue: readonly Modele[] = CATALOGUE) {
  const m = (await modelesVisibles(db, u, catalogue)).find((x) => x.id === id);
  if (!m) return null;
  const fichier = enPdf && m.pdf ? m.pdf : m.fichier;
  const contenu = await readFile(path.join(DOSSIER, fichier));
  await journaliser(db, {
    actorUserId: u.id,
    action: "template_downloaded",
    ...(u.organizationId ? { targetType: "organization", targetId: u.organizationId } : {}),
    details: { modele: m.id, format: path.extname(fichier).slice(1) },
  });
  return { modele: m, contenu, nom: path.basename(fichier), type: fichier.endsWith(".pdf") ? TYPES_MIME.pdf : TYPES_MIME[m.format] };
}
