-- Separate an organization's access expiration from manual suspension and
-- Discord verification state.  The access deadline remains the single source
-- of truth for expiration; these fields explain why active became false.

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS deactivation_reason text,
  ADD COLUMN IF NOT EXISTS deactivated_at timestamptz,
  ADD COLUMN IF NOT EXISTS deactivated_by_discord_id text,
  ADD COLUMN IF NOT EXISTS last_discord_check_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_discord_check_status text;

CREATE INDEX IF NOT EXISTS organizations_deactivation_reason_idx
  ON public.organizations (deactivation_reason, deactivated_at DESC);

CREATE OR REPLACE FUNCTION public.clear_organization_deactivation_state()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.active IS TRUE AND OLD.active IS DISTINCT FROM TRUE THEN
    NEW.deactivation_reason := NULL;
    NEW.deactivated_at := NULL;
    NEW.deactivated_by_discord_id := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS organizations_clear_deactivation_state ON public.organizations;
CREATE TRIGGER organizations_clear_deactivation_state
BEFORE UPDATE OF active ON public.organizations
FOR EACH ROW
EXECUTE FUNCTION public.clear_organization_deactivation_state();
