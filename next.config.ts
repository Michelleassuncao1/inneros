import path from "node:path";
import type { NextConfig } from "next";

// Branchement de next-intl sans son plugin : le plugin charge @swc/core, dont le module
// natif refuse de démarrer sur ce poste (droits Windows sur le dossier de cache).
// On déclare ici le même alias que le plugin : `next-intl/config` → i18n/request.ts.
const nextConfig: NextConfig = {
  // PGlite (base de développement) reste un module Node.js, hors des fichiers compilés
  // Développement : autorise le test sur un téléphone du même réseau Wi-Fi (adresse locale du PC)
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*"],
  serverExternalPackages: ["@electric-sql/pglite", "@react-pdf/renderer"],
  // Le prompt système du rapport est lu sur le disque : il doit accompagner l'application en production
  outputFileTracingIncludes: { "/**": ["./prompts/**/*"] },
  // En-têtes de sécurité sur toutes les réponses (audit du 14/10/2026)
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // HTTPS obligatoire pendant 2 ans (ignoré par les navigateurs en HTTP, donc sans effet en développement)
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Aucune adresse transmise aux sites liés (numéros d'aide, prise de rendez-vous)
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
    ];
  },
  turbopack: {
    resolveAlias: {
      "next-intl/config": "./i18n/request.ts",
    },
  },
  webpack(config) {
    config.resolve.alias["next-intl/config"] = path.resolve(
      process.cwd(),
      "i18n/request.ts",
    );
    return config;
  },
};

export default nextConfig;
