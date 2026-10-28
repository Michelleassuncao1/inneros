CREATE TYPE "public"."workshop_support_status" AS ENUM('demande', 'accepte', 'refuse');--> statement-breakpoint
CREATE TYPE "public"."workshop_registration_status" AS ENUM('inscrit', 'attente');--> statement-breakpoint
CREATE TYPE "public"."workshop_type" AS ENUM('atelier_participatif', 'quart_heure_bien_etre', 'formation_managers', 'groupe_expression', 'conference', 'yoga_guide', 'pleine_conscience');--> statement-breakpoint
CREATE TABLE "workshop_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workshop_id" uuid NOT NULL,
	"submitted_on" date NOT NULL,
	"answers" jsonb NOT NULL,
	"comment" text,
	CONSTRAINT "workshop_feedback_commentaire" CHECK (coalesce(length("workshop_feedback"."comment"), 0) <= 1000)
);
--> statement-breakpoint
CREATE TABLE "workshop_registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workshop_id" uuid NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"locale" "locale" NOT NULL,
	"status" "workshop_registration_status" NOT NULL,
	"attended" boolean DEFAULT false NOT NULL,
	"cancel_token_hash" text NOT NULL,
	"reminder_sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workshop_registrations_cancel_token_hash_unique" UNIQUE("cancel_token_hash"),
	CONSTRAINT "workshop_registrations_unique" UNIQUE("workshop_id","email"),
	CONSTRAINT "workshop_registrations_textes" CHECK (length("workshop_registrations"."name") BETWEEN 2 AND 120 AND length("workshop_registrations"."email") <= 254 AND "workshop_registrations"."email" = lower(trim("workshop_registrations"."email")))
);
--> statement-breakpoint
CREATE TABLE "workshops" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"type" "workshop_type" NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"starts_at" timestamp with time zone NOT NULL,
	"duration_minutes" integer NOT NULL,
	"place" text NOT NULL,
	"capacity" integer NOT NULL,
	"facilitator" text,
	"public_code" text NOT NULL,
	"awareness_campaign_id" uuid,
	"plan_id" uuid,
	"plan_action_id" text,
	"support_status" "workshop_support_status",
	"support_request" text,
	"support_reply" text,
	"ima_facilitator_id" uuid,
	"cancelled_at" timestamp with time zone,
	"reminder_sent_at" timestamp with time zone,
	"registrations_purged_at" timestamp with time zone,
	"registered_count" integer,
	"waitlist_count" integer,
	"attended_count" integer,
	"feedback_purged_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workshops_public_code_unique" UNIQUE("public_code"),
	CONSTRAINT "workshops_textes" CHECK (length("workshops"."title") BETWEEN 3 AND 120 AND coalesce(length("workshops"."description"), 0) <= 1000 AND length("workshops"."place") BETWEEN 2 AND 300 AND coalesce(length("workshops"."facilitator"), 0) <= 120),
	CONSTRAINT "workshops_appui" CHECK (coalesce(length("workshops"."support_request"), 0) <= 500 AND coalesce(length("workshops"."support_reply"), 0) <= 500),
	CONSTRAINT "workshops_nombres" CHECK ("workshops"."capacity" BETWEEN 1 AND 500 AND "workshops"."duration_minutes" BETWEEN 5 AND 600),
	CONSTRAINT "workshops_action" CHECK ("workshops"."plan_action_id" IS NULL OR "workshops"."plan_id" IS NOT NULL)
);
--> statement-breakpoint
ALTER TABLE "workshop_feedback" ADD CONSTRAINT "workshop_feedback_workshop_id_workshops_id_fk" FOREIGN KEY ("workshop_id") REFERENCES "public"."workshops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workshop_registrations" ADD CONSTRAINT "workshop_registrations_workshop_id_workshops_id_fk" FOREIGN KEY ("workshop_id") REFERENCES "public"."workshops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workshops" ADD CONSTRAINT "workshops_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workshops" ADD CONSTRAINT "workshops_awareness_campaign_id_awareness_campaigns_id_fk" FOREIGN KEY ("awareness_campaign_id") REFERENCES "public"."awareness_campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workshops" ADD CONSTRAINT "workshops_plan_id_prevention_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."prevention_plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workshops" ADD CONSTRAINT "workshops_ima_facilitator_id_users_id_fk" FOREIGN KEY ("ima_facilitator_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workshops" ADD CONSTRAINT "workshops_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workshops" ADD CONSTRAINT "workshops_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

-- Seuls IMA et le conseiller en prévention de l'entreprise créent et modifient un atelier (même règle que le
-- registre). Les colonnes tenues par les tâches programmées (rappel, suppression) ne déclenchent pas le contrôle.
CREATE TRIGGER workshops_auteur_autorise
  BEFORE INSERT OR UPDATE OF type, title, description, starts_at, duration_minutes, place, capacity, facilitator,
    awareness_campaign_id, plan_id, plan_action_id, support_request, cancelled_at, updated_by ON workshops
  FOR EACH ROW EXECUTE FUNCTION inneros_controle_auteur_risque();
