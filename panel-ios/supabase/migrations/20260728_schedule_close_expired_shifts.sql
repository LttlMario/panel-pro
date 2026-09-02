create extension if not exists pg_net;
create extension if not exists pg_cron;

-- Înlocuiește valorile cu cele ale proiectului tău înainte de rulare.
select vault.create_secret('https://PROJECT_REF.supabase.co', 'project_url');
select vault.create_secret('SUPABASE_PUBLISHABLE_KEY', 'publishable_key');
select vault.create_secret('ALEGE_UN_SECRET_LUNG', 'cron_secret');

select cron.unschedule(jobid)
from cron.job
where jobname in ('close-expired-shifts', 'invoke-close-expired-shifts');

select cron.schedule(
  'invoke-close-expired-shifts',
  '* * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/close-expired-shifts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'publishable_key'),
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
