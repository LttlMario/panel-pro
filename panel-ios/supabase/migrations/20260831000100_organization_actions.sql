-- Evidența acțiunilor organizației (minat, farmat, patrulă sau tip personalizat).
CREATE TABLE IF NOT EXISTS public.organization_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  action_type text NOT NULL CHECK (length(btrim(action_type)) BETWEEN 2 AND 40),
  action_label text NOT NULL CHECK (length(btrim(action_label)) BETWEEN 2 AND 120),
  description text NOT NULL DEFAULT '' CHECK (length(description) <= 4000),
  notes text NOT NULL DEFAULT '' CHECK (length(notes) <= 4000),
  guild_id text NOT NULL CHECK (guild_id ~ '^[0-9]{15,22}$'),
  guild_name text NOT NULL DEFAULT '',
  participants jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(participants) = 'array'),
  discord_message_id text,
  created_by_discord_id text NOT NULL,
  created_by_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS organization_actions_org_created_idx
  ON public.organization_actions (organization_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.current_panel_has_actions_access(requested_action text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT public.current_panel_is_platform_admin()
    OR EXISTS (
      SELECT 1
      FROM public.panel_sessions session
      JOIN public.app_settings setting
        ON setting.organization_id = session.organization_id
       AND setting.key = 'action_permissions'
      WHERE session.token_hash = encode(
        extensions.digest(
          COALESCE(NULLIF(current_setting('request.headers', true), '')::jsonb->>'x-panel-session', ''),
          'sha256'
        ), 'hex'
      )
        AND session.revoked_at IS NULL
        AND session.expires_at > now()
        AND EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(COALESCE(setting.value->requested_action, '[]'::jsonb)) role_id
          WHERE role_id = ANY(COALESCE(session.discord_role_ids, '{}'::text[]))
        )
    );
$$;

ALTER FUNCTION public.current_panel_has_actions_access(text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.current_panel_has_actions_access(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_panel_has_actions_access(text) TO anon, authenticated, service_role;

ALTER TABLE public.organization_actions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS organization_actions_read ON public.organization_actions;
DROP POLICY IF EXISTS organization_actions_write ON public.organization_actions;
DROP POLICY IF EXISTS organization_actions_delete ON public.organization_actions;

CREATE POLICY organization_actions_read ON public.organization_actions
  FOR SELECT TO anon, authenticated
  USING (organization_id = public.current_panel_organization_id()
    AND (public.current_panel_has_actions_access('actions.organization.read')
      OR public.current_panel_has_actions_access('actions.organization.write')
      OR public.current_panel_has_actions_access('actions.organization.delete')));
CREATE POLICY organization_actions_write ON public.organization_actions
  FOR INSERT TO anon, authenticated
  WITH CHECK (organization_id = public.current_panel_organization_id()
    AND public.current_panel_has_actions_access('actions.organization.write'));
CREATE POLICY organization_actions_delete ON public.organization_actions
  FOR DELETE TO anon, authenticated
  USING (organization_id = public.current_panel_organization_id()
    AND public.current_panel_has_actions_access('actions.organization.delete'));

GRANT SELECT, INSERT, DELETE ON public.organization_actions TO anon, authenticated;
GRANT ALL ON public.organization_actions TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'organization_actions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.organization_actions;
  END IF;
END $$;
