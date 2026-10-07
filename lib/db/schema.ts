// Schéma de la base InnerOS (étape 2).
// Règles CLAUDE.md appliquées ici : 1 (anonymat), 2 (découplage jeton / réponse), 3 (seuil de 10).
// Les garde-fous qui comparent deux tables (seuil de la campagne, rôle du validateur)
// sont des déclencheurs SQL dans drizzle/0001_garde-fous.sql.

import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  foreignKey,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

// Seuil minimal absolu : aucune campagne ne peut descendre sous 10 (règle 3).
export const SEUIL_MINIMUM = 10;

// ─── Listes de valeurs autorisées ────────────────────────────────────────────

export const roleUtilisateur = pgEnum("user_role", ["admin", "referent"]);
export const pays = pgEnum("country", ["BE", "BR", "FR", "PT"]);
export const langue = pgEnum("locale", ["fr", "pt-BR"]);
export const trancheEffectif = pgEnum("size_band", [
  "lt50",
  "50-249",
  "250-999",
  "1000+",
]);
export const typeMandat = pgEnum("mandate_type", ["flash", "n1", "n2", "n3"]);
// Critère de regroupement : tous les groupes d'une campagne suivent un seul critère,
// pour qu'un répondant ne puisse se reconnaître que dans un seul groupe
export const critereRegroupement = pgEnum("grouping_criterion", [
  "service",
  "department",
  "direction",
  "site",
  "function",
  "other",
]);
export const statutCampagne = pgEnum("campaign_status", [
  "draft",
  "open",
  "closed",
]);
export const statutJeton = pgEnum("token_status", [
  "active",
  "consumed",
  "revoked",
]);
export const statutRapport = pgEnum("report_status", [
  "draft",
  "ai_draft",
  "rejected",
  "validated",
]);

// ─── Côté IMA et entreprises ─────────────────────────────────────────────────

// Entreprise cliente. `internal_code` remplace le nom dans tout envoi à l'IA (règle 5).
export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  internalCode: text("internal_code").notNull().unique(),
  name: text("name").notNull(),
  country: pays("country").notNull(),
  locale: langue("locale").notNull(),
  sector: text("sector").notNull(),
  sizeBand: trancheEffectif("size_band").notNull(),
  contractEndDate: date("contract_end_date"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Administrateurs IMA et référents entreprise. Jamais de répondant ici.
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull().unique(),
    name: text("name").notNull(),
    role: roleUtilisateur("role").notNull(),
    // Administrateurs seulement : mot de passe haché et secret TOTP chiffré (étape 3)
    passwordHash: text("password_hash"),
    totpSecretEncrypted: text("totp_secret_encrypted"),
    totpEnabled: boolean("totp_enabled").notNull().default(false),
    // Dernier pas de temps TOTP accepté : un même code ne sert jamais deux fois
    totpLastStep: integer("totp_last_step"),
    // Référents seulement : l'entreprise qu'ils représentent
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "restrict",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    disabledAt: timestamp("disabled_at", { withTimezone: true }),
  },
  (t) => [
    // Un administrateur n'est rattaché à aucune entreprise ;
    // un référent est rattaché à une entreprise et n'a pas de mot de passe (lien magique).
    check(
      "users_role_coherent",
      sql`(${t.role} = 'admin' AND ${t.organizationId} IS NULL)
       OR (${t.role} = 'referent' AND ${t.organizationId} IS NOT NULL AND ${t.passwordHash} IS NULL)`,
    ),
    // Adresses toujours enregistrées en minuscules, sans espaces
    check("users_email_normalise", sql`${t.email} = lower(trim(${t.email}))`),
  ],
);

// Liens de connexion des référents : empreinte seulement, 15 minutes, usage unique (F2).
export const loginLinks = pgTable("login_links", {
  id: uuid("id").primaryKey().defaultRandom(),
  tokenHash: text("token_hash").notNull().unique(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
});

// Compteur d'échecs de connexion, par adresse (empreinte de l'adresse, jamais l'adresse elle-même).
export const loginAttempts = pgTable("login_attempts", {
  key: text("key").primaryKey(),
  failures: integer("failures").notNull().default(0),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
});

// Questionnaires : une ligne par instrument et par version.
// `definitions` contient le fichier JSON de chaque langue : { "fr": {...}, "pt-BR": {...} }.
// Les identifiants d'items sont les mêmes dans toutes les langues.
export const instruments = pgTable(
  "instruments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull(), // copsoq3, cbi, flourishing
    version: text("version").notNull(),
    source: text("source").notNull(), // citation à reproduire dans le questionnaire et le rapport
    license: text("license").notNull(),
    isTest: boolean("is_test").notNull().default(false), // items fictifs « ITEM DE TEST »
    definitions: jsonb("definitions").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique("instruments_code_version").on(t.code, t.version)],
);

// Campagne liée à un mandat IMA.
export const campaigns = pgTable(
  "campaigns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    mandateType: typeMandat("mandate_type").notNull(),
    mandateReference: text("mandate_reference").notNull(),
    // Contexte du mandat transmis à l'IA (règle 5)
    diagnosticQuestion: text("diagnostic_question"),
    perimeter: text("perimeter"),
    groupMinSize: integer("group_min_size").notNull().default(SEUIL_MINIMUM),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    locales: langue("locales").array().notNull(),
    status: statutCampagne("status").notNull().default("draft"),
    // Date de validation du mandat (porte P1) : obligatoire pour ouvrir la campagne
    mandateValidatedOn: date("mandate_validated_on"),
    groupingCriterion: critereRegroupement("grouping_criterion").notNull().default("service"),
    aiDraftingEnabled: boolean("ai_drafting_enabled").notNull().default(true),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
  },
  (t) => [
    check("campaigns_seuil_minimum", sql`${t.groupMinSize} >= 10`),
    check("campaigns_dates", sql`${t.endDate} >= ${t.startDate}`),
    check("campaigns_langues", sql`cardinality(${t.locales}) >= 1`),
    // Une campagne ne s'ouvre jamais sans mandat validé (P0 → P1)
    check(
      "campaigns_ouverture_mandat",
      sql`${t.status} = 'draft' OR ${t.mandateValidatedOn} IS NOT NULL`,
    ),
  ],
);

// Référents ayant accès au rapport validé de la campagne (un référent d'une autre
// entreprise est refusé par déclencheur : drizzle/0004_referents-campagne.sql).
export const campaignReferents = pgTable(
  "campaign_referents",
  {
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.campaignId, t.userId] })],
);

// Questionnaires choisis pour une campagne.
export const campaignInstruments = pgTable(
  "campaign_instruments",
  {
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    instrumentId: uuid("instrument_id")
      .notNull()
      .references(() => instruments.id, { onDelete: "restrict" }),
  },
  (t) => [primaryKey({ columns: [t.campaignId, t.instrumentId] })],
);

// Groupe de répondants (service, site, fonction).
// Effectif prévu ≥ seuil de la campagne : vérifié par déclencheur (0001_garde-fous.sql).
export const groups = pgTable(
  "groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    expectedSize: integer("expected_size").notNull(),
  },
  (t) => [
    check("groups_effectif_minimum", sql`${t.expectedSize} >= 10`),
    unique("groups_libelle_unique").on(t.campaignId, t.label),
    // Permet aux réponses de vérifier que le groupe appartient bien à leur campagne
    unique("groups_id_campagne").on(t.id, t.campaignId),
  ],
);

// ─── Côté répondants : le cœur de l'anonymat ─────────────────────────────────

// Jeton à usage unique. Seule son empreinte est stockée : le code distribué est introuvable.
// Rattaché à sa campagne, JAMAIS à une réponse (règle 2). Aucune heure d'utilisation.
export const tokens = pgTable("tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  campaignId: uuid("campaign_id")
    .notNull()
    .references(() => campaigns.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  status: statutJeton("status").notNull().default("active"),
  expiresOn: date("expires_on").notNull(),
});

// Réponse anonyme : campagne, groupe, date du jour, versions des questionnaires.
// Aucun nom, e-mail, IP, navigateur, heure précise, langue, ni lien vers un jeton (règles 1 et 2).
// Identifiant aléatoire : l'ordre d'arrivée des réponses ne peut pas être reconstitué.
export const responses = pgTable(
  "responses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    groupId: uuid("group_id").notNull(),
    responseDate: date("response_date")
      .notNull()
      .default(sql`CURRENT_DATE`),
    // Exemple : { "copsoq3": "be-2024", "cbi": "1.0" } — sans la langue
    instrumentVersions: jsonb("instrument_versions").notNull(),
  },
  (t) => [
    // Le groupe choisi doit appartenir à la même campagne
    foreignKey({
      name: "responses_groupe_de_la_campagne",
      columns: [t.groupId, t.campaignId],
      foreignColumns: [groups.id, groups.campaignId],
    }).onDelete("cascade"),
  ],
);

// Réponse à une question : uniquement un nombre, ou vide pour « je préfère ne pas répondre ».
// Aucun champ de texte libre (règle 1).
export const answers = pgTable(
  "answers",
  {
    responseId: uuid("response_id")
      .notNull()
      .references(() => responses.id, { onDelete: "cascade" }),
    itemId: text("item_id").notNull(),
    value: smallint("value"), // NULL = « je préfère ne pas répondre »
  },
  (t) => [
    primaryKey({ columns: [t.responseId, t.itemId] }),
    // L'identifiant d'item est un code court, jamais une phrase
    check("answers_item_code", sql`${t.itemId} ~ '^[a-z0-9_]{1,40}$'`),
    check("answers_valeur", sql`${t.value} IS NULL OR ${t.value} BETWEEN 0 AND 10`),
  ],
);

// ─── Résultats et suivi ──────────────────────────────────────────────────────

// Score collectif d'une échelle pour un groupe (ou pour toute la campagne si group_id est vide).
// Effectif ≥ seuil de la campagne : vérifié par déclencheur (règle 3).
export const aggregates = pgTable(
  "aggregates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    groupId: uuid("group_id").references(() => groups.id, {
      onDelete: "cascade",
    }),
    instrumentId: uuid("instrument_id")
      .notNull()
      .references(() => instruments.id, { onDelete: "restrict" }),
    scaleId: text("scale_id").notNull(),
    n: integer("n").notNull(),
    mean: numeric("mean", { precision: 6, scale: 2 }).notNull(),
    sd: numeric("sd", { precision: 6, scale: 2 }).notNull(),
    shareAboveThreshold: numeric("share_above_threshold", {
      precision: 5,
      scale: 2,
    }), // en %, vide si aucun seuil de vigilance
    scoringVersion: text("scoring_version").notNull(),
    computedAt: timestamp("computed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check("aggregates_effectif_minimum", sql`${t.n} >= 10`),
    check(
      "aggregates_part",
      sql`${t.shareAboveThreshold} IS NULL OR ${t.shareAboveThreshold} BETWEEN 0 AND 100`,
    ),
    unique("aggregates_unique")
      .on(t.campaignId, t.groupId, t.instrumentId, t.scaleId)
      .nullsNotDistinct(),
  ],
);

// Rapport : brouillon IA éventuel, texte validé, traçabilité IA, validation humaine (règles 6 à 8).
export const reports = pgTable(
  "reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    status: statutRapport("status").notNull().default("draft"),
    // Brouillon IA et sa traçabilité (vides si le rapport est rédigé à la main)
    aiDraft: jsonb("ai_draft"),
    aiModel: text("ai_model"),
    aiPromptVersion: text("ai_prompt_version"),
    aiGeneratedAt: timestamp("ai_generated_at", { withTimezone: true }),
    finalText: text("final_text"),
    rejectionReason: text("rejection_reason"),
    // Liste de contrôle obligatoire avant validation
    checkSourcesVerified: boolean("check_sources_verified")
      .notNull()
      .default(false),
    checkNoSmallGroup: boolean("check_no_small_group").notNull().default(false),
    checkLanguageRule: boolean("check_language_rule").notNull().default(false),
    checkLimitsMentioned: boolean("check_limits_mentioned")
      .notNull()
      .default(false),
    validatedBy: uuid("validated_by").references(() => users.id, {
      onDelete: "restrict",
    }),
    validatedAt: timestamp("validated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Pas de validation sans liste de contrôle complète, validateur, date et texte final
    check(
      "reports_validation_complete",
      sql`${t.status} <> 'validated' OR (
        ${t.checkSourcesVerified} AND ${t.checkNoSmallGroup}
        AND ${t.checkLanguageRule} AND ${t.checkLimitsMentioned}
        AND ${t.validatedBy} IS NOT NULL AND ${t.validatedAt} IS NOT NULL
        AND ${t.finalText} IS NOT NULL AND length(trim(${t.finalText})) > 0
      )`,
    ),
    // Un refus est toujours motivé
    check(
      "reports_refus_motive",
      sql`${t.status} <> 'rejected' OR length(trim(coalesce(${t.rejectionReason}, ''))) > 0`,
    ),
  ],
);

// Journal des actions des administrateurs et référents. Les répondants n'y figurent jamais.
export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  actorUserId: uuid("actor_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  action: text("action").notNull(),
  targetType: text("target_type"),
  targetId: uuid("target_id"),
  details: jsonb("details"),
});
