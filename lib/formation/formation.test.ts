// Formation IMA Talks : fichier d'IMA valide, quiz corrigé sur le serveur, ordre imposé (guide, quiz,
// enregistrement), déblocage de la validation, certificat PDF.
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { users } from "../db/schema";
import { creerBaseDeTest } from "../db/test-db";
import { pdfCertificat } from "../pdf/certificat";
import { accuserLectureGuide, corrigerQuiz, donneesCertificat, enregistrerFormation, formation, formationPublique, lireProgression, soumettreQuiz } from "./formation";

beforeAll(() => {
  process.env.AUTH_SECRET = randomBytes(32).toString("base64");
});

const toutJuste = () => Object.fromEntries(formation().quiz.map((q) => [q.id, q.correct_option_index]));
const toutFaux = () => Object.fromEntries(formation().quiz.map((q) => [q.id, (q.correct_option_index + 1) % q.options.length]));

async function preparer() {
  const { db } = await creerBaseDeTest();
  const [admin] = await db.insert(users).values({ email: "praticienne@ima.test", name: "Praticienne Fictive", role: "admin", passwordHash: "x" }).returning();
  const [desactive] = await db.insert(users).values({ email: "ancien@ima.test", name: "Ancien", role: "admin", passwordHash: "x", disabledAt: new Date() }).returning();
  return { db, admin, desactive };
}

describe("Contenu de la formation", () => {
  it("lit le fichier d'IMA et n'envoie pas les bonnes réponses au navigateur", () => {
    const f = formation();
    expect([f.id, f.version, f.passing_score_percent, f.modules.length, f.quiz.length]).toEqual(["IMA-TALKS-INNEROS-AI-001", "1.0", 80, 6, 12]);
    const publique = JSON.stringify(formationPublique(f).quiz);
    expect(publique).not.toContain("correct_option_index");
    expect(publique).not.toContain("feedback");
  });

  it("corrige le quiz avec le seuil de 80 %", () => {
    expect(corrigerQuiz(toutJuste())).toMatchObject({ score: 100, reussi: true });
    const dixSurDouze = { ...toutJuste(), Q1: 0, Q2: 2 };
    expect(corrigerQuiz(dixSurDouze)).toMatchObject({ score: 83, reussi: true });
    expect(corrigerQuiz({ ...dixSurDouze, Q3: 0 })).toMatchObject({ score: 75, reussi: false });
  });
});

describe("Parcours", () => {
  it("impose guide et quiz réussi avant l'enregistrement, qui débloque la validation", async () => {
    const { db, admin, desactive } = await preparer();
    const maintenant = new Date("2026-10-26T10:00:00Z");
    expect(await accuserLectureGuide(db, desactive)).toEqual({ ok: false, erreur: "introuvable" });
    expect(await soumettreQuiz(db, admin, { Q1: 1 })).toEqual({ ok: false, erreur: "quizIncomplet" });

    const echec = await soumettreQuiz(db, admin, toutFaux(), maintenant);
    expect(echec.ok && echec.valeur.reussi).toBe(false);
    expect(await enregistrerFormation(db, admin, { date: "2026-10-26", formationGenerale: "Elements of AI" }, maintenant)).toEqual({ ok: false, erreur: "formationParcoursIncomplet" });

    const reussite = await soumettreQuiz(db, admin, toutJuste(), maintenant);
    expect(reussite.ok && reussite.valeur.score).toBe(100);
    // Quiz réussi mais guide non lu : toujours refusé
    expect(await enregistrerFormation(db, admin, { date: "2026-10-26", formationGenerale: "Elements of AI" }, maintenant)).toEqual({ ok: false, erreur: "formationParcoursIncomplet" });
    expect((await accuserLectureGuide(db, admin, maintenant)).ok).toBe(true);
    expect(await enregistrerFormation(db, admin, { date: "2026-10-26", formationGenerale: "Voir prof@ecole.be" }, maintenant)).toEqual({ ok: false, erreur: "risqueCoordonnees" });

    const r = await enregistrerFormation(db, admin, { date: "2026-10-26", formationGenerale: "Elements of AI (Université d'Helsinki)" }, maintenant);
    if (!r.ok) throw new Error(r.erreur);
    expect(r.valeur.certificat).toMatch(/^IMA-IA-2026-[0-9A-F]{8}$/);
    const p = (await lireProgression(db, admin))!;
    expect([p.attempts, p.bestScore, !!p.passedAt, !!p.registeredAt]).toEqual([2, 100, true, true]);
    const [u] = await db.select().from(users).where(eq(users.id, admin.id));
    expect(u.aiLiteracyAt).toBe("2026-10-26");
    expect(u.aiLiteracyNote).toContain("IMA Talks");

    // Un nouvel échec au quiz ne retire pas la réussite
    await soumettreQuiz(db, admin, toutFaux(), maintenant);
    expect((await lireProgression(db, admin))!.bestScore).toBe(100);
  });

  it("produit le certificat IMA seulement après l'enregistrement", async () => {
    const { db, admin } = await preparer();
    expect(await donneesCertificat(db, admin)).toBeNull();
    await accuserLectureGuide(db, admin);
    await soumettreQuiz(db, admin, toutJuste());
    await enregistrerFormation(db, admin, { date: "2026-10-26", formationGenerale: "Elements of AI" });
    const d = (await donneesCertificat(db, admin))!;
    expect([d.nom, d.score, d.versionFormation, d.versionGuide]).toEqual(["Praticienne Fictive", 100, "1.0", "1.0"]);
    expect(d.avertissement).toContain("ne constitue pas une certification officielle");
    expect((await pdfCertificat(d)).subarray(0, 4).toString()).toBe("%PDF");
  }, 60000);
});
