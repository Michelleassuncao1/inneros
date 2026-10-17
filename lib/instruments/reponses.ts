// Règles de réponse communes au navigateur du répondant et au serveur :
// questions conditionnelles (« si oui, de la part de qui ? ») et questions à choix multiple.
// Une question à choix multiple est enregistrée case par case : 1 = cochée, 0 = non cochée,
// vide pour toutes les cases = « je préfère ne pas répondre » ou question non posée.
import { cleItem, cleOption, type FichierInstrument } from "./format";

type Dimension = FichierInstrument["dimensions"][number];
type Item = Dimension["items"][number];
export type Saisie = Record<string, number | null | undefined>;

// Clés enregistrées pour une question (une seule, ou une par case)
export function clesDe(f: FichierInstrument, item: Item) {
  if (!item.multiple) return [cleItem(f.instrument, item.id)];
  const options = f.echelles_reponse.find((e) => e.id === item.reponse)?.options ?? [];
  return options.map((o) => cleOption(f.instrument, item.id, o.code));
}

// La question est-elle posée, compte tenu des réponses déjà données ?
export function itemVisible(f: FichierInstrument, d: Dimension, item: Item, reponses: Saisie) {
  if (!item.si) return true;
  const parent = d.items.find((i) => i.id === item.si!.item);
  if (!parent || !itemVisible(f, d, parent, reponses)) return false;
  const valeur = reponses[cleItem(f.instrument, parent.id)];
  return valeur !== null && valeur !== undefined && item.si.codes.includes(valeur);
}

// La question a-t-elle reçu une réponse (une case cochée, ou « je préfère ne pas répondre ») ?
export function itemRepondu(f: FichierInstrument, item: Item, reponses: Saisie) {
  const cles = clesDe(f, item);
  if (!item.multiple) return reponses[cles[0]] !== undefined;
  return cles.some((k) => reponses[k] === 1) || cles.every((k) => reponses[k] === null);
}

// Réponses envoyées : toutes les clés du questionnaire, vides pour les questions non posées
export function reponsesCompletes(f: FichierInstrument, reponses: Saisie) {
  const resultat: Record<string, number | null> = {};
  for (const d of f.dimensions) {
    for (const item of d.items) {
      const visible = itemVisible(f, d, item, reponses);
      const cles = clesDe(f, item);
      const prefereNePas = cles.every((k) => reponses[k] === null);
      for (const k of cles) {
        if (!visible) resultat[k] = null;
        else if (item.multiple) resultat[k] = prefereNePas ? null : (reponses[k] ?? 0);
        else resultat[k] = reponses[k] ?? null;
      }
    }
  }
  return resultat;
}

// Codes autorisés pour chaque clé (contrôle côté serveur)
export function codesAutorises(f: FichierInstrument) {
  const echelles = new Map(f.echelles_reponse.map((e) => [e.id, new Set(e.options.map((o) => o.code))]));
  const attendus = new Map<string, Set<number>>();
  for (const d of f.dimensions) {
    for (const item of d.items) {
      for (const k of clesDe(f, item)) attendus.set(k, item.multiple ? new Set([0, 1]) : echelles.get(item.reponse)!);
    }
  }
  return attendus;
}

// Une question non posée ne doit pas avoir de réponse ; une question à choix multiple est
// soit entièrement vide, soit entièrement remplie (0 ou 1 pour chaque case)
export function reponsesCoherentes(f: FichierInstrument, reponses: Saisie) {
  for (const d of f.dimensions) {
    for (const item of d.items) {
      const valeurs = clesDe(f, item).map((k) => reponses[k]);
      if (!itemVisible(f, d, item, reponses) && valeurs.some((v) => v !== null && v !== undefined)) return false;
      if (item.multiple && valeurs.some((v) => v === null) && valeurs.some((v) => v !== null)) return false;
    }
  }
  return true;
}
