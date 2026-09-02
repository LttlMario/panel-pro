-- Confirmările automate sunt urmărite separat și pot fi retrimise de Edge Function.
alter table public.shifts
  add column if not exists discord_close_notified_at timestamptz,
  add column if not exists discord_close_notification_error text;

-- Nu retrimitem confirmări pentru ture istorice, create înaintea acestui sistem.
update public.shifts
set discord_close_notified_at = coalesce(ended_at, updated_at, created_at, now())
where status = 'auto_completed'
  and discord_close_notified_at is null;

create index if not exists shifts_pending_auto_discord_notification_idx
  on public.shifts (auto_stop_at)
  where status = 'auto_completed' and discord_close_notified_at is null;

