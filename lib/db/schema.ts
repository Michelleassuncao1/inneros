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
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// Seuil minimal absolu : aucune campagne ne peut descendre sous 10 (règle 3).
export const SEUIL_MINIMUM = 10;

// ─── Listes de valeurs autorisées ────────────────────────────────────────────

export const roleUtilisateur = pgEnum("user_role", ["admin", "referent"]);
export const pays = pgEnum("country", ["BE", "BR", "FR", "PT"]);
export const langue = pgEnum("locale", ["fr", "nl", "en", "pt-BR"]);
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
  "correction_requested", // demandée par le référent signataire après validation IMA (étape 8B)
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
    // Maîtrise de l'IA (article 4 AI Act) : date de la formation suivie ; requise pour valider un rapport
    aiLiteracyAt: date("ai_literacy_at"),
    aiLiteracyNote: text("ai_literacy_note"),
    // Référents seulement : conseiller en prévention de l'entreprise, autorisé à tenir le registre
    // des risques RPS avec IMA (module A1, décision du 19/10/2026)
    preventionAdvisor: boolean("prevention_advisor").notNull().default(false),
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
    check("users_conseiller_referent", sql`NOT ${t.preventionAdvisor} OR ${t.role} = 'referent'`),
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
    // Soutien affiché aux répondants (saisi par IMA, jamais par un répondant) :
    // contacts internes à l'organisation (personne de confiance, médecin du travail…)
    supportContacts: jsonb("support_contacts").notNull().default([]),
    // Accompagnement IMA facultatif (téléphone, e-mail, lien de rendez-vous, horaires)
    imaSupport: jsonb("ima_support"),
    aiDraftingEnabled: boolean("ai_drafting_enabled").notNull().default(true),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    // Nombre de codes distribués (actifs + utilisés), noté à la clôture puisque les jetons sont alors supprimés
    tokensIssued: integer("tokens_issued"),
    // Référent signataire du contrat : seul habilité à accepter le rapport au nom de l'entreprise
    signatoryReferentId: uuid("signatory_referent_id").references(() => users.id, { onDelete: "set null" }),
    // Délégation du signataire au conseiller en prévention : acceptation du rapport et adoption du plan
    // (une seule case, décision de Michelle du 21/10/2026)
    advisorDelegation: boolean("advisor_delegation").notNull().default(false),
    // Date de suppression des réponses brutes (agrégats et rapport conservés)
    rawDeletedAt: timestamp("raw_deleted_at", { withTimezone: true }),
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

// Comportements indésirables (COPSOQ français Q55 à Q62) : nombre de personnes concernées, pour toute
// la campagne seulement, jamais par groupe (décision de Michelle du 17/10/2026). « base » = personnes
// ayant répondu à la question ; base ≥ seuil de la campagne, vérifié par déclencheur (règle 3).
export const behaviourCounts = pgTable(
  "behaviour_counts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    instrumentId: uuid("instrument_id")
      .notNull()
      .references(() => instruments.id, { onDelete: "restrict" }),
    behaviourId: text("behaviour_id").notNull(), // dimension du questionnaire, ou « cumul »
    category: text("category").notNull(), // concernes, frequence_<code>, auteur_<code>, auteur_np, nombre_<n>
    count: integer("count").notNull(),
    base: integer("base").notNull(),
    scoringVersion: text("scoring_version").notNull(),
    computedAt: timestamp("computed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check("behaviour_counts_base_minimum", sql`${t.base} >= 10`),
    check("behaviour_counts_nombre", sql`${t.count} BETWEEN 0 AND ${t.base}`),
    check("behaviour_counts_categorie", sql`${t.category} ~ '^(concernes|auteur_np|(frequence|auteur|nombre)_[0-9]{1,2})$'`),
    unique("behaviour_counts_unique").on(t.campaignId, t.instrumentId, t.behaviourId, t.category),
  ],
);

// ─── Plan de prévention RPS (module A) ───────────────────────────────────────

export const sourceRisque = pgEnum("risk_source", ["echelle", "comportement", "manuel"]);
export const statutRisque = pgEnum("risk_status", ["ouvert", "traite", "clos"]);

// Registre des risques RPS d'une entreprise, évalués avec la matrice Kinney (Risque = P × E × G).
// Alimenté par les résultats collectifs des campagnes (jamais par des réponses individuelles) ou à la main.
// Les textes ne doivent citer personne (rappelé à la saisie).
export const risks = pgTable(
  "risks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    // Campagne et échelle d'origine (vides pour un risque ajouté à la main)
    campaignId: uuid("campaign_id").references(() => campaigns.id, { onDelete: "set null" }),
    instrumentId: uuid("instrument_id").references(() => instruments.id, { onDelete: "set null" }),
    scaleId: text("scale_id"),
    source: sourceRisque("source").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    mindsetLevel: text("mindset_level"),
    groupLabels: jsonb("group_labels").$type<string[]>().notNull().default([]),
    probability: numeric("probability", { precision: 4, scale: 1 }).notNull(),
    exposure: numeric("exposure", { precision: 4, scale: 1 }).notNull(),
    gravity: numeric("gravity", { precision: 4, scale: 1 }).notNull(),
    justification: text("justification"),
    status: statutRisque("status").notNull().default("ouvert"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Valeurs de la grille Kinney uniquement
    check("risks_probabilite", sql`${t.probability} IN (10, 6, 3, 1, 0.5, 0.2, 0.1)`),
    check("risks_exposition", sql`${t.exposure} IN (10, 6, 3, 2, 1, 0.5)`),
    check("risks_gravite", sql`${t.gravity} IN (100, 40, 15, 7, 3, 1)`),
    check("risks_titre", sql`length(${t.title}) BETWEEN 1 AND 200`),
    check("risks_textes", sql`coalesce(length(${t.description}), 0) <= 2000 AND coalesce(length(${t.justification}), 0) <= 2000`),
    // Un risque issu des résultats garde le nom de son échelle (la campagne peut être supprimée plus tard)
    check("risks_origine", sql`${t.source} = 'manuel' OR ${t.scaleId} IS NOT NULL`),
    // Une échelle d'une campagne n'entre qu'une fois dans le registre
    unique("risks_echelle_unique").on(t.organizationId, t.campaignId, t.instrumentId, t.scaleId),
  ],
);

// Plan de prévention RPS d'une entreprise (module A2) : plan global sur 5 ans et plan d'action de la
// première année, rédigés par l'IA ou à la main, validés par un praticien IMA formé à l'IA.
// Un seul plan validé à la fois par entreprise ; une nouvelle version validée remplace la précédente.
export const statutPlan = pgEnum("plan_status", ["draft", "ai_draft", "validated", "replaced", "rejected"]);

export const preventionPlans = pgTable(
  "prevention_plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    status: statutPlan("status").notNull(),
    country: pays("country").notNull(), // cadre légal suivi (pays de l'entreprise au moment de la rédaction)
    language: langue("language").notNull(),
    startYear: integer("start_year").notNull(), // plan global : startYear à startYear + 4
    // Année du plan d'action (module A3, partie 3) : startYear la première année, puis une nouvelle version
    // du plan par année suivante (même plan global, plan d'action de l'année actionYear)
    actionYear: integer("action_year").notNull(),
    content: jsonb("content").notNull(),
    // Rapport validé sur lequel le plan s'appuie (décision du 19/10/2026 : obligatoire)
    reportId: uuid("report_id").references(() => reports.id, { onDelete: "set null" }),
    aiModel: text("ai_model"),
    aiPromptVersion: text("ai_prompt_version"),
    aiGeneratedAt: timestamp("ai_generated_at", { withTimezone: true }),
    rejectionReason: text("rejection_reason"),
    validatedBy: uuid("validated_by").references(() => users.id, { onDelete: "set null" }),
    validatedAt: timestamp("validated_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    // Adoption par l'employeur (module A3) : signataire, ou conseiller en prévention par délégation
    adoptedBy: uuid("adopted_by").references(() => users.id, { onDelete: "set null" }),
    adoptedAt: date("adopted_at"),
    consultationBody: text("consultation_body"), // organe consulté (selon le pays)
    consultationDate: date("consultation_date"),
  },
  (t) => [
    check(
      "prevention_plans_organe",
      sql`${t.consultationBody} IS NULL OR ${t.consultationBody} IN ('cppt', 'delegation_syndicale', 'travailleurs', 'cse', 'aucun_cse', 'cipa', 'participation_travailleurs', 'representants_sst')`,
    ),
    check("prevention_plans_annee", sql`${t.startYear} BETWEEN 2020 AND 2100`),
    check("prevention_plans_annee_action", sql`${t.actionYear} BETWEEN ${t.startYear} AND ${t.startYear} + 4`),
    check(
      "prevention_plans_validation",
      sql`${t.status} NOT IN ('validated', 'replaced') OR ${t.validatedAt} IS NOT NULL`,
    ),
    uniqueIndex("prevention_plans_un_valide").on(t.organizationId).where(sql`${t.status} = 'validated'`),
  ],
);

// ─── Sensibilisation (module B) ──────────────────────────────────────────────

// Bibliothèque de thèmes de sensibilisation, tenue par IMA (module B1). Un thème n'est proposé aux
// entreprises qu'une fois validé par un praticien formé à l'IA. Contenu générique : aucune donnée d'entreprise.
export const statutTheme = pgEnum("theme_status", ["draft", "validated", "archived"]);

export const awarenessThemes = pgTable(
  "awareness_themes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull().unique(),
    status: statutTheme("status").notNull().default("draft"),
    sheet: jsonb("sheet").notNull(), // fiche : mois, journée, niveau MINDSET, échelles visées, sensible, pays
    kits: jsonb("kits").notNull().default({}), // { fr: Kit, nl: Kit, … }
    aiModel: text("ai_model"), // dernier brouillon rédigé avec l'IA
    aiPromptVersion: text("ai_prompt_version"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    validatedBy: uuid("validated_by").references(() => users.id, { onDelete: "set null" }),
    validatedAt: timestamp("validated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("awareness_themes_code", sql`${t.code} ~ '^[a-z0-9-]{3,40}$'`),
    check("awareness_themes_validation", sql`${t.status} <> 'validated' OR ${t.validatedAt} IS NOT NULL`),
  ],
);

// Calendrier de sensibilisation d'une entreprise (module B2) : une campagne = un thème validé à un mois donné.
// Tenu par le conseiller en prévention et IMA ; lu par les autres référents de l'entreprise.
// Origine : programmée (calendrier annuel), ajoutée à la main, ou déclenchée (module B3).
export const origineCampagneSensib = pgEnum("awareness_origin", ["programmee", "manuelle", "registre", "evenement", "alerte", "comportement"]);
export const statutCampagneSensib = pgEnum("awareness_status", ["prevue", "diffusee", "realisee", "retiree"]);

export const awarenessCampaigns = pgTable(
  "awareness_campaigns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    themeId: uuid("theme_id")
      .notNull()
      .references(() => awarenessThemes.id, { onDelete: "restrict" }),
    year: integer("year").notNull(),
    month: integer("month").notNull(),
    origin: origineCampagneSensib("origin").notNull(),
    originRef: text("origin_ref"), // risque, événement ou alerte à l'origine (module B3)
    status: statutCampagneSensib("status").notNull().default("prevue"),
    diffusedOn: date("diffused_on"),
    comment: text("comment"),
    planId: uuid("plan_id").references(() => preventionPlans.id, { onDelete: "set null" }), // plan de prévention lié (module B3)
    planActionId: text("plan_action_id"), // action de ce plan liée (module B3)
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("awareness_campaigns_mois", sql`${t.month} BETWEEN 1 AND 12 AND ${t.year} BETWEEN 2020 AND 2100`),
    check("awareness_campaigns_commentaire", sql`coalesce(length(${t.comment}), 0) <= 500`),
    check("awareness_campaigns_diffusion", sql`${t.diffusedOn} IS NULL OR ${t.status} IN ('diffusee', 'realisee')`),
    // Un thème au plus une fois par année dans le calendrier d'une entreprise
    unique("awareness_campaigns_unique").on(t.organizationId, t.themeId, t.year),
  ],
);

// Campagnes déclenchées (module B3, décisions de Michelle du 26/10/2026) : InnerOS propose, le conseiller en
// prévention (ou IMA) accepte ou refuse. Rien n'est ajouté seul au calendrier.

// Événements déclarés par le conseiller en prévention : un type et une date, jamais de nom ni de récit
export const typeEvenement = pgEnum("awareness_event_type", [
  "reorganisation",
  "licenciements",
  "fusion",
  "accident_grave",
  "agression",
  "forte_charge",
  "conflit_collectif",
  "cyberattaque",
  "deces",
]);

export const awarenessEvents = pgTable("awareness_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  type: typeEvenement("type").notNull(),
  occurredOn: date("occurred_on").notNull(),
  updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Alertes réglementaires rédigées par IMA, ciblées par pays et, au besoin, par secteur
export const awarenessAlerts = pgTable(
  "awareness_alerts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    message: text("message").notNull(),
    countries: jsonb("countries").$type<string[]>().notNull(),
    sectors: jsonb("sectors").$type<string[] | null>(), // null = tous les secteurs
    themeIds: jsonb("theme_ids").$type<string[]>().notNull(),
    year: integer("year").notNull(),
    month: integer("month").notNull(),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    withdrawnAt: timestamp("withdrawn_at", { withTimezone: true }),
  },
  (t) => [
    check("awareness_alerts_textes", sql`length(${t.title}) BETWEEN 3 AND 120 AND length(${t.message}) <= 1000`),
    check("awareness_alerts_mois", sql`${t.month} BETWEEN 1 AND 12 AND ${t.year} BETWEEN 2020 AND 2100`),
  ],
);

export const statutProposition = pgEnum("awareness_suggestion_status", ["en_attente", "acceptee", "refusee"]);

export const awarenessSuggestions = pgTable(
  "awareness_suggestions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    themeId: uuid("theme_id")
      .notNull()
      .references(() => awarenessThemes.id, { onDelete: "cascade" }),
    origin: origineCampagneSensib("origin").notNull(),
    originRef: uuid("origin_ref").notNull(), // risque, événement ou alerte
    year: integer("year").notNull(),
    month: integer("month").notNull(),
    priority: boolean("priority").notNull().default(false),
    status: statutProposition("status").notNull().default("en_attente"),
    campaignId: uuid("campaign_id").references(() => awarenessCampaigns.id, { onDelete: "set null" }),
    refusalReason: text("refusal_reason"),
    decidedBy: uuid("decided_by").references(() => users.id, { onDelete: "set null" }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("awareness_suggestions_origine", sql`${t.origin} IN ('registre', 'evenement', 'alerte', 'comportement')`),
    check("awareness_suggestions_mois", sql`${t.month} BETWEEN 1 AND 12 AND ${t.year} BETWEEN 2020 AND 2100`),
    check("awareness_suggestions_motif", sql`coalesce(length(${t.refusalReason}), 0) <= 300`),
    check("awareness_suggestions_decision", sql`(${t.status} = 'en_attente') = (${t.decidedAt} IS NULL)`),
    // Une même cause ne propose un thème qu'une fois
    unique("awareness_suggestions_unique").on(t.organizationId, t.themeId, t.origin, t.originRef),
  ],
);

// Avancement des actions d'un plan validé (module A3), mis à jour par IMA et le conseiller en prévention.
export const statutAction = pgEnum("action_status", ["a_faire", "en_cours", "realisee", "reportee", "abandonnee"]);

export const planActionStatus = pgTable(
  "plan_action_status",
  {
    planId: uuid("plan_id")
      .notNull()
      .references(() => preventionPlans.id, { onDelete: "cascade" }),
    actionId: text("action_id").notNull(), // identifiant de l'action dans le contenu du plan
    status: statutAction("status").notNull(),
    doneOn: date("done_on"),
    comment: text("comment"),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.planId, t.actionId] }),
    check("plan_action_status_commentaire", sql`coalesce(length(${t.comment}), 0) <= 500`),
    check("plan_action_status_date", sql`${t.doneOn} IS NULL OR ${t.status} = 'realisee'`),
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
    // Acceptation par l'entreprise (référent signataire désigné dans la campagne) : faits conformes au contrat.
    // Le délai de conservation des réponses brutes démarre à cette date.
    acceptedBy: uuid("accepted_by").references(() => users.id, { onDelete: "set null" }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    // Langue du rapport (fr, nl, en, pt-BR)
    language: text("language"),
    // Demande de correction du référent signataire (faits non conformes au contrat)
    correctionComment: text("correction_comment"),
    correctionRequestedAt: timestamp("correction_requested_at", { withTimezone: true }),
    correctionRequestedBy: uuid("correction_requested_by").references(() => users.id, { onDelete: "set null" }),
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
    // Un seul rapport validé par campagne
    uniqueIndex("reports_un_valide_par_campagne").on(t.campaignId).where(sql`${t.status} = 'validated'`),
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

// Formation « IMA Talks — Utiliser l'IA dans InnerOS » (article 4 AI Act) : une ligne par personne et par
// version de la formation. Lecture du guide, tentatives au quiz, réussite, enregistrement et certificat.
// Aucune donnée de santé ; le score seul est conservé, pas les réponses.
export const aiTrainingProgress = pgTable(
  "ai_training_progress",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    trainingId: text("training_id").notNull(),
    trainingVersion: text("training_version").notNull(),
    guideVersion: text("guide_version").notNull(),
    guideAckAt: timestamp("guide_ack_at", { withTimezone: true }),
    attempts: integer("attempts").notNull().default(0),
    bestScore: integer("best_score"),
    passedAt: timestamp("passed_at", { withTimezone: true }),
    generalTraining: text("general_training"),
    registeredAt: timestamp("registered_at", { withTimezone: true }),
    certificateCode: text("certificate_code").unique(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.trainingId, t.trainingVersion] }),
    check("ai_training_score", sql`${t.bestScore} IS NULL OR ${t.bestScore} BETWEEN 0 AND 100`),
    check("ai_training_formation", sql`coalesce(length(${t.generalTraining}), 0) <= 300`),
    // Enregistrement seulement après lecture du guide et réussite du quiz
    check("ai_training_ordre", sql`${t.registeredAt} IS NULL OR (${t.passedAt} IS NOT NULL AND ${t.guideAckAt} IS NOT NULL AND ${t.certificateCode} IS NOT NULL)`),
  ],
);

// ─── Ateliers avec QR code (module C, décisions de Michelle du 27/10/2026) ─────
// Le conseiller en prévention (ou IMA) crée l'atelier ; un lien et un QR code uniques servent avant l'atelier
// à s'inscrire, puis à donner un avis anonyme. Inscriptions et avis sont dans deux tables sans aucun lien.

export const typeAtelier = pgEnum("workshop_type", [
  "atelier_participatif",
  "quart_heure_bien_etre",
  "formation_managers",
  "groupe_expression",
  "conference",
  "yoga_guide",
  "pleine_conscience",
]);
export const statutAppuiIma = pgEnum("workshop_support_status", ["demande", "accepte", "refuse"]);

export const workshops = pgTable(
  "workshops",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    type: typeAtelier("type").notNull(),
    title: text("title").notNull(), // titre neutre, visible sur la page d'inscription
    description: text("description"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    durationMinutes: integer("duration_minutes").notNull(),
    place: text("place").notNull(), // salle, adresse ou visioconférence
    capacity: integer("capacity").notNull(),
    facilitator: text("facilitator"), // fonction de l'animateur (pas forcément un nom)
    // Code de la page publique (lien et QR code) : aléatoire, impossible à deviner
    publicCode: text("public_code").notNull().unique(),
    awarenessCampaignId: uuid("awareness_campaign_id").references(() => awarenessCampaigns.id, { onDelete: "set null" }),
    planId: uuid("plan_id").references(() => preventionPlans.id, { onDelete: "set null" }),
    planActionId: text("plan_action_id"),
    // Demande facultative d'appui ou d'un animateur IMA
    supportStatus: statutAppuiIma("support_status"),
    supportRequest: text("support_request"),
    supportReply: text("support_reply"),
    imaFacilitatorId: uuid("ima_facilitator_id").references(() => users.id, { onDelete: "set null" }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    reminderSentAt: timestamp("reminder_sent_at", { withTimezone: true }),
    // Après suppression des inscriptions (30 jours après l'atelier) : seuls ces nombres restent
    registrationsPurgedAt: timestamp("registrations_purged_at", { withTimezone: true }),
    registeredCount: integer("registered_count"),
    waitlistCount: integer("waitlist_count"),
    attendedCount: integer("attended_count"),
    feedbackPurgedAt: timestamp("feedback_purged_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("workshops_textes", sql`length(${t.title}) BETWEEN 3 AND 120 AND coalesce(length(${t.description}), 0) <= 1000 AND length(${t.place}) BETWEEN 2 AND 300 AND coalesce(length(${t.facilitator}), 0) <= 120`),
    check("workshops_appui", sql`coalesce(length(${t.supportRequest}), 0) <= 500 AND coalesce(length(${t.supportReply}), 0) <= 500`),
    check("workshops_nombres", sql`${t.capacity} BETWEEN 1 AND 500 AND ${t.durationMinutes} BETWEEN 5 AND 600`),
    check("workshops_action", sql`${t.planActionId} IS NULL OR ${t.planId} IS NOT NULL`),
  ],
);

export const statutInscription = pgEnum("workshop_registration_status", ["inscrit", "attente"]);

// Inscriptions : nom et e-mail professionnel, supprimés 30 jours après l'atelier. Une désinscription supprime la ligne.
export const workshopRegistrations = pgTable(
  "workshop_registrations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workshopId: uuid("workshop_id")
      .notNull()
      .references(() => workshops.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    locale: langue("locale").notNull(),
    status: statutInscription("status").notNull(),
    attended: boolean("attended").notNull().default(false),
    // Empreinte du lien de désinscription envoyé par e-mail
    cancelTokenHash: text("cancel_token_hash").notNull().unique(),
    reminderSentAt: timestamp("reminder_sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("workshop_registrations_unique").on(t.workshopId, t.email),
    check("workshop_registrations_textes", sql`length(${t.name}) BETWEEN 2 AND 120 AND length(${t.email}) <= 254 AND ${t.email} = lower(trim(${t.email}))`),
  ],
);

// Avis anonymes : la date du jour seulement, aucune donnée de connexion, aucun lien avec une inscription
export const workshopFeedback = pgTable(
  "workshop_feedback",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workshopId: uuid("workshop_id")
      .notNull()
      .references(() => workshops.id, { onDelete: "cascade" }),
    submittedOn: date("submitted_on").notNull(),
    answers: jsonb("answers").notNull(), // { utile: 1..5, clair: 1..5, … }
    comment: text("comment"),
  },
  (t) => [check("workshop_feedback_commentaire", sql`coalesce(length(${t.comment}), 0) <= 1000`)],
);
