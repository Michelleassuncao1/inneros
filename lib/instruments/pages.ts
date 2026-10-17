// Regroupement des dimensions en pages pour le répondant (décision de Michelle du 12 octobre 2026) :
// les noms des dimensions ne sont pas affichés (ils peuvent orienter les réponses) et les parties
// courtes sont regroupées. Une dimension n'est jamais coupée entre deux pages, et une nouvelle page
// commence quand la consigne change : une consigne ne doit jamais sembler s'appliquer à d'autres questions.
// Les comportements indésirables commencent aussi une nouvelle page (avec le rappel des personnes de soutien).
export const ITEMS_PAR_PAGE = 6;

export function regrouperEnPages<D extends { items: readonly unknown[]; consigne?: string; type?: string }>(
  dimensions: readonly D[],
  maximum = ITEMS_PAR_PAGE,
) {
  const pages: D[][] = [];
  let page: D[] = [];
  let nombre = 0;
  for (const d of dimensions) {
    if (page.length && (nombre + d.items.length > maximum || d.consigne !== page.at(-1)!.consigne || d.type !== page.at(-1)!.type)) {
      pages.push(page);
      page = [];
      nombre = 0;
    }
    page.push(d);
    nombre += d.items.length;
  }
  if (page.length) pages.push(page);
  return pages;
}

// Une consigne n'est répétée que si elle change d'une dimension à la suivante sur la même page
export function consignesAAfficher(dimensions: readonly { consigne?: string }[]) {
  return dimensions.map((d, i) => (d.consigne && d.consigne !== dimensions[i - 1]?.consigne ? d.consigne : undefined));
}
