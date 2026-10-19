CREATE TYPE "public"."risk_source" AS ENUM('echelle', 'comportement', 'manuel');--> statement-breakpoint
CREATE TYPE "public"."risk_status" AS ENUM('ouvert', 'traite', 'clos');--> statement-breakpoint
CREATE TABLE "risks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"campaign_id" uuid,
	"instrument_id" uuid,
	"scale_id" text,
	"source" "risk_source" NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"mindset_level" text,
	"group_labels" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"probability" numeric(4, 1) NOT NULL,
	"exposure" numeric(4, 1) NOT NULL,
	"gravity" numeric(4, 1) NOT NULL,
	"justification" text,
	"status" "risk_status" DEFAULT 'ouvert' NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "risks_echelle_unique" UNIQUE("organization_id","campaign_id","instrument_id","scale_id"),
	CONSTRAINT "risks_probabilite" CHECK ("risks"."probability" IN (10, 6, 3, 1, 0.5, 0.2, 0.1)),
	CONSTRAINT "risks_exposition" CHECK ("risks"."exposure" IN (10, 6, 3, 2, 1, 0.5)),
	CONSTRAINT "risks_gravite" CHECK ("risks"."gravity" IN (100, 40, 15, 7, 3, 1)),
	CONSTRAINT "risks_titre" CHECK (length("risks"."title") BETWEEN 1 AND 200),
	CONSTRAINT "risks_textes" CHECK (coalesce(length("risks"."description"), 0) <= 2000 AND coalesce(length("risks"."justification"), 0) <= 2000),
	CONSTRAINT "risks_origine" CHECK ("risks"."source" = 'manuel' OR "risks"."scale_id" IS NOT NULL)
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "prevention_advisor" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "risks" ADD CONSTRAINT "risks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risks" ADD CONSTRAINT "risks_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risks" ADD CONSTRAINT "risks_instrument_id_instruments_id_fk" FOREIGN KEY ("instrument_id") REFERENCES "public"."instruments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risks" ADD CONSTRAINT "risks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risks" ADD CONSTRAINT "risks_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_conseiller_referent" CHECK (NOT "users"."prevention_advisor" OR "users"."role" = 'referent');--> statement-breakpoint

-- Seuls un administrateur IMA actif ou le conseiller en prévention de l'entreprise (référent actif)
-- peuvent écrire dans le registre des risques
CREATE FUNCTION inneros_controle_auteur_risque() RETURNS trigger AS $$
BEGIN
  IF NEW.updated_by IS NULL OR NOT EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = NEW.updated_by AND u.disabled_at IS NULL
      AND (u.role = 'admin' OR (u.role = 'referent' AND u.prevention_advisor AND u.organization_id = NEW.organization_id))
  ) THEN
    RAISE EXCEPTION 'Seuls IMA et le conseiller en prévention de l''entreprise peuvent modifier le registre des risques'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER risks_auteur_autorise
  BEFORE INSERT OR UPDATE ON risks
  FOR EACH ROW EXECUTE FUNCTION inneros_controle_auteur_risque();
