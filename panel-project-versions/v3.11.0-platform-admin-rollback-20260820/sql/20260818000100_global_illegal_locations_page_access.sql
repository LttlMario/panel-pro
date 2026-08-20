-- Locațiile ilegale sunt un catalog global comun tuturor organizațiilor.
-- Accesul este controlat exclusiv de permisiunea paginii configurată în organizatii.html.

UPDATE public.illegal_locations
SET organization_id = NULL
WHERE organization_id IS NOT NULL;

DROP POLICY IF EXISTS locations_read ON public.illegal_locations;
CREATE POLICY locations_read
ON public.illegal_locations
FOR SELECT
TO anon, authenticated
USING (
    public.current_panel_is_platform_admin()
    OR public.current_panel_has_page_access('locatiiilegale.html')
);

DROP POLICY IF EXISTS locations_admin ON public.illegal_locations;
CREATE POLICY locations_admin
ON public.illegal_locations
FOR ALL
TO anon, authenticated
USING (
    public.current_panel_is_platform_admin()
    AND organization_id IS NULL
)
WITH CHECK (
    public.current_panel_is_platform_admin()
    AND organization_id IS NULL
);
