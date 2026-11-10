// Tests des règles de sécurité des pages et de la vérification des clés de production (étape 10).
import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { nouveauNonce, regleCsp } from "./csp";
import { problemesVariables } from "./variables";

describe("règles de sécurité des pages (CSP)", () => {
  it("en production : scripts limités au code unique, aucune ressource extérieure, pas d'eval", () => {
    const r = regleCsp("abc123", false);
    expect(r).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
    expect(r).not.toContain("unsafe-eval");
    expect(r).toContain("frame-ancestors 'none'");
    expect(r).toContain("object-src 'none'");
    expect(r).toContain("upgrade-insecure-requests");
    expect(r).not.toMatch(/https?:/);
  });

  it("un code différent à chaque visite", () => {
    expect(nouveauNonce()).not.toBe(nouveauNonce());
  });
});

describe("clés de production", () => {
  const complet = {
    AUTH_SECRET: "a".repeat(40),
    TOTP_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
    CRON_SECRET: "c".repeat(40),
    DATABASE_URL: "postgres://inneros_app:x@hote/inneros?sslmode=require",
    BREVO_API_KEY: "cle-test",
    EMAIL_FROM: "PluriPrev <noreply@exemple.test>",
    APP_URL: "https://app.exemple.test",
    ANTHROPIC_API_KEY: "cle-test",
  };

  it("accepte une configuration complète", () => {
    expect(problemesVariables(complet)).toEqual([]);
  });

  it("nomme chaque variable manquante sans jamais afficher de valeur", () => {
    const p = problemesVariables({ ...complet, AUTH_SECRET: "zq9secret", CRON_SECRET: undefined, APP_URL: "http://app.exemple.test", PGLITE_DIR: ".data/x" });
    expect(p.map((m) => m.split(" ")[0])).toEqual(["AUTH_SECRET", "CRON_SECRET", "APP_URL", "PGLITE_DIR"]);
    expect(p.join(" ")).not.toContain("zq9secret");
  });

  it("la clé Anthropic n'est exigée que si l'IA est activée", () => {
    const sansIa = { ...complet, ANTHROPIC_API_KEY: undefined };
    expect(problemesVariables(sansIa)).toHaveLength(1);
    expect(problemesVariables({ ...sansIa, AI_DRAFTING_ENABLED: "false" })).toEqual([]);
  });
});
