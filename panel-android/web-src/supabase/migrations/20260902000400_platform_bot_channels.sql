-- Canalele globale pentru mesajele trimise de bot.
-- Webhook-urile istorice rămân în Vault pentru compatibilitate, dar nu mai
-- sunt citite de funcțiile de trimitere.

CREATE OR REPLACE FUNCTION public.get_panel_platform_secret_status()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, vault, pg_temp
AS $$
  WITH allowed(name, label) AS (
    VALUES
      ('project_url', 'URL Supabase'),
      ('publishable_key', 'Cheie publică Supabase'),
      ('cron_secret', 'Secret cron'),
      ('discord_bot_token', 'Token bot Discord'),
      ('platform_owner_discord_ids', 'ID-uri administratori globali'),
      ('status_live_cron_secret', 'Secret cron Status Live'),
      ('public_community_channel_primary', 'Feedback global · bot · Discord principal'),
      ('public_community_channel_secondary', 'Feedback global · bot · Discord secundar'),
      ('public_rating_channel_primary', 'Rate the Panel · bot · Discord principal'),
      ('public_rating_channel_secondary', 'Rate the Panel · bot · Discord secundar')
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'name', allowed.name,
    'label', allowed.label,
    'configured', secrets.id IS NOT NULL AND secrets.secret IS NOT NULL,
    'updated_at', secrets.updated_at
  ) ORDER BY allowed.name), '[]'::jsonb)
  FROM allowed
  LEFT JOIN vault.secrets AS secrets ON secrets.name = allowed.name;
$$;

CREATE OR REPLACE FUNCTION public.set_panel_platform_secret(secret_name text, secret_value text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, pg_temp
AS $$
DECLARE
  secret_id uuid;
BEGIN
  IF secret_name NOT IN (
    'project_url', 'publishable_key', 'cron_secret', 'discord_bot_token',
    'platform_owner_discord_ids', 'status_live_cron_secret',
    'public_community_channel_primary', 'public_community_channel_secondary',
    'public_rating_channel_primary', 'public_rating_channel_secondary'
  ) THEN
    RAISE EXCEPTION 'Secret nepermis.' USING ERRCODE = '22023';
  END IF;
  IF NULLIF(btrim(secret_value), '') IS NULL THEN
    RAISE EXCEPTION 'Valoarea secretului nu poate fi goală.' USING ERRCODE = '22023';
  END IF;
  IF length(secret_value) > 10000 THEN
    RAISE EXCEPTION 'Valoarea secretului este prea lungă.' USING ERRCODE = '22023';
  END IF;

  SELECT id INTO secret_id FROM vault.secrets WHERE name = secret_name LIMIT 1;
  IF secret_id IS NULL THEN
    PERFORM vault.create_secret(secret_value, secret_name, 'Valoare administrată din Panel Pro');
  ELSE
    PERFORM vault.update_secret(secret_id, secret_value, secret_name, 'Valoare administrată din Panel Pro');
  END IF;
  RETURN jsonb_build_object('ok', true, 'name', secret_name, 'configured', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_panel_platform_secret_status() TO service_role;
GRANT EXECUTE ON FUNCTION public.set_panel_platform_secret(text, text) TO service_role;

-- Reaplică jobul Status Live fără nicio condiție sau rută de webhook.
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'invoke-status-live-sync';

SELECT cron.schedule(
  'invoke-status-live-sync',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/status-live-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'publishable_key'),
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
    ),
    body := jsonb_build_object('organization_id', org.id::text)
  )
  FROM public.organizations AS org
  LEFT JOIN public.organization_settings AS settings ON settings.organization_id = org.id
  WHERE org.active = true
    AND (
      NULLIF(TRIM(settings.discord_channel_routes->'status_live'->'primary'->>'channel_id'), '') IS NOT NULL
      OR NULLIF(TRIM(settings.discord_channel_routes->'status_live'->'secondary'->>'channel_id'), '') IS NOT NULL
    );
  $$
);
