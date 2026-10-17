// Campagne de démonstration avec des réponses fictives (étape 7) : elle passe par le vrai parcours
// (jetons, envoi anonyme, clôture) pour tester les agrégats et le masquage de bout en bout.
// Les réponses sont tirées au hasard avec une graine : la même graine redonne les mêmes données.
import { eq } from "drizzle-orm";
import { ajouterGroupe, choisirQuestionnaires, choisirReferents, creerCampagne } from "../admin/campagnes";
import { cloturerCampagne, ouvrirCampagne } from "../admin/cycle";
import { ajouterReferent, creerEntreprise } from "../admin/entreprises";
import { genererJetons } from "../admin/jetons";
import { campaigns, groups, instruments, reports, users } from "../db/schema";
import { moisAvant } from "../confidentialite/conservation";
import type { Db } from "../db/types";
import { definitionPour } from "../instruments/chargement";
import { cleItem } from "../instruments/format";
import { clesDe, reponsesCompletes } from "../instruments/reponses";
import { enregistrerReponses } from "../passation";

export type GroupeDemo = { libelle: string; attendus: number; repondants: number };

// Générateur pseudo-aléatoire reproductible (mulberry32)
function aleatoire(graine: number) {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const jour = (d: Date) => d.toISOString().slice(0, 10);

export async function creerCampagneDemo(
  db: Db,
  options: {
    adminId: string;
    instrumentIds: string[];
    groupes: GroupeDemo[];
    maintenant?: Date;
    graine?: number;
    nom?: string;
    rapportAccepteIlYaMois?: number;
    pays?: "BE" | "FR"; // pays de l'entreprise fictive (BE par défaut)
  },
) {
  const maintenant = options.maintenant ?? new Date();
  const hasard = aleatoire(options.graine ?? 2026);
  const verifier = <T>(r: { ok: true; valeur: T } | { ok: false; erreur: string }) => {
    if (!r.ok) throw new Error(r.erreur);
    return r.valeur;
  };

  const suffixe = Math.floor(hasard() * 1e6).toString(36);
  const org = verifier(
    await creerEntreprise(db, options.adminId, {
      name: options.nom ?? `DÉMO — données fictives ${suffixe}`,
      country: options.pays ?? "BE",
      locale: "fr",
      sector: "Démonstration",
      sizeBand: "50-249",
    }),
  );
  const fin = new Date(maintenant.getTime() + 30 * 86400000);
  const campagne = verifier(
    await creerCampagne(db, options.adminId, org.id, {
      mandateType: "n1",
      mandateReference: `DEMO-${suffixe}`.toUpperCase(),
      diagnosticQuestion: "",
      perimeter: "",
      groupMinSize: 10,
      startDate: jour(maintenant),
      endDate: jour(fin),
      locales: ["fr"],
      groupingCriterion: "service",
    }),
  );
  for (const g of options.groupes) verifier(await ajouterGroupe(db, options.adminId, campagne.id, { label: g.libelle, expectedSize: g.attendus }));
  verifier(await choisirQuestionnaires(db, options.adminId, campagne.id, options.instrumentIds));
  const courriel = `referent-${suffixe}@demo.invalid`;
  verifier(await ajouterReferent(db, options.adminId, org.id, { name: "Référent de démonstration", email: courriel }));
  const [referent] = await db.select().from(users).where(eq(users.email, courriel));
  verifier(await choisirReferents(db, options.adminId, campagne.id, [referent.id]));

  const total = options.groupes.reduce((s, g) => s + g.repondants, 0);
  const { codes } = verifier(await genererJetons(db, options.adminId, campagne.id, total));
  verifier(await ouvrirCampagne(db, options.adminId, campagne.id, { mandateValidatedOn: jour(maintenant), confirmation: "oui" }, maintenant));

  const definitions = await Promise.all(
    options.instrumentIds.map(async (id) => {
      const [i] = await db.select().from(instruments).where(eq(instruments.id, id));
      const d = definitionPour(i.definitions, "fr");
      if (!d) throw new Error(`questionnaire ${i.code} sans version française`);
      return d;
    }),
  );
  const listeGroupes = await db.select().from(groups).where(eq(groups.campaignId, campagne.id));

  let indice = 0;
  for (const [k, g] of options.groupes.entries()) {
    const groupeId = listeGroupes.find((x) => x.label === g.libelle)!.id;
    const tendance = (k % 3) / 2; // chaque groupe a sa tendance, pour des résultats différents
    for (let r = 0; r < g.repondants; r++) {
      const reponses: Record<string, number | null> = {};
      for (const def of definitions) {
        for (const d of def.dimensions) {
          if (d.type === "comportement") {
            // Comportements indésirables : la plupart répondent « Non » ; sinon une fréquence et un ou deux auteurs
            const [frequence, auteurs] = d.items;
            const codes = def.echelles_reponse.find((e) => e.id === frequence.reponse)!.options.map((o) => o.code);
            const oui = auteurs.si!.codes;
            const non = codes.find((c) => !oui.includes(c))!;
            const v = hasard() < 0.85 ? non : oui[Math.floor(hasard() * oui.length)];
            reponses[cleItem(def.instrument, frequence.id)] = v;
            if (oui.includes(v)) {
              const cles = clesDe(def, auteurs);
              const choisies = new Set([Math.floor(hasard() * cles.length), Math.floor(hasard() * cles.length)]);
              cles.forEach((k, j) => (reponses[k] = choisies.has(j) ? 1 : 0));
            }
            continue;
          }
          for (const item of d.items) {
            const options = def.echelles_reponse.find((e) => e.id === item.reponse)!.options;
            const valides = options.filter((o) => !o.manquant);
            const tirage = hasard();
            if (tirage < 0.04) reponses[cleItem(def.instrument, item.id)] = null; // « je préfère ne pas répondre »
            else if (tirage < 0.06 && options.some((o) => o.manquant))
              reponses[cleItem(def.instrument, item.id)] = options.find((o) => o.manquant)!.code;
            else {
              const position = Math.min(valides.length - 1, Math.floor(((hasard() + tendance) / 1.5) * valides.length));
              reponses[cleItem(def.instrument, item.id)] = valides[position].code;
            }
          }
        }
      }
      const completes = Object.assign({}, ...definitions.map((def) => reponsesCompletes(def, reponses)));
      const envoi = await enregistrerReponses(db, { code: codes[indice++], groupe: groupeId, reponses: completes }, maintenant);
      if (!envoi.ok) throw new Error(`réponse refusée : ${envoi.raison}`);
    }
  }
  verifier(await cloturerCampagne(db, options.adminId, campagne.id, maintenant));

  // Option : rapport fictif validé par IMA et accepté par le référent signataire il y a N mois
  // (pour tester la suppression programmée des réponses brutes)
  if (options.rapportAccepteIlYaMois !== undefined) {
    const date = moisAvant(maintenant, options.rapportAccepteIlYaMois);
    const [validateur] = await db.select({ forme: users.aiLiteracyAt }).from(users).where(eq(users.id, options.adminId));
    if (!validateur?.forme) {
      throw new Error("Rapport de démonstration impossible : enregistrez d'abord la formation à l'IA de l'administrateur (page d'accueil de l'espace IMA).");
    }
    await db.update(campaigns).set({ signatoryReferentId: referent.id }).where(eq(campaigns.id, campagne.id));
    await db.insert(reports).values({
      campaignId: campagne.id,
      status: "validated",
      finalText: "Rapport de démonstration — texte fictif.",
      checkSourcesVerified: true,
      checkNoSmallGroup: true,
      checkLanguageRule: true,
      checkLimitsMentioned: true,
      validatedBy: options.adminId,
      validatedAt: date,
      acceptedBy: referent.id,
      acceptedAt: date,
    });
  }
  return campagne.id;
}
