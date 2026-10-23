-- Année du plan d'action : les plans existants portent sur leur première année
ALTER TABLE "prevention_plans" ADD COLUMN "action_year" integer;--> statement-breakpoint
UPDATE "prevention_plans" SET "action_year" = "start_year";--> statement-breakpoint
ALTER TABLE "prevention_plans" ALTER COLUMN "action_year" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "prevention_plans" ADD CONSTRAINT "prevention_plans_annee_action" CHECK ("prevention_plans"."action_year" BETWEEN "prevention_plans"."start_year" AND "prevention_plans"."start_year" + 4);
