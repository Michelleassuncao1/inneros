ALTER TYPE "public"."report_status" ADD VALUE 'correction_requested';--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "correction_comment" text;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "correction_requested_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "correction_requested_by" uuid;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_correction_requested_by_users_id_fk" FOREIGN KEY ("correction_requested_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

-- Seul le référent signataire désigné peut demander une correction (décision B du 14/10/2026)
CREATE FUNCTION inneros_controle_correction() RETURNS trigger AS $$
BEGIN
  IF NEW.correction_requested_by IS NOT NULL
     AND NEW.correction_requested_by IS DISTINCT FROM OLD.correction_requested_by
     AND NOT EXISTS (
       SELECT 1 FROM campaigns WHERE id = NEW.campaign_id AND signatory_referent_id = NEW.correction_requested_by
     ) THEN
    RAISE EXCEPTION 'Seul le référent signataire désigné peut demander une correction'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER reports_correction_signataire
  BEFORE UPDATE OF correction_requested_by ON reports
  FOR EACH ROW EXECUTE FUNCTION inneros_controle_correction();
