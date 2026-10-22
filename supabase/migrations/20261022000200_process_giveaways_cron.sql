BEGIN;
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-giveaways') THEN
    PERFORM cron.unschedule('process-giveaways');
  END IF;
END $$;
SELECT cron.schedule(
  'process-giveaways',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/process-giveaways',
    headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'publishable_key'), 'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')),
    body := jsonb_build_object('action', 'process')
  );
  $$
);
COMMIT;
