-- Blackmarket-ul este global doar pentru citire în panel.
-- Inserarea, modificarea și ștergerea rămân controlate de organizația autorului.

DROP POLICY IF EXISTS marketplace_illegal_read ON public.marketplace_ilegal;

CREATE POLICY marketplace_illegal_read
ON public.marketplace_ilegal
FOR SELECT
TO anon, authenticated
USING (public.current_panel_permission_level() >= 3);

CREATE OR REPLACE VIEW public.marketplace_ilegal_feed
WITH (security_invoker = true)
AS
SELECT
    m.id,
    m.nume,
    m.telefon,
    m.tip_actiune,
    m.categorie,
    m.subcategorie,
    m.produse,
    m.pret,
    m.imagini_json,
    m.imagine_url,
    m.created_at,
    m.updated_at,
    m.created_by_discord_id,
    m.organization_id,
    o.name AS organization_name,
    o.illegal_name AS organization_illegal_name
FROM public.marketplace_ilegal AS m
LEFT JOIN public.organizations AS o ON o.id = m.organization_id
WHERE public.current_panel_permission_level() >= 3;

GRANT SELECT ON public.marketplace_ilegal_feed TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.normalize_illegal_marketplace_name()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    NEW.nume := trim(regexp_replace(NEW.nume, '^\s*[0-9]{1,12}\s+', ''));
    NEW.nume := trim(regexp_replace(NEW.nume, '^\s*[0-9]{1,12}\s*[|:/#-]\s*', ''));
    NEW.nume := trim(regexp_replace(NEW.nume, '\s*[|:/#-]\s*[0-9]{1,12}\s*$', ''));
    NEW.nume := trim(regexp_replace(NEW.nume, '\s+[0-9]{1,12}\s*$', ''));
    NEW.nume := trim(regexp_replace(NEW.nume, '\s*[[(]\s*[0-9]{1,12}\s*[\])]\s*$', ''));
    NEW.nume := regexp_replace(NEW.nume, '\s{2,}', ' ', 'g');
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS normalize_illegal_marketplace_name_trigger ON public.marketplace_ilegal;

CREATE TRIGGER normalize_illegal_marketplace_name_trigger
BEFORE INSERT OR UPDATE OF nume ON public.marketplace_ilegal
FOR EACH ROW
EXECUTE FUNCTION public.normalize_illegal_marketplace_name();

-- Curăță și anunțurile existente, nu doar pe cele noi.
UPDATE public.marketplace_ilegal
SET nume = nume
WHERE nume IS NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'marketplace_ilegal'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.marketplace_ilegal;
    END IF;
END
$$;
