-- Nu permitem ca o cerere sau o donație să lege un articol din altă organizație.
CREATE OR REPLACE FUNCTION public.enforce_stash_same_organization()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  item_organization_id uuid;
BEGIN
  IF NEW.stash_item_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT organization_id
    INTO item_organization_id
  FROM public.organization_stash_items
  WHERE id = NEW.stash_item_id;

  IF item_organization_id IS NULL OR item_organization_id IS DISTINCT FROM NEW.organization_id THEN
    RAISE EXCEPTION 'Articolul Stash aparține unei alte organizații.' USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS organization_stash_requests_same_org ON public.organization_stash_requests;
CREATE TRIGGER organization_stash_requests_same_org
  BEFORE INSERT OR UPDATE OF organization_id, stash_item_id
  ON public.organization_stash_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_stash_same_organization();

DROP TRIGGER IF EXISTS organization_stash_donations_same_org ON public.organization_stash_donations;
CREATE TRIGGER organization_stash_donations_same_org
  BEFORE INSERT OR UPDATE OF organization_id, stash_item_id
  ON public.organization_stash_donations
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_stash_same_organization();

ALTER FUNCTION public.enforce_stash_same_organization() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.enforce_stash_same_organization() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enforce_stash_same_organization() TO anon, authenticated, service_role;
