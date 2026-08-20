-- Actualizează Status Live server-side, chiar dacă pagina nu este deschisă.
-- Folosește aceleași secrete Vault configurate pentru raportul săptămânal.

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
      settings.webhook_routes->'status_live'->'primary'->>'enabled' = 'true'
      OR settings.webhook_routes->'status_live'->'secondary'->>'enabled' = 'true'
    );
  $$
);
