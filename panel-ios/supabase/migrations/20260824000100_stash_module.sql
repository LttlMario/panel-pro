-- Modul Stash per organizație: inventar, cereri și donații cu aprobare.

CREATE TABLE IF NOT EXISTS public.organization_stash_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 2 AND 140),
  category text NOT NULL DEFAULT 'General' CHECK (length(btrim(category)) BETWEEN 2 AND 60),
  quantity numeric(12, 2) NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  unit text NOT NULL DEFAULT 'buc.' CHECK (length(btrim(unit)) BETWEEN 1 AND 20),
  description text NOT NULL DEFAULT '' CHECK (length(description) <= 4000),
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'reserved', 'out', 'archived')),
  source_type text NOT NULL DEFAULT 'manual' CHECK (source_type IN ('manual', 'donation')),
  created_by_discord_id text NOT NULL,
  created_by_name text NOT NULL,
  updated_by_discord_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.organization_stash_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  stash_item_id uuid REFERENCES public.organization_stash_items(id) ON DELETE SET NULL,
  item_title text NOT NULL CHECK (length(btrim(item_title)) BETWEEN 2 AND 140),
  quantity numeric(12, 2) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  note text NOT NULL DEFAULT '' CHECK (length(note) <= 2000),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
  requested_by_discord_id text NOT NULL,
  requested_by_name text NOT NULL,
  handled_by_discord_id text,
  handled_by_name text,
  handled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.organization_stash_donations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 2 AND 140),
  category text NOT NULL DEFAULT 'Donație' CHECK (length(btrim(category)) BETWEEN 2 AND 60),
  quantity numeric(12, 2) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit text NOT NULL DEFAULT 'buc.' CHECK (length(btrim(unit)) BETWEEN 1 AND 20),
  note text NOT NULL DEFAULT '' CHECK (length(note) <= 4000),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  donated_by_discord_id text NOT NULL,
  donated_by_name text NOT NULL,
  reviewed_by_discord_id text,
  reviewed_by_name text,
  reviewed_at timestamptz,
  stash_item_id uuid REFERENCES public.organization_stash_items(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS organization_stash_items_org_idx
  ON public.organization_stash_items (organization_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS organization_stash_requests_org_idx
  ON public.organization_stash_requests (organization_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS organization_stash_donations_org_idx
  ON public.organization_stash_donations (organization_id, status, created_at DESC);

CREATE OR REPLACE FUNCTION public.current_panel_has_stash_access(requested_action text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT public.current_panel_is_platform_admin()
    OR EXISTS (
      SELECT 1
      FROM public.panel_sessions session
      JOIN public.app_settings setting
        ON setting.organization_id = session.organization_id
       AND setting.key = CASE WHEN requested_action = 'read' THEN 'page_permissions' ELSE 'action_permissions' END
      WHERE session.token_hash = encode(
        extensions.digest(
          COALESCE(NULLIF(current_setting('request.headers', true), '')::jsonb->>'x-panel-session', ''),
          'sha256'
        ),
        'hex'
      )
        AND session.revoked_at IS NULL
        AND session.expires_at > now()
        AND (
          (requested_action = 'read' AND EXISTS (
            SELECT 1
            FROM jsonb_array_elements_text(COALESCE(setting.value->'stash.html', '[]'::jsonb)) role_id
            WHERE role_id = ANY(COALESCE(session.discord_role_ids, '{}'::text[]))
          ))
          OR (requested_action <> 'read' AND EXISTS (
            SELECT 1
            FROM jsonb_array_elements_text(COALESCE(setting.value->('stash.' || requested_action), '[]'::jsonb)) role_id
            WHERE role_id = ANY(COALESCE(session.discord_role_ids, '{}'::text[]))
          ))
        )
    );
$$;

ALTER FUNCTION public.current_panel_has_stash_access(text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.current_panel_has_stash_access(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_panel_has_stash_access(text) TO anon, authenticated, service_role;

ALTER TABLE public.organization_stash_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_stash_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_stash_donations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organization_stash_items_read ON public.organization_stash_items;
DROP POLICY IF EXISTS organization_stash_items_write ON public.organization_stash_items;
DROP POLICY IF EXISTS organization_stash_items_update ON public.organization_stash_items;
DROP POLICY IF EXISTS organization_stash_items_delete ON public.organization_stash_items;
CREATE POLICY organization_stash_items_read ON public.organization_stash_items
  FOR SELECT TO anon, authenticated
  USING (organization_id = public.current_panel_organization_id()
    AND public.current_panel_has_stash_access('read'));
CREATE POLICY organization_stash_items_write ON public.organization_stash_items
  FOR INSERT TO anon, authenticated
  WITH CHECK (organization_id = public.current_panel_organization_id() AND public.current_panel_has_stash_access('write'));
CREATE POLICY organization_stash_items_update ON public.organization_stash_items
  FOR UPDATE TO anon, authenticated
  USING (organization_id = public.current_panel_organization_id() AND public.current_panel_has_stash_access('write'))
  WITH CHECK (organization_id = public.current_panel_organization_id() AND public.current_panel_has_stash_access('write'));
CREATE POLICY organization_stash_items_delete ON public.organization_stash_items
  FOR DELETE TO anon, authenticated
  USING (organization_id = public.current_panel_organization_id() AND public.current_panel_has_stash_access('write'));

DROP POLICY IF EXISTS organization_stash_requests_read ON public.organization_stash_requests;
DROP POLICY IF EXISTS organization_stash_requests_write ON public.organization_stash_requests;
DROP POLICY IF EXISTS organization_stash_requests_update ON public.organization_stash_requests;
CREATE POLICY organization_stash_requests_read ON public.organization_stash_requests
  FOR SELECT TO anon, authenticated
  USING (organization_id = public.current_panel_organization_id()
    AND (public.current_panel_has_stash_access('manage_requests')
      OR (requested_by_discord_id = public.current_panel_discord_id() AND public.current_panel_has_stash_access('request'))));
CREATE POLICY organization_stash_requests_write ON public.organization_stash_requests
  FOR INSERT TO anon, authenticated
  WITH CHECK (organization_id = public.current_panel_organization_id() AND public.current_panel_has_stash_access('request'));
CREATE POLICY organization_stash_requests_update ON public.organization_stash_requests
  FOR UPDATE TO anon, authenticated
  USING (organization_id = public.current_panel_organization_id() AND public.current_panel_has_stash_access('manage_requests'))
  WITH CHECK (organization_id = public.current_panel_organization_id() AND public.current_panel_has_stash_access('manage_requests'));

DROP POLICY IF EXISTS organization_stash_donations_read ON public.organization_stash_donations;
DROP POLICY IF EXISTS organization_stash_donations_write ON public.organization_stash_donations;
DROP POLICY IF EXISTS organization_stash_donations_update ON public.organization_stash_donations;
CREATE POLICY organization_stash_donations_read ON public.organization_stash_donations
  FOR SELECT TO anon, authenticated
  USING (organization_id = public.current_panel_organization_id()
    AND (public.current_panel_has_stash_access('approve_donation')
      OR (donated_by_discord_id = public.current_panel_discord_id() AND public.current_panel_has_stash_access('donate'))));
CREATE POLICY organization_stash_donations_write ON public.organization_stash_donations
  FOR INSERT TO anon, authenticated
  WITH CHECK (organization_id = public.current_panel_organization_id() AND public.current_panel_has_stash_access('donate'));
CREATE POLICY organization_stash_donations_update ON public.organization_stash_donations
  FOR UPDATE TO anon, authenticated
  USING (organization_id = public.current_panel_organization_id() AND public.current_panel_has_stash_access('approve_donation'))
  WITH CHECK (organization_id = public.current_panel_organization_id() AND public.current_panel_has_stash_access('approve_donation'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_stash_items TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.organization_stash_requests TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.organization_stash_donations TO anon, authenticated;
GRANT ALL ON public.organization_stash_items TO service_role;
GRANT ALL ON public.organization_stash_requests TO service_role;
GRANT ALL ON public.organization_stash_donations TO service_role;
