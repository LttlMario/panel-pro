-- Întărește izolarea organizațiilor pentru interogările directe din browser.
-- Sesiunea trebuie să fie validă, organizația activă și neexpirată, iar
-- paginile Full-only nu pot fi deschise de un pachet Standard doar printr-o
-- configurație veche de page_permissions.

CREATE OR REPLACE FUNCTION public.current_panel_organization_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT session.organization_id
  FROM public.panel_sessions AS session
  JOIN public.organizations AS organization
    ON organization.id = session.organization_id
  LEFT JOIN public.app_settings AS access_setting
    ON access_setting.organization_id = session.organization_id
   AND access_setting.key = 'organization_access'
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
    AND organization.active IS TRUE
    AND (
      access_setting.value IS NULL
      OR NULLIF(access_setting.value ->> 'expires_at', '') IS NULL
      OR (
        (access_setting.value ->> 'expires_at') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
        AND (access_setting.value ->> 'expires_at')::timestamptz > now()
      )
    )
  LIMIT 1;
$$;

ALTER FUNCTION public.current_panel_organization_id() OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.current_panel_organization_id() TO anon, authenticated;

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
    JOIN public.organizations AS organization
      ON organization.id = session.organization_id
    JOIN public.app_settings AS page_setting
      ON page_setting.organization_id = session.organization_id
     AND page_setting.key = 'page_permissions'
    LEFT JOIN public.app_settings AS access_setting
      ON access_setting.organization_id = session.organization_id
     AND access_setting.key = 'organization_access'
    LEFT JOIN public.app_settings AS package_setting
      ON package_setting.organization_id = session.organization_id
     AND package_setting.key = 'organization_package'
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
      AND organization.active IS TRUE
      AND (
        access_setting.value IS NULL
        OR NULLIF(access_setting.value ->> 'expires_at', '') IS NULL
        OR (
          (access_setting.value ->> 'expires_at') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
          AND (access_setting.value ->> 'expires_at')::timestamptz > now()
        )
      )
      AND (
        session.is_platform_admin
        OR (
          (
            LOWER(COALESCE(package_setting.value ->> 'code', 'standard')) = 'full'
            OR page_name IN (
              'index.html',
              'pontaj.html',
              'anunturi.html',
              'cereri.html',
              'contracte.html',
              'rapoarte.html',
              'marketplace.html',
              'calculator.html',
              'bucatarie.html',
              'craftmecanics.html',
              'asistent.html',
              'status-live.html'
            )
          )
          AND EXISTS (
            SELECT 1
            FROM jsonb_array_elements_text(
              COALESCE(page_setting.value -> page_name, '[]'::jsonb)
            ) AS allowed(role_id)
            WHERE role_id = ANY(COALESCE(session.discord_role_ids, '{}'::text[]))
          )
        )
      )
  );
$$;

ALTER FUNCTION public.current_panel_has_page_access(text) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.current_panel_has_page_access(text) TO anon, authenticated;
