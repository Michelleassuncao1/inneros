CREATE TYPE "public"."locale" AS ENUM('fr', 'pt-BR');--> statement-breakpoint
CREATE TYPE "public"."country" AS ENUM('BE', 'BR', 'FR', 'PT');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'referent');--> statement-breakpoint
CREATE TYPE "public"."campaign_status" AS ENUM('draft', 'open', 'closed');--> statement-breakpoint
CREATE TYPE "public"."token_status" AS ENUM('active', 'consumed', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('draft', 'ai_draft', 'rejected', 'validated');--> statement-breakpoint
CREATE TYPE "public"."size_band" AS ENUM('lt50', '50-249', '250-999', '1000+');--> statement-breakpoint
CREATE TYPE "public"."mandate_type" AS ENUM('flash', 'n1', 'n2', 'n3');--> statement-breakpoint
CREATE TABLE "aggregates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"group_id" uuid,
	"instrument_id" uuid NOT NULL,
	"scale_id" text NOT NULL,
	"n" integer NOT NULL,
	"mean" numeric(6, 2) NOT NULL,
	"sd" numeric(6, 2) NOT NULL,
	"share_above_threshold" numeric(5, 2),
	"scoring_version" text NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "aggregates_unique" UNIQUE NULLS NOT DISTINCT("campaign_id","group_id","instrument_id","scale_id"),
	CONSTRAINT "aggregates_effectif_minimum" CHECK ("aggregates"."n" >= 10),
	CONSTRAINT "aggregates_part" CHECK ("aggregates"."share_above_threshold" IS NULL OR "aggregates"."share_above_threshold" BETWEEN 0 AND 100)
);
--> statement-breakpoint
CREATE TABLE "answers" (
	"response_id" uuid NOT NULL,
	"item_id" text NOT NULL,
	"value" smallint,
	CONSTRAINT "answers_response_id_item_id_pk" PRIMARY KEY("response_id","item_id"),
	CONSTRAINT "answers_item_code" CHECK ("answers"."item_id" ~ '^[a-z0-9_]{1,40}$'),
	CONSTRAINT "answers_valeur" CHECK ("answers"."value" IS NULL OR "answers"."value" BETWEEN 0 AND 10)
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_user_id" uuid,
	"action" text NOT NULL,
	"target_type" text,
	"target_id" uuid,
	"details" jsonb
);
--> statement-breakpoint
CREATE TABLE "campaign_instruments" (
	"campaign_id" uuid NOT NULL,
	"instrument_id" uuid NOT NULL,
	CONSTRAINT "campaign_instruments_campaign_id_instrument_id_pk" PRIMARY KEY("campaign_id","instrument_id")
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"mandate_type" "mandate_type" NOT NULL,
	"mandate_reference" text NOT NULL,
	"diagnostic_question" text,
	"perimeter" text,
	"group_min_size" integer DEFAULT 10 NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"locales" "locale"[] NOT NULL,
	"status" "campaign_status" DEFAULT 'draft' NOT NULL,
	"ai_drafting_enabled" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	CONSTRAINT "campaigns_seuil_minimum" CHECK ("campaigns"."group_min_size" >= 10),
	CONSTRAINT "campaigns_dates" CHECK ("campaigns"."end_date" >= "campaigns"."start_date"),
	CONSTRAINT "campaigns_langues" CHECK (cardinality("campaigns"."locales") >= 1)
);
--> statement-breakpoint
CREATE TABLE "groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"label" text NOT NULL,
	"expected_size" integer NOT NULL,
	CONSTRAINT "groups_libelle_unique" UNIQUE("campaign_id","label"),
	CONSTRAINT "groups_id_campagne" UNIQUE("id","campaign_id"),
	CONSTRAINT "groups_effectif_minimum" CHECK ("groups"."expected_size" >= 10)
);
--> statement-breakpoint
CREATE TABLE "instruments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"version" text NOT NULL,
	"source" text NOT NULL,
	"license" text NOT NULL,
	"is_test" boolean DEFAULT false NOT NULL,
	"definitions" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "instruments_code_version" UNIQUE("code","version")
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"internal_code" text NOT NULL,
	"name" text NOT NULL,
	"country" "country" NOT NULL,
	"locale" "locale" NOT NULL,
	"sector" text NOT NULL,
	"size_band" "size_band" NOT NULL,
	"contract_end_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_internal_code_unique" UNIQUE("internal_code")
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"status" "report_status" DEFAULT 'draft' NOT NULL,
	"ai_draft" jsonb,
	"ai_model" text,
	"ai_prompt_version" text,
	"ai_generated_at" timestamp with time zone,
	"final_text" text,
	"rejection_reason" text,
	"check_sources_verified" boolean DEFAULT false NOT NULL,
	"check_no_small_group" boolean DEFAULT false NOT NULL,
	"check_language_rule" boolean DEFAULT false NOT NULL,
	"check_limits_mentioned" boolean DEFAULT false NOT NULL,
	"validated_by" uuid,
	"validated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reports_validation_complete" CHECK ("reports"."status" <> 'validated' OR (
        "reports"."check_sources_verified" AND "reports"."check_no_small_group"
        AND "reports"."check_language_rule" AND "reports"."check_limits_mentioned"
        AND "reports"."validated_by" IS NOT NULL AND "reports"."validated_at" IS NOT NULL
        AND "reports"."final_text" IS NOT NULL AND length(trim("reports"."final_text")) > 0
      )),
	CONSTRAINT "reports_refus_motive" CHECK ("reports"."status" <> 'rejected' OR length(trim(coalesce("reports"."rejection_reason", ''))) > 0)
);
--> statement-breakpoint
CREATE TABLE "responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"response_date" date DEFAULT CURRENT_DATE NOT NULL,
	"instrument_versions" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"status" "token_status" DEFAULT 'active' NOT NULL,
	"expires_on" date NOT NULL,
	CONSTRAINT "tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"role" "user_role" NOT NULL,
	"password_hash" text,
	"totp_secret_encrypted" text,
	"totp_enabled" boolean DEFAULT false NOT NULL,
	"organization_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"disabled_at" timestamp with time zone,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_role_coherent" CHECK (("users"."role" = 'admin' AND "users"."organization_id" IS NULL)
       OR ("users"."role" = 'referent' AND "users"."organization_id" IS NOT NULL AND "users"."password_hash" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "aggregates" ADD CONSTRAINT "aggregates_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aggregates" ADD CONSTRAINT "aggregates_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aggregates" ADD CONSTRAINT "aggregates_instrument_id_instruments_id_fk" FOREIGN KEY ("instrument_id") REFERENCES "public"."instruments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "answers" ADD CONSTRAINT "answers_response_id_responses_id_fk" FOREIGN KEY ("response_id") REFERENCES "public"."responses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_instruments" ADD CONSTRAINT "campaign_instruments_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_instruments" ADD CONSTRAINT "campaign_instruments_instrument_id_instruments_id_fk" FOREIGN KEY ("instrument_id") REFERENCES "public"."instruments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_validated_by_users_id_fk" FOREIGN KEY ("validated_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "responses" ADD CONSTRAINT "responses_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "responses" ADD CONSTRAINT "responses_groupe_de_la_campagne" FOREIGN KEY ("group_id","campaign_id") REFERENCES "public"."groups"("id","campaign_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tokens" ADD CONSTRAINT "tokens_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;