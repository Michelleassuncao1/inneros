import path from "node:path";
import type { NextConfig } from "next";

// Branchement de next-intl sans son plugin : le plugin charge @swc/core, dont le module
// natif refuse de démarrer sur ce poste (droits Windows sur le dossier de cache).
// On déclare ici le même alias que le plugin : `next-intl/config` → i18n/request.ts.
const nextConfig: NextConfig = {
  // PGlite (base de développement) reste un module Node.js, hors des fichiers compilés
  serverExternalPackages: ["@electric-sql/pglite", "@react-pdf/renderer"],
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
