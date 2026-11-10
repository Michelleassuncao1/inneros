// Contrôle de sécurité avant chaque mise en ligne (étape 10) : npm run securite
// 1. Failles connues dans les modules qui partent en production (npm audit, gravité « élevée » ou « critique »).
// 2. Clés secrètes oubliées dans tout l'historique Git (toutes les branches) et fichiers .env enregistrés par erreur.
// Le rapport donne l'enregistrement, le fichier et le type de clé, jamais la valeur.
import { execFileSync, spawnSync } from "node:child_process";

const MOTIFS: { type: string; motif: RegExp }[] = [
  { type: "clé Anthropic", motif: /sk-ant-[A-Za-z0-9_-]{20,}/ },
  { type: "clé Brevo", motif: /xkeysib-[a-f0-9]{20,}/ },
  { type: "clé privée", motif: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/ },
  { type: "mot de passe dans une adresse de base", motif: /postgres(?:ql)?:\/\/[^:\s/"'`]+:([^@\s"'`]{6,})@/ },
  {
    type: "variable secrète renseignée",
    motif: /^\s*(?:AUTH_SECRET|TOTP_ENCRYPTION_KEY|CRON_SECRET|SAUVEGARDE_CLE|BREVO_API_KEY|ANTHROPIC_API_KEY|DATABASE_URL|DATABASE_MIGRATION_URL)=["']?[^\s"'#<]{8,}/,
  },
];
// Mots de passe d'exemple utilisés dans les tests et la documentation
const EXEMPLES = new Set(["secret", "motdepasse", "password"]);

function auditModules() {
  const r = spawnSync(process.platform === "win32" ? "npm.cmd" : "npm", ["audit", "--omit=dev", "--audit-level=high"], {
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  const resume = (r.stdout ?? "").trim().split("\n").slice(-3).join("\n");
  return { ok: r.status === 0, resume };
}

function rechercherCles() {
  const journal = execFileSync("git", ["log", "-p", "--all", "--no-color", "--no-textconv", "--format=ENREGISTREMENT %h"], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 1024,
  });
  const trouvailles = new Set<string>();
  let enregistrement = "";
  let fichier = "";
  for (const ligne of journal.split("\n")) {
    if (ligne.startsWith("ENREGISTREMENT ")) enregistrement = ligne.slice(15);
    else if (ligne.startsWith("+++ b/")) {
      fichier = ligne.slice(6);
      if (/(^|\/)\.env(\.|$)/.test(fichier) && !fichier.endsWith(".env.example")) trouvailles.add(`${enregistrement} ${fichier} : fichier .env enregistré`);
    } else if (ligne.startsWith("+") && !ligne.startsWith("+++")) {
      for (const { type, motif } of MOTIFS) {
        const m = ligne.slice(1).match(motif);
        if (m && !(m[1] && EXEMPLES.has(m[1]))) trouvailles.add(`${enregistrement} ${fichier} : ${type}`);
      }
    }
  }
  return [...trouvailles];
}

const audit = auditModules();
console.log(audit.ok ? "1. Modules de production : aucune faille élevée ou critique." : `1. Modules de production : FAILLES À CORRIGER\n${audit.resume}`);
const cles = rechercherCles();
console.log(cles.length === 0 ? "2. Historique Git : aucune clé secrète trouvée." : `2. Historique Git : ${cles.length} élément(s) à vérifier (la valeur n'est pas affichée) :\n- ${cles.join("\n- ")}`);
process.exit(audit.ok && cles.length === 0 ? 0 : 1);
