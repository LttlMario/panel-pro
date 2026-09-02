-- Reassert page-level RLS for shared/global resources. This is deliberately
-- idempotent so it is safe to apply after older policy migrations.

BEGIN;

ALTER TABLE public.illegal_locations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS locations_read ON public.illegal_locations;
DROP POLICY IF EXISTS locations_admin ON public.illegal_locations;

CREATE POLICY locations_read
  ON public.illegal_locations
  FOR SELECT TO anon, authenticated
  USING (
    public.current_panel_is_platform_admin()
    OR public.current_panel_has_page_access('locatiiilegale.html')
  );

CREATE POLICY locations_admin
  ON public.illegal_locations
  FOR ALL TO anon, authenticated
  USING (
    public.current_panel_is_platform_admin()
    AND organization_id IS NULL
  )
  WITH CHECK (
    public.current_panel_is_platform_admin()
    AND organization_id IS NULL
  );

ALTER TABLE public.marketplace_ilegal ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS marketplace_illegal_read ON public.marketplace_ilegal;
DROP POLICY IF EXISTS marketplace_illegal_insert ON public.marketplace_ilegal;
DROP POLICY IF EXISTS marketplace_illegal_update ON public.marketplace_ilegal;

CREATE POLICY marketplace_illegal_read
  ON public.marketplace_ilegal
  FOR SELECT TO anon, authenticated
  USING (public.current_panel_has_page_access('marketplace-ilegal.html'));

CREATE POLICY marketplace_illegal_insert
  ON public.marketplace_ilegal
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    public.current_panel_has_page_access('marketplace-ilegal.html')
    AND organization_id IS NULL
    AND created_by_discord_id = public.current_panel_discord_id()
  );

CREATE POLICY marketplace_illegal_update
  ON public.marketplace_ilegal
  FOR UPDATE TO anon, authenticated
  USING (
    public.current_panel_has_page_access('marketplace-ilegal.html')
    AND (
      created_by_discord_id = public.current_panel_discord_id()
      OR public.current_panel_is_platform_admin()
    )
  )
  WITH CHECK (organization_id IS NULL);

COMMIT;
