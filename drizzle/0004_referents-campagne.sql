CREATE TYPE "public"."grouping_criterion" AS ENUM('service', 'department', 'direction', 'site', 'function', 'other');--> statement-breakpoint
CREATE TABLE "campaign_referents" (
	"campaign_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	CONSTRAINT "campaign_referents_campaign_id_user_id_pk" PRIMARY KEY("campaign_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "grouping_criterion" "grouping_criterion" DEFAULT 'service' NOT NULL;--> statement-breakpoint
ALTER TABLE "campaign_referents" ADD CONSTRAINT "campaign_referents_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_referents" ADD CONSTRAINT "campaign_referents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- Seul un référent de l'entreprise de la campagne peut recevoir l'accès à son rapport.
CREATE FUNCTION inneros_controle_referent_campagne() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM users u JOIN campaigns c ON c.organization_id = u.organization_id
    WHERE u.id = NEW.user_id AND c.id = NEW.campaign_id AND u.role = 'referent'
  ) THEN
    RAISE EXCEPTION 'Seul un référent de l''entreprise de la campagne peut y avoir accès'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER campaign_referents_meme_entreprise
  BEFORE INSERT OR UPDATE ON campaign_referents
  FOR EACH ROW EXECUTE FUNCTION inneros_controle_referent_campagne();
