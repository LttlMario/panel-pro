-- Repară turele rămase active și păstrează numele Discord în pontaje.
create extension if not exists pg_cron;

-- Compatibilitate cu tabelul shifts creat de versiunile mai vechi ale panelului.
alter table public.shifts add column if not exists updated_at timestamptz not null default now();

-- Unele proiecte mai vechi au deja o restricție de status care permite doar
-- valorile active/paused/completed. ADD COLUMN IF NOT EXISTS nu o actualizează,
-- deci o recreăm explicit înainte de a folosi auto_completed.
alter table public.shifts drop constraint if exists shifts_status_check;
alter table public.shifts
  add constraint shifts_status_check
  check (status in ('active', 'paused', 'completed', 'auto_completed'));

create or replace function public.fill_shift_colleague_name()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.colleague_name is null or btrim(new.colleague_name) = '' then
    select coalesce(nullif(btrim(u.display_name), ''), nullif(btrim(u.username), ''))
      into new.colleague_name
    from public.users u
    where btrim(u.discord_id) = btrim(new.discord_id)
    limit 1;
  end if;
  return new;
end;
$$;

drop trigger if exists shifts_fill_colleague_name on public.shifts;
create trigger shifts_fill_colleague_name
before insert or update of discord_id, colleague_name on public.shifts
for each row execute function public.fill_shift_colleague_name();

-- Completează imediat și înregistrările existente care nu au nume.
update public.shifts s
set colleague_name = coalesce(nullif(btrim(u.display_name), ''), nullif(btrim(u.username), ''))
from public.users u
where btrim(s.discord_id) = btrim(u.discord_id)
  and (s.colleague_name is null or btrim(s.colleague_name) = '');

-- Când porecla este actualizată la login, aceasta devine numele afișat pentru
-- toate turele persoanei, inclusiv pentru istoricul deja salvat.
create or replace function public.sync_user_name_to_shifts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare resolved_name text;
begin
  resolved_name := coalesce(nullif(btrim(new.display_name), ''), nullif(btrim(new.username), ''));
  if resolved_name is not null then
    update public.shifts
    set colleague_name = resolved_name
    where btrim(discord_id) = btrim(new.discord_id)
      and colleague_name is distinct from resolved_name;
  end if;
  return new;
end;
$$;

drop trigger if exists users_sync_name_to_shifts on public.users;
create trigger users_sync_name_to_shifts
after insert or update of display_name, username on public.users
for each row execute function public.sync_user_name_to_shifts();

-- Închiderea bazei de date nu mai depinde de un browser deschis sau de
-- configurarea URL-ului Edge Function.
create or replace function public.close_expired_shifts_in_database()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare affected integer;
begin
  update public.shifts s
  set status = 'auto_completed',
      ended_at = now(),
      end_time = (now() at time zone 'Europe/Bucharest')::time,
      duration_ms = greatest(0, floor(extract(epoch from (now() - s.started_at)))::bigint - coalesce(s.paused_seconds, 0)) * 1000,
      duration = to_char(
        make_interval(secs => greatest(0, floor(extract(epoch from (now() - s.started_at)))::integer - coalesce(s.paused_seconds, 0))),
        'HH24:MI:SS'
      ),
      stop_reason = 'Încheiere automată – ora configurată a fost atinsă',
      updated_at = now()
  where s.status in ('active', 'paused')
    and s.end_time is null
    and s.auto_stop_at is not null
    -- Edge Function primește două minute pentru închidere + mesajul Discord;
    -- această funcție este plasa de siguranță dacă apelul HTTP eșuează.
    and s.auto_stop_at <= now() - interval '2 minutes';
  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke all on function public.close_expired_shifts_in_database() from public, anon, authenticated;

do $$
declare existing_job bigint;
begin
  select jobid into existing_job from cron.job where jobname = 'close-expired-shifts-in-database' limit 1;
  if existing_job is not null then perform cron.unschedule(existing_job); end if;
end $$;

select cron.schedule(
  'close-expired-shifts-in-database',
  '* * * * *',
  $command$select public.close_expired_shifts_in_database();$command$
);

-- Repară chiar la instalare turele deja expirate și blocate.
select public.close_expired_shifts_in_database();
