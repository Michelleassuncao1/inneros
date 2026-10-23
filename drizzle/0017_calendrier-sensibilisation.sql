CREATE TYPE "public"."awareness_origin" AS ENUM('programmee', 'manuelle', 'registre', 'evenement', 'alerte', 'comportement');--> statement-breakpoint
CREATE TYPE "public"."awareness_status" AS ENUM('prevue', 'diffusee', 'realisee', 'retiree');--> statement-breakpoint
CREATE TABLE "awareness_campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"theme_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"month" integer NOT NULL,
	"origin" "awareness_origin" NOT NULL,
	"origin_ref" text,
	"status" "awareness_status" DEFAULT 'prevue' NOT NULL,
	"diffused_on" date,
	"comment" text,
	"plan_action_id" text,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "awareness_campaigns_unique" UNIQUE("organization_id","theme_id","year"),
	CONSTRAINT "awareness_campaigns_mois" CHECK ("awareness_campaigns"."month" BETWEEN 1 AND 12 AND "awareness_campaigns"."year" BETWEEN 2020 AND 2100),
	CONSTRAINT "awareness_campaigns_commentaire" CHECK (coalesce(length("awareness_campaigns"."comment"), 0) <= 500),
	CONSTRAINT "awareness_campaigns_diffusion" CHECK ("awareness_campaigns"."diffused_on" IS NULL OR "awareness_campaigns"."status" IN ('diffusee', 'realisee'))
);
--> statement-breakpoint
ALTER TABLE "awareness_campaigns" ADD CONSTRAINT "awareness_campaigns_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "awareness_campaigns" ADD CONSTRAINT "awareness_campaigns_theme_id_awareness_themes_id_fk" FOREIGN KEY ("theme_id") REFERENCES "public"."awareness_themes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "awareness_campaigns" ADD CONSTRAINT "awareness_campaigns_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "awareness_campaigns" ADD CONSTRAINT "awareness_campaigns_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

-- Seuls IMA et le conseiller en prévention de l'entreprise écrivent dans le calendrier (même règle que le registre)
CREATE TRIGGER awareness_campaigns_auteur_autorise
  BEFORE INSERT OR UPDATE ON awareness_campaigns
  FOR EACH ROW EXECUTE FUNCTION inneros_controle_auteur_risque();
