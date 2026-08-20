-- Accesul organizațiilor se bazează pe rolurile Discord selectate pentru pagini.
-- permission_level rămâne doar pentru compatibilitatea schemelor vechi.

ALTER TABLE public.panel_sessions
    ADD COLUMN IF NOT EXISTS discord_role_ids text[] NOT NULL DEFAULT '{}';

CREATE OR REPLACE FUNCTION public.current_panel_has_page_access(page_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.panel_sessions AS session
        JOIN public.app_settings AS setting
          ON setting.organization_id = session.organization_id
         AND setting.key = 'page_permissions'
        WHERE session.token_hash = encode(
            extensions.digest(
                COALESCE(
                    (NULLIF(current_setting('request.headers', true), '')::jsonb ->> 'x-panel-session'),
                    ''
                ),
                'sha256'
            ),
            'hex'
        )
          AND session.revoked_at IS NULL
          AND session.expires_at > now()
          AND (
              session.is_platform_admin
              OR EXISTS (
                  SELECT 1
                  FROM jsonb_array_elements_text(
                      COALESCE(setting.value -> page_name, '[]'::jsonb)
                  ) AS allowed(role_id)
                  WHERE role_id = ANY(session.discord_role_ids)
              )
          )
    );
$$;

GRANT EXECUTE ON FUNCTION public.current_panel_has_page_access(text)
    TO anon, authenticated;

DROP POLICY IF EXISTS marketplace_legal_read_global ON public.marketplace;
CREATE POLICY marketplace_legal_read_global
ON public.marketplace
FOR SELECT
TO anon, authenticated
USING (public.current_panel_has_page_access('marketplace.html'));

DROP POLICY IF EXISTS marketplace_insert ON public.marketplace;
CREATE POLICY marketplace_insert
ON public.marketplace
FOR INSERT
TO anon, authenticated
WITH CHECK (
    public.current_panel_has_page_access('marketplace.html')
    AND organization_id = public.current_panel_organization_id()
    AND created_by_discord_id = public.current_panel_discord_id()
);

DROP POLICY IF EXISTS marketplace_update ON public.marketplace;
CREATE POLICY marketplace_update
ON public.marketplace
FOR UPDATE
TO anon, authenticated
USING (
    public.current_panel_has_page_access('marketplace.html')
    AND organization_id = public.current_panel_organization_id()
    AND (
        created_by_discord_id = public.current_panel_discord_id()
        OR public.current_panel_is_platform_admin()
    )
)
WITH CHECK (organization_id = public.current_panel_organization_id());

DROP POLICY IF EXISTS marketplace_illegal_insert ON public.marketplace_ilegal;
CREATE POLICY marketplace_illegal_insert
ON public.marketplace_ilegal
FOR INSERT
TO anon, authenticated
WITH CHECK (
    public.current_panel_has_page_access('marketplace-ilegal.html')
    AND organization_id IS NULL
    AND created_by_discord_id = public.current_panel_discord_id()
);

DROP POLICY IF EXISTS marketplace_illegal_read ON public.marketplace_ilegal;
CREATE POLICY marketplace_illegal_read
ON public.marketplace_ilegal
FOR SELECT
TO anon, authenticated
USING (public.current_panel_has_page_access('marketplace-ilegal.html'));

DROP POLICY IF EXISTS marketplace_illegal_update ON public.marketplace_ilegal;
CREATE POLICY marketplace_illegal_update
ON public.marketplace_ilegal
FOR UPDATE
TO anon, authenticated
USING (
    public.current_panel_has_page_access('marketplace-ilegal.html')
    AND (
        created_by_discord_id = public.current_panel_discord_id()
        OR public.current_panel_is_platform_admin()
    )
)
WITH CHECK (organization_id IS NULL);

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
WHERE public.current_panel_has_page_access('marketplace.html');

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
WHERE public.current_panel_has_page_access('marketplace-ilegal.html');
