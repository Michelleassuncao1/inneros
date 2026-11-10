// Règles de sécurité des pages (Content-Security-Policy, étape 10). Le navigateur n'exécute que les scripts
// portant le code unique (nonce) tiré à chaque visite : un script injecté ou venu d'un autre site est bloqué.
// Aucune ressource extérieure : polices servies par l'application, pas de service tiers dans le navigateur.
export function regleCsp(nonce: string, developpement = process.env.NODE_ENV !== "production") {
  return [
    "default-src 'self'",
    // 'unsafe-eval' seulement en développement (outils de React) ; 'strict-dynamic' : les scripts chargés par un script autorisé le sont aussi
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${developpement ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'", // styles en ligne de React et des polices
    "img-src 'self' data: blob:", // codes QR et aperçus générés dans la page
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(developpement ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export function nouveauNonce() {
  return btoa(crypto.randomUUID());
}
