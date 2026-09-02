-- Curățare automată a datelor operaționale mai vechi de 30 de zile.
-- Tabelele users, profiles, discord_role_mappings, app_settings și illegal_locations NU sunt atinse.

create extension if not exists pg_cron with schema extensions;

create or replace function public.cleanup_panel_data_older_than_30_days()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  cutoff timestamptz := now() - interval '30 days';
begin
  -- Opțiunile, voturile și reacțiile se șterg automat prin ON DELETE CASCADE.
  delete from public.community_posts
  where created_at < cutoff;

  delete from public.marketplace
  where created_at < cutoff;

  delete from public.marketplace_ilegal
  where created_at < cutoff;

  -- Se șterg numai cererile a căror perioadă este deja veche de 30 de zile.
  delete from public.absences
  where coalesce(end_at, start_at, created_at) < cutoff;

  -- O tură activă sau aflată în pauză nu este ștearsă niciodată de această regulă.
  delete from public.shifts
  where status in ('completed', 'auto_completed')
    and coalesce(ended_at, created_at) < cutoff;
end;
$$;

revoke all on function public.cleanup_panel_data_older_than_30_days() from public;
revoke all on function public.cleanup_panel_data_older_than_30_days() from anon;
revoke all on function public.cleanup_panel_data_older_than_30_days() from authenticated;

do $$
declare
  existing_job bigint;
begin
  select jobid into existing_job
  from cron.job
  where jobname = 'panel-cleanup-after-30-days'
  limit 1;

  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;
end;
$$;

-- Rulează zilnic la 03:17 UTC (06:17 ora României vara).
select cron.schedule(
  'panel-cleanup-after-30-days',
  '17 3 * * *',
  $command$select public.cleanup_panel_data_older_than_30_days();$command$
);
