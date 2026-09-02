-- Raportul săptămânal rulează server-side, fără să depindă de un browser deschis.
create extension if not exists pg_net;
create extension if not exists pg_cron;

create table if not exists public.scheduled_report_runs (
  id uuid primary key default gen_random_uuid(),
  report_key text not null,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  status text not null default 'processing'
    check (status in ('processing', 'sent', 'skipped', 'failed')),
  error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (report_key, organization_id, period_start, period_end)
);

alter table public.scheduled_report_runs enable row level security;
revoke all on table public.scheduled_report_runs from anon, authenticated;

select cron.unschedule(jobid)
from cron.job
where jobname = 'invoke-weekly-shift-report';

select cron.schedule(
  'invoke-weekly-shift-report',
  '* * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/send-weekly-shift-report',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'publishable_key'),
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
