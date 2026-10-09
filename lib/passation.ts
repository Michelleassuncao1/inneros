// Passation du questionnaire par un répondant (F6). Règles 1 et 2 de CLAUDE.md :
// - aucune donnée sur la personne n'est enregistrée (ni nom, ni IP, ni heure : la date du jour seulement) ;
// - le jeton passe à « utilisé » dans la même opération que l'enregistrement de la réponse,
//   mais aucune colonne ne relie l'un à l'autre.
import { and, asc, eq, gte } from "drizzle-orm";
import { empreinteJeton } from "./admin/jetons";
import { answers, campaignInstruments, campaigns, groups, instruments, organizations, responses, tokens } from "./db/schema";
import type { Db } from "./db/types";
import { definitionPour } from "./instruments/chargement";
import { cleItem, type FichierInstrument } from "./instruments/format";
import { aidesPour } from "./pays";

export type EtatCode = "ok" | "invalide" | "utilise" | "expire" | "pasOuverte" | "indisponible";

function jour(d: Date) {
  return d.toISOString().slice(0, 10);
}

async function lireJeton(db: Db, code: string) {
  const [jeton] = await db.select().from(tokens).where(eq(tokens.tokenHash, empreinteJeton(code)));
  return jeton;
}

// Ce que voit le répondant après avoir saisi ou scanné son code
export async function ouvrirQuestionnaire(db: Db, code: string, langueDemandee: string, maintenant = new Date()) {
  const jeton = await lireJeton(db, code);
  // Un jeton révoqué ou inconnu reçoit la même réponse : on ne révèle rien de plus
  if (!jeton || jeton.status === "revoked") return { etat: "invalide" as const };
  if (jeton.status === "consumed") return { etat: "utilise" as const };
  if (jeton.expiresOn < jour(maintenant)) return { etat: "expire" as const };

  const [ligne] = await db
    .select({ campagne: campaigns, pays: organizations.country })
    .from(campaigns)
    .innerJoin(organizations, eq(campaigns.organizationId, organizations.id))
    .where(eq(campaigns.id, jeton.campaignId));
  if (!ligne) return { etat: "invalide" as const };
  const { campagne, pays } = ligne;
  if (campagne.status === "draft") return { etat: "pasOuverte" as const };
  if (campagne.status === "closed") return { etat: "expire" as const };

  const langues = campagne.locales as string[];
  const langue = langues.includes(langueDemandee) ? langueDemandee : langues[0];

  const [listeGroupes, liens] = await Promise.all([
    db
      .select({ id: groups.id, label: groups.label })
      .from(groups)
      .where(eq(groups.campaignId, campagne.id))
      .orderBy(asc(groups.label)),
    db
      .select({ definitions: instruments.definitions })
      .from(campaignInstruments)
      .innerJoin(instruments, eq(campaignInstruments.instrumentId, instruments.id))
      .where(eq(campaignInstruments.campaignId, campagne.id))
      .orderBy(asc(instruments.code)),
  ]);
  const questionnaires = liens.map((l) => definitionPour(l.definitions, langue));
  if (!questionnaires.length || questionnaires.some((q) => !q)) return { etat: "indisponible" as const };

  return {
    etat: "ok" as const,
    langue,
    langues,
    pays,
    critere: campagne.groupingCriterion,
    seuil: campagne.groupMinSize,
    fin: campagne.endDate,
    groupes: listeGroupes,
    questionnaires: questionnaires as FichierInstrument[],
    aides: aidesPour(pays, langue).map((a) => ({ numero: a.numero, cle: a.cle })),
  };
}

// Réponses attendues pour une campagne : chaque item, avec les codes de réponse autorisés
async function itemsAttendus(db: Db, campaignId: string) {
  const liens = await db
    .select({ code: instruments.code, version: instruments.version, definitions: instruments.definitions })
    .from(campaignInstruments)
    .innerJoin(instruments, eq(campaignInstruments.instrumentId, instruments.id))
    .where(eq(campaignInstruments.campaignId, campaignId));
  const attendus = new Map<string, Set<number>>();
  const versions: Record<string, string> = {};
  for (const l of liens) {
    // La structure est identique dans toutes les langues : n'importe laquelle convient
    const definition = Object.keys((l.definitions ?? {}) as object)
      .map((lg) => definitionPour(l.definitions, lg))
      .find(Boolean);
    if (!definition) throw new ErreurPassation("indisponible");
    versions[l.code] = l.version;
    const echelles = new Map(definition.echelles_reponse.map((e) => [e.id, new Set(e.options.map((o) => o.code))]));
    for (const d of definition.dimensions) {
      for (const i of d.items) attendus.set(cleItem(l.code, i.id), echelles.get(i.reponse)!);
    }
  }
  return { attendus, versions };
}

class ErreurPassation extends Error {
  constructor(public raison: EtatCode | "groupe" | "reponses") {
    super(raison);
  }
}

export type ResultatEnvoi = { ok: true } | { ok: false; raison: EtatCode | "groupe" | "reponses" };

export async function enregistrerReponses(
  db: Db,
  saisie: { code: string; groupe: string; reponses: Record<string, number | null> },
  maintenant = new Date(),
): Promise<ResultatEnvoi> {
  try {
    await db.transaction(async (tx) => {
      // 1. Le jeton passe à « utilisé », une seule fois : un second envoi simultané ne trouve plus rien
      const [jeton] = await tx
        .update(tokens)
        .set({ status: "consumed" })
        .where(
          and(
            eq(tokens.tokenHash, empreinteJeton(saisie.code)),
            eq(tokens.status, "active"),
            gte(tokens.expiresOn, jour(maintenant)),
          ),
        )
        .returning({ campaignId: tokens.campaignId });
      if (!jeton) {
        const existant = await lireJeton(tx, saisie.code);
        throw new ErreurPassation(!existant || existant.status === "revoked" ? "invalide" : existant.status === "consumed" ? "utilise" : "expire");
      }

      const [campagne] = await tx.select().from(campaigns).where(eq(campaigns.id, jeton.campaignId));
      if (!campagne || campagne.status !== "open") throw new ErreurPassation("pasOuverte");

      // 2. Le groupe doit appartenir à la campagne
      const [groupe] = await tx
        .select({ id: groups.id })
        .from(groups)
        .where(and(eq(groups.id, saisie.groupe), eq(groups.campaignId, campagne.id)));
      if (!groupe) throw new ErreurPassation("groupe");

      // 3. Exactement les items de la campagne, avec des codes autorisés (ou vide : « je préfère ne pas répondre »)
      const { attendus, versions } = await itemsAttendus(tx, campagne.id);
      const recus = Object.entries(saisie.reponses);
      if (recus.length !== attendus.size) throw new ErreurPassation("reponses");
      for (const [cle, valeur] of recus) {
        const codes = attendus.get(cle);
        if (!codes || (valeur !== null && !codes.has(valeur))) throw new ErreurPassation("reponses");
      }

      // 4. La réponse anonyme : campagne, groupe, date du jour (par défaut en base), versions
      const [reponse] = await tx
        .insert(responses)
        .values({ campaignId: campagne.id, groupId: groupe.id, instrumentVersions: versions })
        .returning({ id: responses.id });
      await tx.insert(answers).values(recus.map(([itemId, value]) => ({ responseId: reponse.id, itemId, value })));
    });
    return { ok: true };
  } catch (e) {
    if (e instanceof ErreurPassation) return { ok: false, raison: e.raison };
    throw e;
  }
}
