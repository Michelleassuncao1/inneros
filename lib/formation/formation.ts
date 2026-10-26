// Formation « IMA Talks — Utiliser l'IA dans InnerOS » (article 4 AI Act, décision de Michelle du 26/10/2026).
// Contenu fourni par IMA dans data/formation/ (jamais rédigé par le code). Parcours :
// modules → accusé de lecture du guide interne → quiz (seuil de réussite, tentatives illimitées, corrigé côté
// serveur) → enregistrement de la formation (date + formation générale déclarée) → certificat IMA.
// L'enregistrement remplit users.ai_literacy_at, qui débloque la validation des rapports, plans et thèmes.
// Seul le meilleur score est conservé, jamais les réponses ; chaque étape est journalisée.
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { journaliser } from "../audit";
import { aiTrainingProgress, users } from "../db/schema";
import type { Db } from "../db/types";
import { enregistrerFormationIA, type Resultat } from "../rapport/rapports";

type Utilisateur = typeof users.$inferSelect;

export const FICHIER_FORMATION = path.join(process.cwd(), "data", "formation", "ima-talks-inneros-ia-1.0.json");

// Guide interne lu avant le quiz (document Claude d'IMA, à partager avec les personnes à former)
export const GUIDE = {
  titre: "Utiliser l'IA dans InnerOS — Guide interne IMA",
  version: "1.0",
  lien: "https://claude.ai/artifact/SpVKPZd85cfz9KwtwNap6D",
};

const texte = z.string().min(1);

export const schemaFormation = z.object({
  id: z.string().regex(/^[A-Z0-9-]{3,60}$/),
  title: texte,
  version: z.string().regex(/^\d+\.\d+$/),
  language: texte,
  audience: texte,
  duration_minutes: z.number().int().positive(),
  source_document: texte,
  scope: texte,
  passing_score_percent: z.number().int().min(1).max(100),
  modules: z
    .array(
      z.object({
        id: texte,
        title: texte,
        objective: texte,
        lessons: z.array(z.object({ title: texte, content: texte })).min(1),
        duration_minutes: z.number().int().positive(),
      }),
    )
    .min(1),
  quiz: z
    .array(
      z.object({
        id: texte,
        question: texte,
        options: z.array(texte).min(2),
        correct_option_index: z.number().int().min(0),
        feedback: texte,
      }),
    )
    .min(1)
    .refine((q) => q.every((x) => x.correct_option_index < x.options.length), "Bonne réponse hors des options"),
  attestation: z.object({ title: texte, disclaimer: texte }),
});
export type Formation = z.infer<typeof schemaFormation>;

let cache: Formation | null = null;
export function formation(): Formation {
  cache ??= schemaFormation.parse(JSON.parse(readFileSync(FICHIER_FORMATION, "utf8")));
  return cache;
}

// Ce que voit la personne formée : sans les bonnes réponses ni les explications (données après le quiz)
export function formationPublique(f = formation()) {
  return {
    ...f,
    quiz: f.quiz.map((q) => ({ id: q.id, question: q.question, options: q.options })),
  };
}
export type FormationPublique = ReturnType<typeof formationPublique>;

export function corrigerQuiz(reponses: Record<string, number>, f = formation()) {
  const details = f.quiz.map((q) => ({
    id: q.id,
    choisie: Number.isInteger(reponses[q.id]) ? reponses[q.id] : null,
    correcte: q.correct_option_index,
    juste: reponses[q.id] === q.correct_option_index,
    feedback: q.feedback,
  }));
  const score = Math.round((details.filter((d) => d.juste).length / f.quiz.length) * 100);
  return { score, reussi: score >= f.passing_score_percent, details };
}

// --- Progression ------------------------------------------------------------------------------

const estAdmin = (u: Utilisateur) => u.role === "admin" && !u.disabledAt;

async function ligne(db: Db, userId: string, f = formation()) {
  const [l] = await db
    .select()
    .from(aiTrainingProgress)
    .where(and(eq(aiTrainingProgress.userId, userId), eq(aiTrainingProgress.trainingId, f.id), eq(aiTrainingProgress.trainingVersion, f.version)));
  return l ?? null;
}

async function assurerLigne(db: Db, userId: string, f = formation()) {
  await db
    .insert(aiTrainingProgress)
    .values({ userId, trainingId: f.id, trainingVersion: f.version, guideVersion: GUIDE.version })
    .onConflictDoNothing();
  return (await ligne(db, userId, f))!;
}

export async function lireProgression(db: Db, u: Utilisateur) {
  if (!estAdmin(u)) return null;
  return ligne(db, u.id);
}
export type Progression = NonNullable<Awaited<ReturnType<typeof lireProgression>>>;

export async function accuserLectureGuide(db: Db, u: Utilisateur, maintenant = new Date()): Promise<Resultat> {
  if (!estAdmin(u)) return { ok: false, erreur: "introuvable" };
  const l = await assurerLigne(db, u.id);
  if (l.guideAckAt) return { ok: true, valeur: undefined };
  await db
    .update(aiTrainingProgress)
    .set({ guideAckAt: maintenant, updatedAt: maintenant })
    .where(and(eq(aiTrainingProgress.userId, u.id), eq(aiTrainingProgress.trainingId, l.trainingId), eq(aiTrainingProgress.trainingVersion, l.trainingVersion)));
  await journaliser(db, { actorUserId: u.id, action: "ai_training_guide_read", targetType: "user", targetId: u.id, details: { guide: GUIDE.version } });
  return { ok: true, valeur: undefined };
}

export async function soumettreQuiz(db: Db, u: Utilisateur, reponses: Record<string, number>, maintenant = new Date()): Promise<Resultat<ReturnType<typeof corrigerQuiz>>> {
  if (!estAdmin(u)) return { ok: false, erreur: "introuvable" };
  const f = formation();
  if (f.quiz.some((q) => !Number.isInteger(reponses[q.id]))) return { ok: false, erreur: "quizIncomplet" };
  const resultat = corrigerQuiz(reponses, f);
  const l = await assurerLigne(db, u.id, f);
  await db
    .update(aiTrainingProgress)
    .set({
      attempts: l.attempts + 1,
      bestScore: Math.max(l.bestScore ?? 0, resultat.score),
      passedAt: l.passedAt ?? (resultat.reussi ? maintenant : null),
      updatedAt: maintenant,
    })
    .where(and(eq(aiTrainingProgress.userId, u.id), eq(aiTrainingProgress.trainingId, f.id), eq(aiTrainingProgress.trainingVersion, f.version)));
  await journaliser(db, { actorUserId: u.id, action: "ai_training_quiz", targetType: "user", targetId: u.id, details: { version: f.version, score: resultat.score, reussi: resultat.reussi } });
  return { ok: true, valeur: resultat };
}

const sansCoordonnees = (s: string) => !/[^\s@]+@[^\s@]+\.[^\s@]+/.test(s) && !/(\+?\d[\s.-]?){8,}/.test(s);

// Enregistrement : après lecture du guide et réussite du quiz ; débloque la validation des contenus IA
export async function enregistrerFormation(
  db: Db,
  u: Utilisateur,
  saisie: { date: string; formationGenerale: string },
  maintenant = new Date(),
): Promise<Resultat<{ certificat: string }>> {
  if (!estAdmin(u)) return { ok: false, erreur: "introuvable" };
  const f = formation();
  const l = await ligne(db, u.id, f);
  if (!l?.guideAckAt || !l.passedAt) return { ok: false, erreur: "formationParcoursIncomplet" };
  const generale = saisie.formationGenerale.trim();
  if (generale.length < 3 || generale.length > 300) return { ok: false, erreur: "formationInvalide" };
  if (!sansCoordonnees(generale)) return { ok: false, erreur: "risqueCoordonnees" };
  const note = `${generale} ; ${GUIDE.titre} v${GUIDE.version} ; ${f.title} v${f.version} (quiz ${l.bestScore} %)`.slice(0, 500);
  const r = await enregistrerFormationIA(db, u.id, { date: saisie.date, note });
  if (!r.ok) return r;
  const certificat = l.certificateCode ?? `IMA-IA-${saisie.date.slice(0, 4)}-${randomBytes(4).toString("hex").toUpperCase()}`;
  await db
    .update(aiTrainingProgress)
    .set({ generalTraining: generale, registeredAt: maintenant, certificateCode: certificat, updatedAt: maintenant })
    .where(and(eq(aiTrainingProgress.userId, u.id), eq(aiTrainingProgress.trainingId, f.id), eq(aiTrainingProgress.trainingVersion, f.version)));
  await journaliser(db, { actorUserId: u.id, action: "ai_training_registered", targetType: "user", targetId: u.id, details: { version: f.version, certificat } });
  return { ok: true, valeur: { certificat } };
}

// Données du certificat IMA (uniquement après l'enregistrement)
export async function donneesCertificat(db: Db, u: Utilisateur) {
  if (!estAdmin(u)) return null;
  const f = formation();
  const l = await ligne(db, u.id, f);
  if (!l?.registeredAt || !l.certificateCode) return null;
  const [moi] = await db.select({ aiLiteracyAt: users.aiLiteracyAt }).from(users).where(eq(users.id, u.id));
  return {
    nom: u.name,
    identifiant: u.email,
    date: moi?.aiLiteracyAt ?? l.registeredAt.toISOString().slice(0, 10),
    formation: f.title,
    versionFormation: f.version,
    dureeMinutes: f.duration_minutes,
    versionGuide: l.guideVersion,
    score: l.bestScore ?? 0,
    seuil: f.passing_score_percent,
    formationGenerale: l.generalTraining ?? "",
    guideLuLe: l.guideAckAt!.toISOString().slice(0, 10),
    enregistreLe: l.registeredAt.toISOString(),
    code: l.certificateCode,
    modules: f.modules.map((m) => m.title),
    titre: f.attestation.title,
    avertissement: f.attestation.disclaimer,
  };
}
export type DonneesCertificat = NonNullable<Awaited<ReturnType<typeof donneesCertificat>>>;
