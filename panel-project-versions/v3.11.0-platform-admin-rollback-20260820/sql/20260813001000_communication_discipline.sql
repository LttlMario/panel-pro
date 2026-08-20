-- Comunicări: avertismente și sancțiuni separate de postările vechi.
-- Nu ștergem community_posts sau post_type = fine: rămân compatibile cu datele existente.

CREATE TABLE IF NOT EXISTS public.disciplinary_warnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  target_scope text NOT NULL CHECK (target_scope IN ('departments', 'organization')),
  target_discord_id text,
  target_name text NOT NULL,
  reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 3 AND 4000),
  notes text NOT NULL DEFAULT '' CHECK (length(notes) <= 4000),
  evidence_url text,
  discord_message_id text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'revoked')),
  issued_by_discord_id text NOT NULL,
  issued_by_name text NOT NULL,
  resolved_at timestamptz,
  resolved_by_discord_id text,
  resolution_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT disciplinary_warnings_target_check CHECK (
    (target_scope = 'departments' AND target_discord_id IS NOT NULL)
    OR (target_scope = 'organization' AND target_discord_id IS NULL)
  )
);

CREATE TABLE IF NOT EXISTS public.disciplinary_sanctions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  target_scope text NOT NULL CHECK (target_scope IN ('departments', 'organization')),
  target_discord_id text,
  target_name text NOT NULL,
  warning_count_snapshot integer NOT NULL CHECK (warning_count_snapshot >= 3),
  amount numeric(12, 2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'USD' CHECK (currency ~ '^[A-Z0-9]{2,8}$'),
  reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 3 AND 4000),
  notes text NOT NULL DEFAULT '' CHECK (length(notes) <= 4000),
  evidence_url text,
  discord_message_id text,
  status text NOT NULL DEFAULT 'issued' CHECK (status IN ('issued', 'paid', 'waived', 'cancelled')),
  due_at timestamptz,
  issued_by_discord_id text NOT NULL,
  issued_by_name text NOT NULL,
  resolved_at timestamptz,
  resolved_by_discord_id text,
  resolution_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT disciplinary_sanctions_target_check CHECK (
    (target_scope = 'departments' AND target_discord_id IS NOT NULL)
    OR (target_scope = 'organization' AND target_discord_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS disciplinary_warnings_scope_target_idx
  ON public.disciplinary_warnings (organization_id, target_scope, target_discord_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS disciplinary_sanctions_scope_target_idx
  ON public.disciplinary_sanctions (organization_id, target_scope, target_discord_id, status, created_at DESC);

CREATE OR REPLACE FUNCTION public.current_panel_has_discipline_access(
  requested_scope text,
  requested_action text
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT public.current_panel_is_platform_admin()
    OR EXISTS (
      SELECT 1
      FROM public.panel_sessions session
      JOIN public.app_settings setting
        ON setting.organization_id = session.organization_id
       AND setting.key = 'discipline_permissions'
      WHERE session.token_hash = encode(
        extensions.digest(
          COALESCE(NULLIF(current_setting('request.headers', true), '')::jsonb->>'x-panel-session', ''),
          'sha256'
        ),
        'hex'
      )
        AND session.revoked_at IS NULL
        AND session.expires_at > now()
        AND EXISTS (
          SELECT 1
          FROM jsonb_array_elements_text(
            COALESCE(setting.value->requested_scope->requested_action, '[]'::jsonb)
          ) role_id
          WHERE role_id = ANY(COALESCE(session.discord_role_ids, '{}'::text[]))
        )
    );
$$;

ALTER FUNCTION public.current_panel_has_discipline_access(text, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.current_panel_has_discipline_access(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_panel_has_discipline_access(text, text) TO anon, authenticated, service_role;

ALTER TABLE public.disciplinary_warnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disciplinary_sanctions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS disciplinary_warnings_read ON public.disciplinary_warnings;
DROP POLICY IF EXISTS disciplinary_warnings_write ON public.disciplinary_warnings;
DROP POLICY IF EXISTS disciplinary_warnings_update ON public.disciplinary_warnings;
DROP POLICY IF EXISTS disciplinary_warnings_delete ON public.disciplinary_warnings;
DROP POLICY IF EXISTS disciplinary_sanctions_read ON public.disciplinary_sanctions;
DROP POLICY IF EXISTS disciplinary_sanctions_write ON public.disciplinary_sanctions;
DROP POLICY IF EXISTS disciplinary_sanctions_update ON public.disciplinary_sanctions;
DROP POLICY IF EXISTS disciplinary_sanctions_delete ON public.disciplinary_sanctions;

CREATE POLICY disciplinary_warnings_read ON public.disciplinary_warnings
  FOR SELECT TO anon, authenticated
  USING (
    organization_id = public.current_panel_organization_id()
    AND (
      (target_scope = 'departments' AND target_discord_id = public.current_panel_discord_id())
      OR public.current_panel_has_discipline_access(target_scope, 'read')
      OR public.current_panel_has_discipline_access(target_scope, 'write')
      OR public.current_panel_has_discipline_access(target_scope, 'sanction')
    )
  );

CREATE POLICY disciplinary_warnings_write ON public.disciplinary_warnings
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    organization_id = public.current_panel_organization_id()
    AND public.current_panel_has_discipline_access(target_scope, 'write')
  );

CREATE POLICY disciplinary_warnings_update ON public.disciplinary_warnings
  FOR UPDATE TO anon, authenticated
  USING (
    organization_id = public.current_panel_organization_id()
    AND public.current_panel_has_discipline_access(target_scope, 'write')
  )
  WITH CHECK (
    organization_id = public.current_panel_organization_id()
    AND public.current_panel_has_discipline_access(target_scope, 'write')
  );

CREATE POLICY disciplinary_warnings_delete ON public.disciplinary_warnings
  FOR DELETE TO anon, authenticated
  USING (
    organization_id = public.current_panel_organization_id()
    AND public.current_panel_has_discipline_access(target_scope, 'write')
  );

CREATE POLICY disciplinary_sanctions_read ON public.disciplinary_sanctions
  FOR SELECT TO anon, authenticated
  USING (
    organization_id = public.current_panel_organization_id()
    AND (
      (target_scope = 'departments' AND target_discord_id = public.current_panel_discord_id())
      OR public.current_panel_has_discipline_access(target_scope, 'read')
      OR public.current_panel_has_discipline_access(target_scope, 'sanction')
    )
  );

CREATE POLICY disciplinary_sanctions_write ON public.disciplinary_sanctions
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    organization_id = public.current_panel_organization_id()
    AND public.current_panel_has_discipline_access(target_scope, 'sanction')
  );

CREATE POLICY disciplinary_sanctions_update ON public.disciplinary_sanctions
  FOR UPDATE TO anon, authenticated
  USING (
    organization_id = public.current_panel_organization_id()
    AND public.current_panel_has_discipline_access(target_scope, 'sanction')
  )
  WITH CHECK (
    organization_id = public.current_panel_organization_id()
    AND public.current_panel_has_discipline_access(target_scope, 'sanction')
  );

CREATE POLICY disciplinary_sanctions_delete ON public.disciplinary_sanctions
  FOR DELETE TO anon, authenticated
  USING (
    organization_id = public.current_panel_organization_id()
    AND public.current_panel_has_discipline_access(target_scope, 'sanction')
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.disciplinary_warnings TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.disciplinary_sanctions TO anon, authenticated;
GRANT ALL ON public.disciplinary_warnings TO service_role;
GRANT ALL ON public.disciplinary_sanctions TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'disciplinary_warnings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.disciplinary_warnings;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'disciplinary_sanctions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.disciplinary_sanctions;
  END IF;
END $$;
