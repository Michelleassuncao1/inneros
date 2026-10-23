CREATE TYPE "public"."theme_status" AS ENUM('draft', 'validated', 'archived');--> statement-breakpoint
CREATE TABLE "awareness_themes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"status" "theme_status" DEFAULT 'draft' NOT NULL,
	"sheet" jsonb NOT NULL,
	"kits" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ai_model" text,
	"ai_prompt_version" text,
	"created_by" uuid,
	"validated_by" uuid,
	"validated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "awareness_themes_code_unique" UNIQUE("code"),
	CONSTRAINT "awareness_themes_code" CHECK ("awareness_themes"."code" ~ '^[a-z0-9-]{3,40}$'),
	CONSTRAINT "awareness_themes_validation" CHECK ("awareness_themes"."status" <> 'validated' OR "awareness_themes"."validated_at" IS NOT NULL)
);
--> statement-breakpoint
ALTER TABLE "awareness_themes" ADD CONSTRAINT "awareness_themes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "awareness_themes" ADD CONSTRAINT "awareness_themes_validated_by_users_id_fk" FOREIGN KEY ("validated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

-- Seul un administrateur IMA actif et formé à l'IA (article 4 AI Act) valide un thème (même règle que le rapport)
CREATE TRIGGER awareness_themes_validateur_admin
  BEFORE INSERT OR UPDATE OF validated_by ON awareness_themes
  FOR EACH ROW EXECUTE FUNCTION inneros_controle_validateur();
