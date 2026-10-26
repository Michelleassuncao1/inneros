CREATE TYPE "public"."awareness_suggestion_status" AS ENUM('en_attente', 'acceptee', 'refusee');--> statement-breakpoint
CREATE TYPE "public"."awareness_event_type" AS ENUM('reorganisation', 'licenciements', 'fusion', 'accident_grave', 'agression', 'forte_charge', 'conflit_collectif', 'cyberattaque', 'deces');--> statement-breakpoint
CREATE TABLE "awareness_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"countries" jsonb NOT NULL,
	"sectors" jsonb,
	"theme_ids" jsonb NOT NULL,
	"year" integer NOT NULL,
	"month" integer NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"withdrawn_at" timestamp with time zone,
	CONSTRAINT "awareness_alerts_textes" CHECK (length("awareness_alerts"."title") BETWEEN 3 AND 120 AND length("awareness_alerts"."message") <= 1000),
	CONSTRAINT "awareness_alerts_mois" CHECK ("awareness_alerts"."month" BETWEEN 1 AND 12 AND "awareness_alerts"."year" BETWEEN 2020 AND 2100)
);
--> statement-breakpoint
CREATE TABLE "awareness_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"type" "awareness_event_type" NOT NULL,
	"occurred_on" date NOT NULL,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "awareness_suggestions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"theme_id" uuid NOT NULL,
	"origin" "awareness_origin" NOT NULL,
	"origin_ref" uuid NOT NULL,
	"year" integer NOT NULL,
	"month" integer NOT NULL,
	"priority" boolean DEFAULT false NOT NULL,
	"status" "awareness_suggestion_status" DEFAULT 'en_attente' NOT NULL,
	"campaign_id" uuid,
	"refusal_reason" text,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "awareness_suggestions_unique" UNIQUE("organization_id","theme_id","origin","origin_ref"),
	CONSTRAINT "awareness_suggestions_origine" CHECK ("awareness_suggestions"."origin" IN ('registre', 'evenement', 'alerte', 'comportement')),
	CONSTRAINT "awareness_suggestions_mois" CHECK ("awareness_suggestions"."month" BETWEEN 1 AND 12 AND "awareness_suggestions"."year" BETWEEN 2020 AND 2100),
	CONSTRAINT "awareness_suggestions_motif" CHECK (coalesce(length("awareness_suggestions"."refusal_reason"), 0) <= 300),
	CONSTRAINT "awareness_suggestions_decision" CHECK (("awareness_suggestions"."status" = 'en_attente') = ("awareness_suggestions"."decided_at" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "awareness_campaigns" ADD COLUMN "plan_id" uuid;--> statement-breakpoint
ALTER TABLE "awareness_alerts" ADD CONSTRAINT "awareness_alerts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "awareness_events" ADD CONSTRAINT "awareness_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "awareness_events" ADD CONSTRAINT "awareness_events_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "awareness_suggestions" ADD CONSTRAINT "awareness_suggestions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "awareness_suggestions" ADD CONSTRAINT "awareness_suggestions_theme_id_awareness_themes_id_fk" FOREIGN KEY ("theme_id") REFERENCES "public"."awareness_themes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "awareness_suggestions" ADD CONSTRAINT "awareness_suggestions_campaign_id_awareness_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."awareness_campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "awareness_suggestions" ADD CONSTRAINT "awareness_suggestions_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "awareness_campaigns" ADD CONSTRAINT "awareness_campaigns_plan_id_prevention_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."prevention_plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

-- Seuls IMA et le conseiller en prévention de l'entreprise déclarent des événements (même règle que le registre)
CREATE TRIGGER awareness_events_auteur_autorise
  BEFORE INSERT OR UPDATE ON awareness_events
  FOR EACH ROW EXECUTE FUNCTION inneros_controle_auteur_risque();
