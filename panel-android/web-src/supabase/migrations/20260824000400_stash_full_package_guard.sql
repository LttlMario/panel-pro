-- Stash este o resursă ilegală și este disponibilă exclusiv în pachetul Full.
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
      JOIN public.app_settings package_setting
        ON package_setting.organization_id = session.organization_id
       AND package_setting.key = 'organization_package'
      WHERE session.token_hash = encode(
        extensions.digest(
          COALESCE(NULLIF(current_setting('request.headers', true), '')::jsonb->>'x-panel-session', ''),
          'sha256'
        ),
        'hex'
      )
        AND session.revoked_at IS NULL
        AND session.expires_at > now()
        AND lower(COALESCE(package_setting.value->>'code', 'standard')) = 'full'
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
