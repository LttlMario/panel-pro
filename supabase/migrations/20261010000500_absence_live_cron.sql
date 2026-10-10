-- Actualizează embedurile „Învoiri active” pentru toate organizațiile active.
-- Se editează mesajul existent; funcția îl repostează doar când primește
-- explicit force_repost (de exemplu după o învoire nouă).
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

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
