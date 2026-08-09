-- Marketplace-ul legal este vizibil global, dar scrierea și ștergerea
-- rămân controlate de organizația activă a autorului.

DROP POLICY IF EXISTS marketplace_read ON public.marketplace;

CREATE POLICY marketplace_legal_read_global
ON public.marketplace
FOR SELECT
TO anon, authenticated
USING (public.current_panel_permission_level() >= 1);

CREATE OR REPLACE VIEW public.marketplace_feed
WITH (security_invoker = true)
AS
SELECT
    m.id,
    m.nume,
    m.display_name,
    m.telefon,
    m.tip_actiune,
    m.categorie,
    m.produse,
    m.pret,
    m.imagini_json,
    m.imagine_url,
    m.created_at,
    m.updated_at,
    m.created_by_discord_id,
    m.organization_id,
    o.name AS organization_name
FROM public.marketplace AS m
LEFT JOIN public.organizations AS o ON o.id = m.organization_id
WHERE public.current_panel_permission_level() >= 1;

GRANT SELECT ON public.marketplace_feed TO anon, authenticated;
