ALTER TABLE "reports" ADD COLUMN "language" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "ai_literacy_at" date;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "ai_literacy_note" text;--> statement-breakpoint
CREATE UNIQUE INDEX "reports_un_valide_par_campagne" ON "reports" USING btree ("campaign_id") WHERE "reports"."status" = 'validated';--> statement-breakpoint

-- Article 4 AI Act (décision du 14/10/2026) : seul un administrateur IMA actif, dont la formation
-- à la maîtrise de l'IA est enregistrée, peut valider un rapport. Remplace le contrôle de 0001.
CREATE OR REPLACE FUNCTION inneros_controle_validateur() RETURNS trigger AS $$
BEGIN
  IF NEW.validated_by IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM users
    WHERE id = NEW.validated_by AND role = 'admin' AND disabled_at IS NULL AND ai_literacy_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Seul un administrateur IMA actif et formé à l''IA peut valider un rapport'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
