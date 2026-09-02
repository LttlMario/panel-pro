-- Separă webhookurile globale pentru Sugestii de cele pentru Rate the Panel.
-- Cheile public_community_webhook_* existente rămân dedicate sugestiilor.

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
      ('discord_pontaj_webhook_url', 'Webhook pontaj de rezervă'),
      ('public_community_webhook_primary', 'Webhook sugestii · Discord principal'),
      ('public_community_webhook_secondary', 'Webhook sugestii · Discord secundar'),
      ('public_rating_webhook_primary', 'Webhook rating · Discord principal'),
      ('public_rating_webhook_secondary', 'Webhook rating · Discord secundar')
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
    'discord_pontaj_webhook_url', 'public_community_webhook_primary',
    'public_community_webhook_secondary', 'public_rating_webhook_primary',
    'public_rating_webhook_secondary'
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
    PERFORM vault.create_secret(secret_value, secret_name, 'Secret administrat din Panel Pro');
  ELSE
    PERFORM vault.update_secret(secret_id, secret_value, secret_name, 'Secret administrat din Panel Pro');
  END IF;
  RETURN jsonb_build_object('ok', true, 'name', secret_name, 'configured', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_panel_platform_secret_status() TO service_role;
GRANT EXECUTE ON FUNCTION public.set_panel_platform_secret(text, text) TO service_role;
