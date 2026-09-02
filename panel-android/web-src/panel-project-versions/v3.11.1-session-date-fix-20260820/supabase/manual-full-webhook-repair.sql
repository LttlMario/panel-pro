-- Reparare idempotentă pentru pachete Full, rute Discord și date legacy.
-- Nu trimite nimic către Discord.

BEGIN;

-- 1) Full trebuie să aibă catalogul complet de funcții, chiar dacă
--    valoarea veche avea features = null sau o listă incompletă.
UPDATE public.app_settings
SET value = jsonb_set(
  COALESCE(value, '{}'::jsonb),
  '{features}',
  to_jsonb(ARRAY[
    'core',
    'announcements',
    'announcements_departments',
    'announcements_organization',
    'requests',
    'requests_departments',
    'requests_organization',
    'contracts',
    'reports',
    'legal_marketplace',
    'legal_tools',
    'assistant',
    'status_live',
    'discipline_departments',
    'discipline_organization',
    'illegal_calculator',
    'illegal_locations',
    'illegal_marketplace'
  ]::text[]),
  true
),
updated_at = now()
WHERE key = 'organization_package'
  AND value->>'code' = 'full';

-- 2) Refacește rutele din coloanele legacy numai dacă ruta nouă nu are deja
--    un URL. Rutele existente nu sunt suprascrise.
DO $$
DECLARE
  item record;
  routes jsonb;
  legacy_url text;
  valid_legacy boolean;
BEGIN
  FOR item IN
    SELECT
      organization_id,
      webhook_routes,
      family_webhook_url,
      mechanics_webhook_url,
      pontaj_webhook_url,
      requests_webhook_url,
      contracts_webhook_url,
      marketplace_webhook_url,
      illegal_marketplace_webhook_url
    FROM public.organization_settings
  LOOP
    routes := CASE
      WHEN jsonb_typeof(item.webhook_routes) = 'object' THEN item.webhook_routes
      ELSE '{}'::jsonb
    END;

    -- Legacy family -> Anunțuri organizație.
    legacy_url := nullif(trim(item.family_webhook_url), '');
    valid_legacy := legacy_url IS NOT NULL
      AND legacy_url ~* '^https://(discord\.com|discordapp\.com)/api/webhooks/';
    IF valid_legacy AND nullif(routes->'organization'->'primary'->>'url', '') IS NULL THEN
      routes := jsonb_set(routes, '{organization}', jsonb_build_object(
        'primary', jsonb_build_object('enabled', true, 'url', legacy_url),
        'secondary', NULL
      ), true);
    END IF;

    -- Legacy mechanics -> Anunțuri Birouri / Angajați.
    legacy_url := nullif(trim(item.mechanics_webhook_url), '');
    valid_legacy := legacy_url IS NOT NULL
      AND legacy_url ~* '^https://(discord\.com|discordapp\.com)/api/webhooks/';
    IF valid_legacy AND nullif(routes->'departments'->'primary'->>'url', '') IS NULL THEN
      routes := jsonb_set(routes, '{departments}', jsonb_build_object(
        'primary', jsonb_build_object('enabled', true, 'url', legacy_url),
        'secondary', NULL
      ), true);
    END IF;

    -- Legacy routes fără separare pe audiență.
    legacy_url := nullif(trim(item.requests_webhook_url), '');
    valid_legacy := legacy_url IS NOT NULL
      AND legacy_url ~* '^https://(discord\.com|discordapp\.com)/api/webhooks/';
    IF valid_legacy THEN
      IF nullif(routes->'requests_organization'->'primary'->>'url', '') IS NULL THEN
        routes := jsonb_set(routes, '{requests_organization}', jsonb_build_object(
          'primary', jsonb_build_object('enabled', true, 'url', legacy_url),
          'secondary', NULL
        ), true);
      END IF;
      IF nullif(routes->'requests_departments'->'primary'->>'url', '') IS NULL THEN
        routes := jsonb_set(routes, '{requests_departments}', jsonb_build_object(
          'primary', jsonb_build_object('enabled', true, 'url', legacy_url),
          'secondary', NULL
        ), true);
      END IF;
    END IF;

    legacy_url := nullif(trim(item.pontaj_webhook_url), '');
    valid_legacy := legacy_url IS NOT NULL
      AND legacy_url ~* '^https://(discord\.com|discordapp\.com)/api/webhooks/';
    IF valid_legacy AND nullif(routes->'pontaj'->'primary'->>'url', '') IS NULL THEN
      routes := jsonb_set(routes, '{pontaj}', jsonb_build_object(
        'primary', jsonb_build_object('enabled', true, 'url', legacy_url),
        'secondary', NULL
      ), true);
    END IF;

    legacy_url := nullif(trim(item.contracts_webhook_url), '');
    valid_legacy := legacy_url IS NOT NULL
      AND legacy_url ~* '^https://(discord\.com|discordapp\.com)/api/webhooks/';
    IF valid_legacy AND nullif(routes->'contracts'->'primary'->>'url', '') IS NULL THEN
      routes := jsonb_set(routes, '{contracts}', jsonb_build_object(
        'primary', jsonb_build_object('enabled', true, 'url', legacy_url),
        'secondary', NULL
      ), true);
    END IF;

    legacy_url := nullif(trim(item.marketplace_webhook_url), '');
    valid_legacy := legacy_url IS NOT NULL
      AND legacy_url ~* '^https://(discord\.com|discordapp\.com)/api/webhooks/';
    IF valid_legacy AND nullif(routes->'marketplace'->'primary'->>'url', '') IS NULL THEN
      routes := jsonb_set(routes, '{marketplace}', jsonb_build_object(
        'primary', jsonb_build_object('enabled', true, 'url', legacy_url),
        'secondary', NULL
      ), true);
    END IF;

    legacy_url := nullif(trim(item.illegal_marketplace_webhook_url), '');
    valid_legacy := legacy_url IS NOT NULL
      AND legacy_url ~* '^https://(discord\.com|discordapp\.com)/api/webhooks/';
    IF valid_legacy AND nullif(routes->'illegal_marketplace'->'primary'->>'url', '') IS NULL THEN
      routes := jsonb_set(routes, '{illegal_marketplace}', jsonb_build_object(
        'primary', jsonb_build_object('enabled', true, 'url', legacy_url),
        'secondary', NULL
      ), true);
    END IF;

    UPDATE public.organization_settings
    SET webhook_routes = routes,
        updated_at = now()
    WHERE organization_id = item.organization_id;
  END LOOP;
END $$;

COMMIT;

-- Verificare după rulare: nu expune URL-urile Discord.
SELECT
  o.id AS organization_id,
  o.name,
  s.value->>'code' AS package_code,
  CASE
    WHEN jsonb_typeof(s.value->'features') = 'array'
      THEN jsonb_array_length(s.value->'features')
    ELSE 0
  END AS feature_count,
  COALESCE((SELECT count(*) FROM jsonb_object_keys(CASE WHEN jsonb_typeof(os.webhook_routes) = 'object' THEN os.webhook_routes ELSE '{}'::jsonb END)), 0) AS configured_route_keys
FROM public.organizations o
LEFT JOIN public.app_settings s
  ON s.organization_id = o.id
 AND s.key = 'organization_package'
LEFT JOIN public.organization_settings os
  ON os.organization_id = o.id
ORDER BY o.name;

SELECT
  table_name,
  column_name,
  data_type,
  udt_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('panel_sessions', 'community_posts', 'organization_guilds', 'organization_settings')
  AND column_name = 'organization_id'
ORDER BY table_name;
