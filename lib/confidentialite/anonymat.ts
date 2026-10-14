// Mesures techniques contre le recoupement des réponses (audit d'anonymat du 14/10/2026).
// À la clôture, les réponses sont réécrites dans un ordre aléatoire, avec de nouveaux identifiants,
// dans la même transaction que la suppression des jetons : toutes les lignes portent alors le même
// numéro de transaction (xmin), et l'ordre d'arrivée ne peut plus être reconstitué depuis la base.
// Les anciennes versions des lignes restent physiquement présentes jusqu'au nettoyage (VACUUM),
// lancé juste après la clôture.
import { randomInt } from "node:crypto";
import { eq, inArray, sql } from "drizzle-orm";
import { answers, responses } from "../db/schema";
import type { Db } from "../db/types";

function melanger<T>(liste: T[]) {
  const copie = [...liste];
  for (let i = copie.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [copie[i], copie[j]] = [copie[j], copie[i]];
  }
  return copie;
}

// Réécrit toutes les réponses d'une campagne (à appeler dans la transaction de clôture)
export async function reecrireReponses(tx: Db, campaignId: string) {
  const anciennes = await tx.select().from(responses).where(eq(responses.campaignId, campaignId));
  if (!anciennes.length) return 0;
  const items = await tx.select().from(answers).where(inArray(answers.responseId, anciennes.map((r) => r.id)));
  const parReponse = new Map<string, (typeof items)[number][]>();
  for (const a of items) {
    if (!parReponse.has(a.responseId)) parReponse.set(a.responseId, []);
    parReponse.get(a.responseId)!.push(a);
  }

  // Les items sont supprimés en cascade avec chaque réponse
  await tx.delete(responses).where(eq(responses.campaignId, campaignId));
  for (const r of melanger(anciennes)) {
    const [nouvelle] = await tx
      .insert(responses)
      .values({ campaignId, groupId: r.groupId, responseDate: r.responseDate, instrumentVersions: r.instrumentVersions })
      .returning({ id: responses.id });
    const siens = parReponse.get(r.id) ?? [];
    if (siens.length) await tx.insert(answers).values(melanger(siens).map((a) => ({ responseId: nouvelle.id, itemId: a.itemId, value: a.value })));
  }
  return anciennes.length;
}

// Nettoyage des anciennes versions des lignes (hors transaction). Sans effet bloquant s'il échoue :
// PostgreSQL le fait aussi automatiquement (autovacuum).
export async function nettoyerAnciennesVersions(db: Db) {
  try {
    await db.execute(sql`VACUUM responses, answers, tokens`);
    return true;
  } catch {
    return false;
  }
}
