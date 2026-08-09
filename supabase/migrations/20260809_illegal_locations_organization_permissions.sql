-- Accesul la pagina Locații Ilegale este controlat de page_permissions,
-- configurate din organizatii.html. Nu folosim niveluri numerice hardcodate aici.

CREATE OR REPLACE FUNCTION public.current_panel_is_platform_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
      SELECT COALESCE(is_platform_admin, false)
      FROM public.panel_sessions
      WHERE token_hash = encode(
        extensions.digest(
          COALESCE((NULLIF(current_setting('request.headers', true), '')::jsonb->>'x-panel-session'), ''),
          'sha256'
        ),
        'hex'
      )
        AND revoked_at IS NULL
        AND expires_at > now()
      LIMIT 1
    $$;

ALTER FUNCTION public.current_panel_is_platform_admin() OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.current_panel_is_platform_admin() TO anon, authenticated;

DROP POLICY IF EXISTS locations_delete_platform_admin ON public.illegal_locations;
DROP POLICY IF EXISTS locations_global_admin_delete ON public.illegal_locations;
DROP POLICY IF EXISTS locations_global_admin_insert ON public.illegal_locations;
DROP POLICY IF EXISTS locations_global_admin_update ON public.illegal_locations;
DROP POLICY IF EXISTS locations_global_read ON public.illegal_locations;
DROP POLICY IF EXISTS locations_insert_platform_admin ON public.illegal_locations;
DROP POLICY IF EXISTS locations_update_platform_admin ON public.illegal_locations;

DROP POLICY IF EXISTS locations_admin ON public.illegal_locations;
CREATE POLICY locations_admin ON public.illegal_locations
    TO authenticated, anon
    USING (
        organization_id = public.current_panel_organization_id()
        AND public.current_panel_is_platform_admin()
    )
    WITH CHECK (
        organization_id = public.current_panel_organization_id()
        AND public.current_panel_is_platform_admin()
    );

DROP POLICY IF EXISTS locations_read ON public.illegal_locations;
CREATE POLICY locations_read ON public.illegal_locations
    FOR SELECT
    TO authenticated, anon
    USING (organization_id = public.current_panel_organization_id());
