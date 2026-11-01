// Aide à la rédaction (module D2, décisions de Michelle du 29/10/2026, avis de l'agent juridique du même jour) :
// - réservée au conseiller en prévention et à IMA ; 10 brouillons par personne et par jour ;
// - des notes brutes sans donnée personnelle (filtre e-mails, téléphones, numéros d'identification, IBAN, et
//   engagement de la personne) deviennent un brouillon, relu, corrigé et approuvé avant téléchargement en Word ;
// - rien n'est conservé : ni les notes ni le brouillon ; le journal garde le type, la langue et le nombre de jetons ;
// - exclus : entretien individuel et demande d'intervention psychosociale (aucun type ne les propose) ;
// - interrupteur : AI_WRITING_AID_ENABLED=true (coupé par défaut, jusqu'à la signature du DPA d'Anthropic) ;
//   Brésil : AI_WRITING_AID_BRAZIL=true seulement quand les clauses-types de l'ANPD sont en place.
import path from "node:path";
import { and, count, eq, gte } from "drizzle-orm";
import { z } from "zod";
import { journaliser } from "../audit";
import { auditLog, organizations, users } from "../db/schema";
import type { Db } from "../db/types";
import { appelStructure, type ResultatStructure } from "../rapport/ia";
import { iaActiveGlobalement, type Resultat } from "../rapport/rapports";
import { LIMITE_PAR_JOUR, LONGUEUR_NOTES, TYPES_REDACTION, type TypeRedaction } from "./constantes";

type Utilisateur = typeof users.$inferSelect;

export { LIMITE_PAR_JOUR, LONGUEUR_NOTES, TYPES_REDACTION, type TypeRedaction };
export const FICHIER_PROMPT_REDACTION = path.join(process.cwd(), "prompts", "aide-redaction.system.md");

export const schemaBrouillon = z.object({
  titre: z.string().min(1).max(200),
  sections: z
    .array(z.object({ titre: z.string().min(1).max(200), paragraphes: z.array(z.string().min(1).max(3000)).min(1).max(8) }))
    .min(1)
    .max(12),
  a_completer: z.array(z.string().max(300)).max(30),
});
export type Brouillon = z.infer<typeof schemaBrouillon>;

export type AppelRedaction = (donnees: { type: TypeRedaction; langue: string; pays: string; notes: string }) => Promise<ResultatStructure<Brouillon>>;
export const appelRedaction: AppelRedaction = (donnees) => appelStructure(FICHIER_PROMPT_REDACTION, schemaBrouillon, donnees);

// Coordonnées et identifiants : e-mail, téléphone ou numéro long (registre national, CPF…), IBAN
export function contientCoordonnees(texte: string) {
  return /[^\s@]+@[^\s@]+\.[^\s@]+/.test(texte) || /(\+?\d[\s./-]?){8,}/.test(texte) || /\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){3,}/i.test(texte);
}

export function peutUtiliserAide(u: Utilisateur) {
  if (u.disabledAt) return false;
  return u.role === "admin" || (u.role === "referent" && u.preventionAdvisor);
}

export const aideActivee = () => process.env.AI_WRITING_AID_ENABLED === "true" && iaActiveGlobalement();

async function paysDe(db: Db, u: Utilisateur) {
  if (!u.organizationId) return "BE"; // IMA
  const [o] = await db.select({ country: organizations.country }).from(organizations).where(eq(organizations.id, u.organizationId));
  return o?.country ?? "BE";
}

const debutDuJour = (maintenant: Date) => new Date(Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth(), maintenant.getUTCDate()));

export async function utilisationsDuJour(db: Db, u: Utilisateur, maintenant = new Date()) {
  const [r] = await db
    .select({ n: count() })
    .from(auditLog)
    .where(and(eq(auditLog.actorUserId, u.id), eq(auditLog.action, "ai_writing_aid_used"), gte(auditLog.at, debutDuJour(maintenant))));
  return r.n;
}

export const schemaDemande = z.object({
  type: z.enum(TYPES_REDACTION),
  langue: z.enum(["fr", "nl", "en", "pt-BR"]),
  notes: z.string().trim().min(30).max(LONGUEUR_NOTES),
  sansDonneesPersonnelles: z.literal(true),
});

export async function preparerBrouillon(
  db: Db,
  u: Utilisateur,
  saisie: unknown,
  appel: AppelRedaction = appelRedaction,
  maintenant = new Date(),
): Promise<Resultat<Brouillon>> {
  if (!peutUtiliserAide(u)) return { ok: false, erreur: "introuvable" };
  if (!aideActivee()) return { ok: false, erreur: "redactionDesactivee" };
  const pays = await paysDe(db, u);
  if (pays === "BR" && process.env.AI_WRITING_AID_BRAZIL !== "true") return { ok: false, erreur: "redactionPaysNonDisponible" };
  const s = schemaDemande.safeParse(saisie);
  if (!s.success) return { ok: false, erreur: s.error.issues.some((i) => i.path[0] === "sansDonneesPersonnelles") ? "redactionEngagementRequis" : "saisieInvalide" };
  if (contientCoordonnees(s.data.notes)) return { ok: false, erreur: "redactionDonneesPersonnelles" };
  if ((await utilisationsDuJour(db, u, maintenant)) >= LIMITE_PAR_JOUR) return { ok: false, erreur: "redactionLimiteAtteinte" };

  const r = await appel({ type: s.data.type, langue: s.data.langue, pays, notes: s.data.notes });
  if (!r.ok) return { ok: false, erreur: r.erreur };
  // Le journal compte les utilisations (limite par jour) ; il ne contient ni les notes ni le brouillon
  await journaliser(db, {
    actorUserId: u.id,
    action: "ai_writing_aid_used",
    ...(u.organizationId ? { targetType: "organization", targetId: u.organizationId } : {}),
    details: { type: s.data.type, langue: s.data.langue, modele: r.modele, prompt: r.versionPrompt, jetonsEntree: r.jetonsEntree, jetonsSortie: r.jetonsSortie },
  });
  return { ok: true, valeur: r.contenu };
}

// Document approuvé, à télécharger : le texte vient du navigateur (relu et corrigé) et n'est pas conservé
export const schemaExport = z.object({
  type: z.enum(TYPES_REDACTION),
  langue: z.enum(["fr", "nl", "en", "pt-BR"]),
  titre: z.string().trim().min(1).max(200),
  sections: z.array(z.object({ titre: z.string().trim().max(200), texte: z.string().trim().max(12000) })).min(1).max(12),
  approuve: z.literal(true),
});
export type ExportBrouillon = z.infer<typeof schemaExport>;
