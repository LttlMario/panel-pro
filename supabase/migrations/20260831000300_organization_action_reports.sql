-- Clasament de implicare și jurnal pentru exportul săptămânal al acțiunilor.
create extension if not exists pg_net;
create extension if not exists pg_cron;

create table if not exists public.organization_action_report_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  status text not null default 'processing' check (status in ('processing', 'sent', 'skipped', 'failed')),
  error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, period_start, period_end)
);

alter table public.organization_action_report_runs enable row level security;
revoke all on table public.organization_action_report_runs from anon, authenticated;
grant all on table public.organization_action_report_runs to service_role;

select cron.unschedule(jobid)
from cron.job
where jobname = 'invoke-weekly-action-report';

select cron.schedule(
  'invoke-weekly-action-report',
  '* * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/send-weekly-action-report',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'publishable_key'),
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
