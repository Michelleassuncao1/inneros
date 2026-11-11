// Signalement d'une erreur du navigateur (pages d'erreur). Les erreurs du serveur (avec « digest »)
// sont déjà enregistrées par instrumentation.ts : on ne les envoie pas une deuxième fois.
export function signalerErreur(erreur: Error & { digest?: string }) {
  if (erreur.digest) return;
  fetch("/api/erreurs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ route: window.location.pathname, type: erreur.name }),
    keepalive: true,
  }).catch(() => {});
}
