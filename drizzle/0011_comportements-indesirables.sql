CREATE TABLE "behaviour_counts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"instrument_id" uuid NOT NULL,
	"behaviour_id" text NOT NULL,
	"category" text NOT NULL,
	"count" integer NOT NULL,
	"base" integer NOT NULL,
	"scoring_version" text NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "behaviour_counts_unique" UNIQUE("campaign_id","instrument_id","behaviour_id","category"),
	CONSTRAINT "behaviour_counts_base_minimum" CHECK ("behaviour_counts"."base" >= 10),
	CONSTRAINT "behaviour_counts_nombre" CHECK ("behaviour_counts"."count" BETWEEN 0 AND "behaviour_counts"."base"),
	CONSTRAINT "behaviour_counts_categorie" CHECK ("behaviour_counts"."category" ~ '^(concernes|auteur_np|(frequence|auteur|nombre)_[0-9]{1,2})$')
);
--> statement-breakpoint
ALTER TABLE "behaviour_counts" ADD CONSTRAINT "behaviour_counts_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "behaviour_counts" ADD CONSTRAINT "behaviour_counts_instrument_id_instruments_id_fk" FOREIGN KEY ("instrument_id") REFERENCES "public"."instruments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint

-- Règle 3 : aucun comptage sur moins de personnes que le seuil de la campagne
CREATE FUNCTION inneros_controle_base_comportements() RETURNS trigger AS $$
DECLARE
  seuil integer;
BEGIN
  SELECT group_min_size INTO seuil FROM campaigns WHERE id = NEW.campaign_id;
  IF NEW.base < seuil THEN
    RAISE EXCEPTION 'Comptage sur % personnes, sous le seuil de la campagne (%)', NEW.base, seuil
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER behaviour_counts_base_seuil_campagne
  BEFORE INSERT OR UPDATE ON behaviour_counts
  FOR EACH ROW EXECUTE FUNCTION inneros_controle_base_comportements();
