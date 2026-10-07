import { defineConfig } from "vitest/config";

// Chaque test crée sa propre base PGlite en mémoire : on laisse plus que les 5 secondes par défaut,
// pour éviter les faux échecs quand plusieurs fichiers de tests tournent en parallèle.
export default defineConfig({
  test: {
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
