-- Blackmarketul este global. Accesul la pagina rămâne controlat de page_permissions,
-- configurate din organizatii.html.

ALTER TABLE public.marketplace_ilegal
    ALTER COLUMN organization_id DROP NOT NULL;

UPDATE public.marketplace_ilegal
SET organization_id = NULL
WHERE organization_id IS NOT NULL;

DROP POLICY IF EXISTS marketplace_illegal_insert ON public.marketplace_ilegal;
CREATE POLICY marketplace_illegal_insert ON public.marketplace_ilegal
    FOR INSERT
    TO authenticated, anon
    WITH CHECK (
        organization_id IS NULL
        AND created_by_discord_id = public.current_panel_discord_id()
        AND public.current_panel_permission_level() >= 3
    );

DROP POLICY IF EXISTS marketplace_illegal_read ON public.marketplace_ilegal;
CREATE POLICY marketplace_illegal_read ON public.marketplace_ilegal
    FOR SELECT
    TO authenticated, anon
    USING (
        organization_id IS NULL
        OR organization_id = public.current_panel_organization_id()
    );

DROP POLICY IF EXISTS marketplace_illegal_update ON public.marketplace_ilegal;
CREATE POLICY marketplace_illegal_update ON public.marketplace_ilegal
    FOR UPDATE
    TO authenticated, anon
    USING (
        (organization_id IS NULL OR organization_id = public.current_panel_organization_id())
        AND (
            created_by_discord_id = public.current_panel_discord_id()
            OR public.current_panel_permission_level() = 7
        )
    )
    WITH CHECK (organization_id IS NULL);

CREATE OR REPLACE VIEW public.marketplace_ilegal_feed AS
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
FROM public.marketplace_ilegal m
LEFT JOIN public.organizations o ON o.id = m.organization_id
WHERE m.organization_id IS NULL
   OR m.organization_id = public.current_panel_organization_id();
