-- Pornește Status Live și pentru rutele configurate prin bot.
-- Webhook-urile rămân compatibile ca fallback.
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
  LEFT JOIN public.organization_settings AS settings
    ON settings.organization_id = org.id
  WHERE org.active = true
    AND (
      (
        settings.discord_channel_routes->'status_live'->'primary'->>'enabled' IS DISTINCT FROM 'false'
        AND NULLIF(TRIM(settings.discord_channel_routes->'status_live'->'primary'->>'channel_id'), '') IS NOT NULL
      )
      OR (
        settings.discord_channel_routes->'status_live'->'secondary'->>'enabled' IS DISTINCT FROM 'false'
        AND NULLIF(TRIM(settings.discord_channel_routes->'status_live'->'secondary'->>'channel_id'), '') IS NOT NULL
      )
      OR (
        settings.webhook_routes->'status_live'->'primary'->>'enabled' IS DISTINCT FROM 'false'
        AND NULLIF(TRIM(settings.webhook_routes->'status_live'->'primary'->>'url'), '') IS NOT NULL
      )
      OR (
        settings.webhook_routes->'status_live'->'secondary'->>'enabled' IS DISTINCT FROM 'false'
        AND NULLIF(TRIM(settings.webhook_routes->'status_live'->'secondary'->>'url'), '') IS NOT NULL
      )
    );
  $$
);
