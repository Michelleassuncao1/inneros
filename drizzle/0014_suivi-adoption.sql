CREATE TYPE "public"."action_status" AS ENUM('a_faire', 'en_cours', 'realisee', 'reportee', 'abandonnee');--> statement-breakpoint
CREATE TABLE "plan_action_status" (
	"plan_id" uuid NOT NULL,
	"action_id" text NOT NULL,
	"status" "action_status" NOT NULL,
	"done_on" date,
	"comment" text,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plan_action_status_plan_id_action_id_pk" PRIMARY KEY("plan_id","action_id"),
	CONSTRAINT "plan_action_status_commentaire" CHECK (coalesce(length("plan_action_status"."comment"), 0) <= 500),
	CONSTRAINT "plan_action_status_date" CHECK ("plan_action_status"."done_on" IS NULL OR "plan_action_status"."status" = 'realisee')
);
--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "advisor_delegation" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "prevention_plans" ADD COLUMN "adopted_by" uuid;--> statement-breakpoint
ALTER TABLE "prevention_plans" ADD COLUMN "adopted_at" date;--> statement-breakpoint
ALTER TABLE "prevention_plans" ADD COLUMN "consultation_body" text;--> statement-breakpoint
ALTER TABLE "prevention_plans" ADD COLUMN "consultation_date" date;--> statement-breakpoint
ALTER TABLE "plan_action_status" ADD CONSTRAINT "plan_action_status_plan_id_prevention_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."prevention_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_action_status" ADD CONSTRAINT "plan_action_status_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prevention_plans" ADD CONSTRAINT "prevention_plans_adopted_by_users_id_fk" FOREIGN KEY ("adopted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prevention_plans" ADD CONSTRAINT "prevention_plans_organe" CHECK ("prevention_plans"."consultation_body" IS NULL OR "prevention_plans"."consultation_body" IN ('cppt', 'delegation_syndicale', 'travailleurs', 'cse', 'aucun_cse', 'cipa', 'participation_travailleurs', 'representants_sst'));--> statement-breakpoint

-- Qui peut signer pour l'entreprise : le référent signataire de la campagne, ou, si le signataire a délégué,
-- un conseiller en prévention actif de l'entreprise ayant accès à la campagne (décision du 21/10/2026)
CREATE FUNCTION inneros_peut_signer(campagne uuid, utilisateur uuid) RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM campaigns c
    WHERE c.id = campagne
      AND (
        c.signatory_referent_id = utilisateur
        OR (
          c.advisor_delegation
          AND EXISTS (
            SELECT 1 FROM users u
            JOIN campaign_referents cr ON cr.user_id = u.id AND cr.campaign_id = c.id
            WHERE u.id = utilisateur AND u.role = 'referent' AND u.prevention_advisor
              AND u.disabled_at IS NULL AND u.organization_id = c.organization_id
          )
        )
      )
  );
$$ LANGUAGE sql STABLE;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION inneros_controle_acceptation() RETURNS trigger AS $$
BEGIN
  IF NEW.accepted_by IS NOT NULL AND NEW.accepted_by IS DISTINCT FROM OLD.accepted_by THEN
    IF NEW.status <> 'validated' OR NEW.validated_at IS NULL OR NEW.accepted_at IS NULL THEN
      RAISE EXCEPTION 'Un rapport ne peut être accepté qu''après sa validation par IMA'
        USING ERRCODE = 'check_violation';
    END IF;
    IF NOT inneros_peut_signer(NEW.campaign_id, NEW.accepted_by) THEN
      RAISE EXCEPTION 'Seul le référent signataire, ou le conseiller en prévention par délégation, peut accepter le rapport'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  IF NEW.accepted_by IS NOT NULL AND (NEW.status <> 'validated' OR NEW.accepted_at IS NULL) THEN
    RAISE EXCEPTION 'Un rapport accepté reste validé'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION inneros_controle_correction() RETURNS trigger AS $$
BEGIN
  IF NEW.correction_requested_by IS NOT NULL
     AND NEW.correction_requested_by IS DISTINCT FROM OLD.correction_requested_by
     AND NOT inneros_peut_signer(NEW.campaign_id, NEW.correction_requested_by) THEN
    RAISE EXCEPTION 'Seul le référent signataire, ou le conseiller en prévention par délégation, peut demander une correction'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

-- Adoption du plan : plan validé, par le signataire de la campagne du rapport de référence (ou par délégation)
CREATE FUNCTION inneros_controle_adoption_plan() RETURNS trigger AS $$
DECLARE
  campagne uuid;
BEGIN
  IF NEW.adopted_by IS NOT NULL AND NEW.adopted_by IS DISTINCT FROM OLD.adopted_by THEN
    SELECT campaign_id INTO campagne FROM reports WHERE id = NEW.report_id;
    IF NEW.status <> 'validated' OR NEW.adopted_at IS NULL OR campagne IS NULL
       OR NOT inneros_peut_signer(campagne, NEW.adopted_by) THEN
      RAISE EXCEPTION 'Seul le référent signataire, ou le conseiller en prévention par délégation, adopte un plan validé'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER prevention_plans_adoption
  BEFORE UPDATE OF adopted_by ON prevention_plans
  FOR EACH ROW EXECUTE FUNCTION inneros_controle_adoption_plan();
--> statement-breakpoint

-- Avancement des actions : plan validé ; IMA ou le conseiller en prévention de l'entreprise
CREATE FUNCTION inneros_controle_avancement() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM prevention_plans p JOIN users u ON u.id = NEW.updated_by
    WHERE p.id = NEW.plan_id AND p.status = 'validated' AND u.disabled_at IS NULL
      AND (u.role = 'admin' OR (u.role = 'referent' AND u.prevention_advisor AND u.organization_id = p.organization_id))
  ) THEN
    RAISE EXCEPTION 'Seuls IMA et le conseiller en prévention mettent à jour l''avancement d''un plan validé'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER plan_action_status_auteur
  BEFORE INSERT OR UPDATE ON plan_action_status
  FOR EACH ROW EXECUTE FUNCTION inneros_controle_avancement();
