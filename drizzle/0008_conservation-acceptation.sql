ALTER TABLE "campaigns" ADD COLUMN "signatory_referent_id" uuid;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "raw_deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "accepted_by" uuid;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "accepted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_signatory_referent_id_users_id_fk" FOREIGN KEY ("signatory_referent_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_accepted_by_users_id_fk" FOREIGN KEY ("accepted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

-- Le signataire désigné doit être un référent ayant accès à cette campagne (décision B du 14/10/2026).
CREATE FUNCTION inneros_controle_signataire() RETURNS trigger AS $$
BEGIN
  IF NEW.signatory_referent_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM campaign_referents
    WHERE campaign_id = NEW.id AND user_id = NEW.signatory_referent_id
  ) THEN
    RAISE EXCEPTION 'Le signataire doit être un référent ayant accès à la campagne'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER campaigns_signataire_referent
  BEFORE INSERT OR UPDATE OF signatory_referent_id ON campaigns
  FOR EACH ROW EXECUTE FUNCTION inneros_controle_signataire();
--> statement-breakpoint

-- Seul le signataire désigné accepte le rapport, et seulement après la validation IMA.
CREATE FUNCTION inneros_controle_acceptation() RETURNS trigger AS $$
BEGIN
  IF NEW.accepted_by IS NOT NULL THEN
    IF NEW.status <> 'validated' OR NEW.validated_at IS NULL OR NEW.accepted_at IS NULL THEN
      RAISE EXCEPTION 'Un rapport ne peut être accepté qu''après sa validation par IMA'
        USING ERRCODE = 'check_violation';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM campaigns WHERE id = NEW.campaign_id AND signatory_referent_id = NEW.accepted_by
    ) THEN
      RAISE EXCEPTION 'Seul le référent signataire désigné peut accepter le rapport'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER reports_acceptation_signataire
  BEFORE INSERT OR UPDATE OF accepted_by, accepted_at, status ON reports
  FOR EACH ROW EXECUTE FUNCTION inneros_controle_acceptation();
