// Côté défavorable de chaque échelle (« haut » : un score élevé est défavorable, ex. charge de travail ;
// « bas » : un score bas est défavorable, ex. soutien). Sert uniquement à proposer une probabilité Kinney.
// Tableau tenu hors des fichiers officiels des questionnaires (règle 9) ; à valider par IMA
// (page docs/relecture/risques-relecture.html).
type Sens = "haut" | "bas";

const SENS: Record<string, Record<string, Sens>> = {
  copsoq3: {
    // Version belge (Clays) et internationale : un score élevé = plus de ce que dit le nom
    qd: "haut", wp: "haut", ed: "haut", he: "haut", in: "bas", pd: "bas", ct: "bas", mw: "bas",
    pr: "bas", re: "bas", cl: "bas", co: "haut", it: "haut", ql: "bas", ss: "bas", sc: "bas", sw: "bas",
    ji: "haut", iw: "haut", qw: "bas", js: "bas", wf: "haut", te: "bas", tm: "bas", ju: "bas", gh: "bas",
    // Version française (Dupret) : même convention dans InnerOS (décision du 17/10/2026)
    charge: "haut", rythme: "haut", cognitif: "haut", emotion: "haut", marge: "bas", epanouis: "bas",
    sens: "bas", clarte: "bas", conflitval: "haut", previsib: "bas", reconnais: "bas", leadership: "bas",
    soutienhier: "bas", coopcoll: "bas", soutiencoll: "bas", confmgmt: "bas", justice: "bas", concil: "bas",
    insecur: "haut", engage: "bas", satisf: "bas", stress: "haut", epuise: "haut", santegen: "bas",
  },
  cbi: { pb: "haut", wb: "haut", cb: "haut" },
  flourishing: { fs: "bas" },
};

export function sensDefavorable(instrument: string, echelle: string): Sens | null {
  return SENS[instrument]?.[echelle] ?? null;
}

export const TABLEAU_SENS = SENS;
