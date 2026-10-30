// Bibliothèque de modèles vierges (module D1, décisions de Michelle du 29 et 30/10/2026) :
// - IMA tient la bibliothèque ; un modèle n'est proposé aux entreprises qu'après validation par Michelle
//   (champ « valide », mis à jour dans ce fichier) ;
// - seul le conseiller en prévention télécharge les modèles validés du pays de son entreprise ;
// - on télécharge un document vierge : aucun modèle rempli n'est jamais enregistré dans InnerOS ;
// - formulaires officiels : contenu inchangé, mis aux couleurs d'IMA par scripts/modeles/personnaliser_spf.py,
//   avec un cadre pour le logo de l'entreprise et la source citée (conditions d'utilisation du SPF).
import { readFile } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { journaliser } from "../audit";
import { organizations, type users } from "../db/schema";
import type { Db } from "../db/types";

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
  source?: { libelle: string; url: string };
  valide: boolean;
};

const URL_SIPP = "https://emploi.belgique.be/fr/themes/bien-etre-au-travail/structures-organisationnelles/service-interne-pour-la-prevention-et-0";
const SOURCE_SIPP = { libelle: "SPF Emploi, Travail et Concertation sociale, exercice 2025", url: URL_SIPP };

export const CATALOGUE: readonly Modele[] = [
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

export async function telechargerModele(db: Db, u: Utilisateur, id: string, catalogue: readonly Modele[] = CATALOGUE) {
  const m = (await modelesVisibles(db, u, catalogue)).find((x) => x.id === id);
  if (!m) return null;
  const contenu = await readFile(path.join(DOSSIER, m.fichier));
  await journaliser(db, {
    actorUserId: u.id,
    action: "template_downloaded",
    ...(u.organizationId ? { targetType: "organization", targetId: u.organizationId } : {}),
    details: { modele: m.id },
  });
  return { modele: m, contenu, nom: path.basename(m.fichier), type: TYPES_MIME[m.format] };
}
