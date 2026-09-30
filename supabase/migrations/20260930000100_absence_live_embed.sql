-- Embed persistent pentru învoirile active din logurile Discord.
-- Se actualizează o dată pe minut și elimină automat învoirile expirate.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'invoke-absence-live-sync';

SELECT cron.schedule(
  'invoke-absence-live-sync',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/absence-live-sync',
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
      NULLIF(TRIM(settings.discord_channel_routes->'log_requests_organization'->'primary'->>'channel_id'), '') IS NOT NULL
      OR NULLIF(TRIM(settings.discord_channel_routes->'log_requests_organization'->'secondary'->>'channel_id'), '') IS NOT NULL
      OR NULLIF(TRIM(settings.discord_channel_routes->'log_requests_departments'->'primary'->>'channel_id'), '') IS NOT NULL
      OR NULLIF(TRIM(settings.discord_channel_routes->'log_requests_departments'->'secondary'->>'channel_id'), '') IS NOT NULL
    );
  $$
);
