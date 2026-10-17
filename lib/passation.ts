// Passation du questionnaire par un répondant (F6). Règles 1 et 2 de CLAUDE.md :
// - aucune donnée sur la personne n'est enregistrée (ni nom, ni IP, ni heure : la date du jour seulement) ;
// - le jeton passe à « utilisé » dans la même opération que l'enregistrement de la réponse,
//   mais aucune colonne ne relie l'un à l'autre.
import { and, asc, eq, gte } from "drizzle-orm";
import { empreinteJeton } from "./admin/jetons";
import { answers, campaignInstruments, campaigns, groups, instruments, organizations, responses, tokens } from "./db/schema";
import type { Db } from "./db/types";
import { definitionPour } from "./instruments/chargement";
import type { FichierInstrument } from "./instruments/format";
import { codesAutorises, reponsesCoherentes } from "./instruments/reponses";
import { aidesPour } from "./pays";
import { lireSoutien } from "./admin/soutien";

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
    soutien: lireSoutien(campagne),
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
  const definitions: FichierInstrument[] = [];
  for (const l of liens) {
    // La structure est identique dans toutes les langues : n'importe laquelle convient
    const definition = Object.keys((l.definitions ?? {}) as object)
      .map((lg) => definitionPour(l.definitions, lg))
      .find(Boolean);
    if (!definition) throw new ErreurPassation("indisponible");
    versions[l.code] = l.version;
    definitions.push(definition);
    for (const [k, codes] of codesAutorises(definition)) attendus.set(k, codes);
  }
  return { attendus, versions, definitions };
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
  // Anonymat : le jeton et la réponse sont écrits dans deux transactions distinctes. Dans une seule
  // transaction, PostgreSQL attribue le même numéro de transaction (colonne cachée xmin) au jeton
  // « utilisé » et à la réponse, ce qui permettrait de les relier en lisant la base.
  // (Constat de l'audit du 14/10/2026, voir docs/securite/ANONYMAT-ET-SECURITE.md.)
  const empreinte = empreinteJeton(saisie.code);
  try {
    // 1. Vérifications, sans rien écrire : un envoi refusé ne consomme pas le code
    const existant = await lireJeton(db, saisie.code);
    if (!existant || existant.status === "revoked") throw new ErreurPassation("invalide");
    if (existant.status === "consumed") throw new ErreurPassation("utilise");
    if (existant.expiresOn < jour(maintenant)) throw new ErreurPassation("expire");
    const [campagne] = await db.select().from(campaigns).where(eq(campaigns.id, existant.campaignId));
    if (!campagne || campagne.status !== "open") throw new ErreurPassation("pasOuverte");
    // Le groupe doit appartenir à la campagne
    const [groupe] = await db
      .select({ id: groups.id })
      .from(groups)
      .where(and(eq(groups.id, saisie.groupe), eq(groups.campaignId, campagne.id)));
    if (!groupe) throw new ErreurPassation("groupe");
    // Exactement les items de la campagne, avec des codes autorisés (ou vide : « je préfère ne pas répondre »)
    const { attendus, versions, definitions } = await itemsAttendus(db, campagne.id);
    const recus = Object.entries(saisie.reponses);
    if (recus.length !== attendus.size) throw new ErreurPassation("reponses");
    for (const [cle, valeur] of recus) {
      const codes = attendus.get(cle);
      if (!codes || (valeur !== null && !codes.has(valeur))) throw new ErreurPassation("reponses");
    }
    // Pas de réponse à une question non posée (« si oui… »), cases d'un choix multiple cohérentes
    if (definitions.some((f) => !reponsesCoherentes(f, saisie.reponses))) throw new ErreurPassation("reponses");

    // 2. Transaction A : le jeton passe à « utilisé », une seule fois (un second envoi simultané ne trouve plus rien)
    const consommes = await db
      .update(tokens)
      .set({ status: "consumed" })
      .where(and(eq(tokens.tokenHash, empreinte), eq(tokens.status, "active"), gte(tokens.expiresOn, jour(maintenant))))
      .returning({ id: tokens.id });
    if (!consommes.length) throw new ErreurPassation("utilise");

    // 3. Transaction B : la réponse anonyme (campagne, groupe, date du jour, versions), sans lien avec le jeton
    try {
      await db.transaction(async (tx) => {
        const [ouverte] = await tx.select({ status: campaigns.status }).from(campaigns).where(eq(campaigns.id, campagne.id));
        if (ouverte?.status !== "open") throw new ErreurPassation("pasOuverte");
        const [reponse] = await tx
          .insert(responses)
          .values({ campaignId: campagne.id, groupId: groupe.id, instrumentVersions: versions })
          .returning({ id: responses.id });
        await tx.insert(answers).values(recus.map(([itemId, value]) => ({ responseId: reponse.id, itemId, value })));
      });
    } catch (e) {
      // La réponse n'a pas pu être enregistrée : le code redevient utilisable
      await db.update(tokens).set({ status: "active" }).where(and(eq(tokens.tokenHash, empreinte), eq(tokens.status, "consumed")));
      throw e;
    }
    return { ok: true };
  } catch (e) {
    if (e instanceof ErreurPassation) return { ok: false, raison: e.raison };
    throw e;
  }
}
