// Étape 7 : agrégats par groupe et par échelle, et suivi de participation (règle 3, F7, F9).
// - Calcul à la clôture seulement (décision de Michelle du 13/10/2026) : des résultats mis à jour après
//   chaque réponse permettraient de deviner la dernière réponse par différence.
// - Aucun résultat pour moins de « seuil » personnes (10 au minimum), ni directement ni par soustraction :
//   si la part masquée est entre 1 et seuil - 1, le plus petit groupe visible est masqué à son tour.
import { and, asc, count, eq, inArray } from "drizzle-orm";
import { aggregates, answers, campaignInstruments, campaigns, groups, instruments, responses, tokens } from "../db/schema";
import type { Db } from "../db/types";
import { definitionPour } from "../instruments/chargement";
import type { FichierInstrument } from "../instruments/format";
import { scorerDimension, VERSION_CALCUL, type Reponses } from "../scoring";

// --- Masquage ---------------------------------------------------------------------------------

export type Effectif = { id: string; n: number };

// Groupes dont on peut montrer le résultat, et si le total de la campagne peut l'être aussi.
// Garantie : la part non montrée (total - groupes visibles) vaut 0 ou au moins « seuil ».
export function groupesAffichables(effectifs: Effectif[], seuil: number) {
  const total = effectifs.reduce((s, g) => s + g.n, 0);
  const visibles = effectifs.filter((g) => g.n >= seuil).sort((a, b) => a.n - b.n || a.id.localeCompare(b.id));
  let reste = total - visibles.reduce((s, g) => s + g.n, 0);
  while (reste > 0 && reste < seuil && visibles.length) reste += visibles.shift()!.n;
  return { visibles: new Set(visibles.map((g) => g.id)), totalVisible: total >= seuil };
}

// --- Statistiques -----------------------------------------------------------------------------

export function statistiques(valeurs: number[]) {
  const n = valeurs.length;
  const moyenne = valeurs.reduce((s, v) => s + v, 0) / n;
  // Écart-type d'échantillon (n - 1)
  const variance = n > 1 ? valeurs.reduce((s, v) => s + (v - moyenne) ** 2, 0) / (n - 1) : 0;
  return { n, moyenne, ecartType: Math.sqrt(variance) };
}

// --- Calcul à la clôture ----------------------------------------------------------------------

async function questionnairesDeLaCampagne(db: Db, campaignId: string) {
  const liens = await db
    .select({ id: instruments.id, code: instruments.code, definitions: instruments.definitions })
    .from(campaignInstruments)
    .innerJoin(instruments, eq(campaignInstruments.instrumentId, instruments.id))
    .where(eq(campaignInstruments.campaignId, campaignId))
    .orderBy(asc(instruments.code));
  return liens.map((l) => {
    // La structure est identique dans toutes les langues : n'importe laquelle convient pour calculer
    const definition = Object.keys((l.definitions ?? {}) as object)
      .map((lg) => definitionPour(l.definitions, lg))
      .find(Boolean);
    if (!definition) throw new Error(`questionnaire ${l.code} sans définition lisible`);
    return { id: l.id, definition };
  });
}

// Recalcule et enregistre tous les agrégats de la campagne (remplace les précédents)
export async function calculerAgregats(db: Db, campaignId: string) {
  const [campagne] = await db.select().from(campaigns).where(eq(campaigns.id, campaignId));
  if (!campagne) throw new Error("campagne introuvable");
  const seuil = campagne.groupMinSize;
  const questionnaires = await questionnairesDeLaCampagne(db, campaignId);

  const lignesReponses = await db
    .select({ id: responses.id, groupId: responses.groupId })
    .from(responses)
    .where(eq(responses.campaignId, campaignId));
  const ids = lignesReponses.map((r) => r.id);
  const lignesItems = ids.length
    ? await db.select().from(answers).where(inArray(answers.responseId, ids))
    : [];
  const parReponse = new Map<string, Reponses>(ids.map((id) => [id, {}]));
  for (const a of lignesItems) parReponse.get(a.responseId)![a.itemId] = a.value;

  const nouvelles: (typeof aggregates.$inferInsert)[] = [];
  for (const { id: instrumentId, definition } of questionnaires) {
    for (const d of definition.dimensions) {
      // Scores individuels : en mémoire seulement, jamais enregistrés
      const scores = new Map<string, number[]>();
      for (const r of lignesReponses) {
        const s = scorerDimension(definition, d, parReponse.get(r.id)!);
        if (s === null) continue;
        if (!scores.has(r.groupId)) scores.set(r.groupId, []);
        scores.get(r.groupId)!.push(s);
      }
      const effectifs = [...scores].map(([id, v]) => ({ id, n: v.length }));
      const { visibles, totalVisible } = groupesAffichables(effectifs, seuil);
      const ligne = (groupId: string | null, valeurs: number[]) => {
        const st = statistiques(valeurs);
        return {
          campaignId,
          groupId,
          instrumentId,
          scaleId: d.id,
          n: st.n,
          mean: st.moyenne.toFixed(2),
          sd: st.ecartType.toFixed(2),
          shareAboveThreshold: null, // pas de seuil de vigilance tant qu'il n'y a pas de référence nationale
          scoringVersion: VERSION_CALCUL,
        };
      };
      for (const id of visibles) nouvelles.push(ligne(id, scores.get(id)!));
      if (totalVisible) nouvelles.push(ligne(null, [...scores.values()].flat()));
    }
  }

  await db.delete(aggregates).where(eq(aggregates.campaignId, campaignId));
  if (nouvelles.length) await db.insert(aggregates).values(nouvelles);
  return nouvelles.length;
}

// --- Participation (F7) -----------------------------------------------------------------------

export async function participation(db: Db, campaignId: string) {
  const [campagne] = await db.select().from(campaigns).where(eq(campaigns.id, campaignId));
  if (!campagne) return null;
  const listeGroupes = await db
    .select()
    .from(groups)
    .where(eq(groups.campaignId, campaignId))
    .orderBy(asc(groups.label));
  const comptes = await db
    .select({ groupId: responses.groupId, n: count() })
    .from(responses)
    .where(eq(responses.campaignId, campaignId))
    .groupBy(responses.groupId);
  const parGroupe = new Map(comptes.map((c) => [c.groupId, c.n]));
  const total = comptes.reduce((s, c) => s + c.n, 0);

  let codes = campagne.tokensIssued;
  if (codes === null) {
    const [r] = await db
      .select({ n: count() })
      .from(tokens)
      .where(and(eq(tokens.campaignId, campaignId), inArray(tokens.status, ["active", "consumed"])));
    codes = r.n;
  }

  const { visibles } = groupesAffichables(
    listeGroupes.map((g) => ({ id: g.id, n: parGroupe.get(g.id) ?? 0 })),
    campagne.groupMinSize,
  );
  return {
    seuil: campagne.groupMinSize,
    reponses: total,
    codes,
    groupes: listeGroupes.map((g) => ({
      id: g.id,
      libelle: g.label,
      attendus: g.expectedSize,
      // null : masqué (moins que le seuil, ou masqué pour empêcher un calcul par différence)
      reponses: visibles.has(g.id) ? (parGroupe.get(g.id) ?? 0) : null,
    })),
  };
}

// --- Lecture pour le tableau de bord (F9) -----------------------------------------------------

export async function lireResultats(db: Db, campaignId: string, langue: string) {
  const lignes = await db.select().from(aggregates).where(eq(aggregates.campaignId, campaignId));
  if (!lignes.length) return null;
  const liste = await db
    .select({ id: instruments.id, definitions: instruments.definitions })
    .from(instruments)
    .where(inArray(instruments.id, [...new Set(lignes.map((l) => l.instrumentId))]))
    .orderBy(asc(instruments.code));
  const listeGroupes = await db.select().from(groups).where(eq(groups.campaignId, campaignId)).orderBy(asc(groups.label));

  return {
    calculeLe: lignes[0].computedAt,
    version: lignes[0].scoringVersion,
    groupesMasques: listeGroupes.filter((g) => !lignes.some((l) => l.groupId === g.id)).length,
    groupes: listeGroupes.filter((g) => lignes.some((l) => l.groupId === g.id)).map((g) => ({ id: g.id, libelle: g.label })),
    questionnaires: liste.map((q) => {
      const definition: FichierInstrument | null =
        definitionPour(q.definitions, langue) ??
        Object.keys((q.definitions ?? {}) as object).map((lg) => definitionPour(q.definitions, lg)).find(Boolean) ??
        null;
      return {
        titre: definition?.titre ?? "",
        source: definition ? `${definition.titre} — ${definition.source}` : "",
        dimensions: (definition?.dimensions ?? []).map((d) => ({
          id: d.id,
          nom: d.nom,
          niveau: d.niveau_mindset ?? null,
          resultats: lignes
            .filter((l) => l.instrumentId === q.id && l.scaleId === d.id)
            .map((l) => ({ groupId: l.groupId, n: l.n, moyenne: Number(l.mean), ecartType: Number(l.sd) })),
        })),
      };
    }),
  };
}
