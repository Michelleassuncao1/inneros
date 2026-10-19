CREATE TYPE "public"."plan_status" AS ENUM('draft', 'ai_draft', 'validated', 'replaced', 'rejected');--> statement-breakpoint
CREATE TABLE "prevention_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"status" "plan_status" NOT NULL,
	"country" "country" NOT NULL,
	"language" "locale" NOT NULL,
	"start_year" integer NOT NULL,
	"content" jsonb NOT NULL,
	"report_id" uuid,
	"ai_model" text,
	"ai_prompt_version" text,
	"ai_generated_at" timestamp with time zone,
	"rejection_reason" text,
	"validated_by" uuid,
	"validated_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "prevention_plans_annee" CHECK ("prevention_plans"."start_year" BETWEEN 2020 AND 2100),
	CONSTRAINT "prevention_plans_validation" CHECK ("prevention_plans"."status" NOT IN ('validated', 'replaced') OR "prevention_plans"."validated_at" IS NOT NULL)
);
--> statement-breakpoint
ALTER TABLE "prevention_plans" ADD CONSTRAINT "prevention_plans_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prevention_plans" ADD CONSTRAINT "prevention_plans_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prevention_plans" ADD CONSTRAINT "prevention_plans_validated_by_users_id_fk" FOREIGN KEY ("validated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prevention_plans" ADD CONSTRAINT "prevention_plans_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "prevention_plans_un_valide" ON "prevention_plans" USING btree ("organization_id") WHERE "prevention_plans"."status" = 'validated';--> statement-breakpoint

-- Seul un administrateur IMA actif et formé à l'IA (article 4 AI Act) valide un plan (même règle que le rapport)
CREATE TRIGGER prevention_plans_validateur_admin
  BEFORE INSERT OR UPDATE OF validated_by ON prevention_plans
  FOR EACH ROW EXECUTE FUNCTION inneros_controle_validateur();
