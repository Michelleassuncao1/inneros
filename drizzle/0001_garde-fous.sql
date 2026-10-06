-- Garde-fous InnerOS qui comparent deux tables (règles 3 et 6 de CLAUDE.md).
-- Ils protègent la base même si l'application contenait une erreur.

-- 1. Un groupe ne peut pas prévoir moins de personnes que le seuil de sa campagne.
CREATE FUNCTION inneros_controle_effectif_groupe() RETURNS trigger AS $$
DECLARE
  seuil integer;
BEGIN
  SELECT group_min_size INTO seuil FROM campaigns WHERE id = NEW.campaign_id;
  IF NEW.expected_size < seuil THEN
    RAISE EXCEPTION 'Effectif prévu (%) inférieur au seuil de la campagne (%)', NEW.expected_size, seuil
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER groups_effectif_seuil_campagne
  BEFORE INSERT OR UPDATE OF expected_size, campaign_id ON groups
  FOR EACH ROW EXECUTE FUNCTION inneros_controle_effectif_groupe();
--> statement-breakpoint

-- 2. Relever le seuil d'une campagne est refusé si un groupe existant passerait en dessous.
CREATE FUNCTION inneros_controle_seuil_campagne() RETURNS trigger AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM groups WHERE campaign_id = NEW.id AND expected_size < NEW.group_min_size
  ) THEN
    RAISE EXCEPTION 'Seuil (%) supérieur à l''effectif prévu d''un groupe existant', NEW.group_min_size
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER campaigns_seuil_groupes
  BEFORE UPDATE OF group_min_size ON campaigns
  FOR EACH ROW EXECUTE FUNCTION inneros_controle_seuil_campagne();
--> statement-breakpoint

-- 3. Aucun résultat collectif sur moins de personnes que le seuil de la campagne.
CREATE FUNCTION inneros_controle_effectif_agregat() RETURNS trigger AS $$
DECLARE
  seuil integer;
BEGIN
  SELECT group_min_size INTO seuil FROM campaigns WHERE id = NEW.campaign_id;
  IF NEW.n < seuil THEN
    RAISE EXCEPTION 'Résultat sur % personnes, sous le seuil de la campagne (%)', NEW.n, seuil
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER aggregates_effectif_seuil_campagne
  BEFORE INSERT OR UPDATE ON aggregates
  FOR EACH ROW EXECUTE FUNCTION inneros_controle_effectif_agregat();
--> statement-breakpoint

-- 4. Seul un administrateur IMA peut valider un rapport.
CREATE FUNCTION inneros_controle_validateur() RETURNS trigger AS $$
BEGIN
  IF NEW.validated_by IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM users WHERE id = NEW.validated_by AND role = 'admin' AND disabled_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Seul un administrateur IMA actif peut valider un rapport'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER reports_validateur_admin
  BEFORE INSERT OR UPDATE OF validated_by ON reports
  FOR EACH ROW EXECUTE FUNCTION inneros_controle_validateur();
