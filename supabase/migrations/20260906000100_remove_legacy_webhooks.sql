-- Panel Pro: dezactivează definitiv transportul Discord prin webhook.
-- Trimiterea activă se face exclusiv prin bot și discord_channel_routes.
-- Nu șterge organizații, mesaje, canale sau istoricul aplicației.

BEGIN;

UPDATE public.organization_settings
SET webhook_routes = '{}'::jsonb,
    updated_at = now()
WHERE webhook_routes IS DISTINCT FROM '{}'::jsonb;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'organization_settings'
      AND column_name = 'family_webhook_url'
  ) THEN
    EXECUTE 'UPDATE public.organization_settings
             SET family_webhook_url = NULL,
                 mechanics_webhook_url = NULL,
                 pontaj_webhook_url = NULL,
                 requests_webhook_url = NULL,
                 contracts_webhook_url = NULL,
                 marketplace_webhook_url = NULL,
                 illegal_marketplace_webhook_url = NULL';
  END IF;
END $$;

DELETE FROM vault.secrets
WHERE name IN (
  'discord_pontaj_webhook_url',
  'public_community_webhook_primary',
  'public_community_webhook_secondary',
  'public_rating_webhook_primary',
  'public_rating_webhook_secondary'
);

COMMIT;

SELECT name
FROM vault.secrets
WHERE name ILIKE '%webhook%';
