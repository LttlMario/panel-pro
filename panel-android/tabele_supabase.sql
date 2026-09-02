-- WORKFORCE MANAGEMENT PANEL - instalare completă Supabase
-- Rulează acest fișier în: Supabase Dashboard > SQL Editor > New query > Run.
-- Nu conține chei API, parole sau webhook-uri.

create extension if not exists pgcrypto;

-- ================================================================
-- UTILIZATORI (profilul creat la autentificarea Discord)
-- ================================================================
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  discord_id text not null unique,
  username text,
  display_name text,
  email text,
  avatar text,
  avatar_url text,
  role text not null default 'Mecanic',
  default_role text not null default 'Mecanic',
  service text not null default 'Atelier',
  maintenance_mode boolean not null default false,
  discord_logs_active boolean not null default true,
  threshold_value numeric not null default 0,
  max_shift_hours numeric not null default 8,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.users add column if not exists avatar_url text;
alter table public.users add column if not exists role text not null default 'Mecanic';
alter table public.users add column if not exists default_role text not null default 'Mecanic';
alter table public.users add column if not exists service text not null default 'Atelier';
alter table public.users add column if not exists maintenance_mode boolean not null default false;
alter table public.users add column if not exists discord_logs_active boolean not null default true;
alter table public.users add column if not exists threshold_value numeric not null default 0;
alter table public.users add column if not exists max_shift_hours numeric not null default 8;
alter table public.users add column if not exists updated_at timestamptz not null default now();

-- ================================================================
-- PONTAJE
-- ================================================================
create table if not exists public.shifts (
  id uuid primary key default gen_random_uuid(),
  discord_id text not null,
  date date not null default current_date,
  start_time time without time zone not null,
  end_time time without time zone,
  duration text not null default '00:00:00',
  duration_ms bigint not null default 0,
  shift_type text not null default 'zi',
  status text not null default 'completed',
  started_at timestamptz,
  ended_at timestamptz,
  auto_stop_at timestamptz,
  paused_at timestamptz,
  paused_seconds integer not null default 0,
  stop_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shifts_type_check check (shift_type in ('zi', 'noapte')),
  constraint shifts_status_check check (status in ('active', 'paused', 'completed', 'auto_completed')),
  constraint shifts_paused_seconds_check check (paused_seconds >= 0),
  constraint shifts_duration_ms_check check (duration_ms >= 0)
);

-- Compatibilitate cu un tabel shifts creat înainte de noul sistem de pontaj.
alter table public.shifts add column if not exists started_at timestamptz;
alter table public.shifts add column if not exists ended_at timestamptz;
alter table public.shifts add column if not exists auto_stop_at timestamptz;
alter table public.shifts add column if not exists status text not null default 'completed';
alter table public.shifts add column if not exists paused_at timestamptz;
alter table public.shifts add column if not exists paused_seconds integer not null default 0;
alter table public.shifts add column if not exists stop_reason text;
alter table public.shifts add column if not exists updated_at timestamptz not null default now();

create index if not exists shifts_discord_id_created_at_idx on public.shifts (discord_id, created_at desc);
create index if not exists shifts_status_auto_stop_at_idx on public.shifts (status, auto_stop_at);
create index if not exists shifts_date_idx on public.shifts (date desc);

-- Împiedică două ture active/pauzate pentru aceeași persoană.
create unique index if not exists shifts_one_open_shift_per_user_idx
  on public.shifts (discord_id)
  where status in ('active', 'paused') and end_time is null;

-- ================================================================
-- ÎNVOIRI / ABSENȚE
-- ================================================================
create table if not exists public.absences (
  id uuid primary key default gen_random_uuid(),
  discord_id text not null,
  colleague_name text,
  notice_type text not null default 'Învoire',
  reason text,
  start_date date,
  days integer not null default 1,
  notes text,
  start_at timestamptz,
  end_at timestamptz,
  proof_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint absences_days_check check (days > 0),
  constraint absences_period_check check (end_at is null or start_at is null or end_at > start_at)
);

alter table public.absences add column if not exists colleague_name text;
alter table public.absences add column if not exists notice_type text not null default 'Învoire';
alter table public.absences add column if not exists reason text;
alter table public.absences add column if not exists start_date date;
alter table public.absences add column if not exists days integer not null default 1;
alter table public.absences add column if not exists notes text;
alter table public.absences add column if not exists start_at timestamptz;
alter table public.absences add column if not exists end_at timestamptz;
alter table public.absences add column if not exists proof_url text;
alter table public.absences add column if not exists updated_at timestamptz not null default now();

create index if not exists absences_discord_id_created_at_idx on public.absences (discord_id, created_at desc);
create index if not exists absences_end_at_idx on public.absences (end_at);

-- ================================================================
-- SETĂRI GLOBALE (limite pontaj configurate din admin.html)
-- ================================================================
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.app_settings (key, value)
values ('pontaj_config', '{"maxHours": 12, "dayEndTime": "19:59", "nightEndTime": "23:00", "excludeBreaks": false}'::jsonb)
on conflict (key) do nothing;

-- ================================================================
-- MARKETPLACE LEGAL ȘI ILEGAL
-- ================================================================
create table if not exists public.marketplace (
  id uuid primary key default gen_random_uuid(),
  nume text not null,
  display_name text,
  telefon text,
  tip_actiune text not null,
  categorie text,
  produse text,
  pret text,
  imagini_json text,
  imagine_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketplace_ilegal (
  id uuid primary key default gen_random_uuid(),
  nume text not null,
  telefon text,
  tip_actiune text not null,
  categorie text,
  subcategorie text,
  produse text,
  pret text,
  imagini_json text,
  imagine_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.marketplace add column if not exists display_name text;
alter table public.marketplace add column if not exists imagini_json text;
alter table public.marketplace add column if not exists imagine_url text;
alter table public.marketplace add column if not exists updated_at timestamptz not null default now();
alter table public.marketplace_ilegal add column if not exists subcategorie text;
alter table public.marketplace_ilegal add column if not exists imagini_json text;
alter table public.marketplace_ilegal add column if not exists imagine_url text;
alter table public.marketplace_ilegal add column if not exists updated_at timestamptz not null default now();

create index if not exists marketplace_created_at_idx on public.marketplace (created_at desc);
create index if not exists marketplace_ilegal_created_at_idx on public.marketplace_ilegal (created_at desc);

-- Tabel opțional, folosit doar ca rezervă la afișarea numelor în rapoarte.
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  discord_id text unique,
  username text,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Actualizează automat updated_at la orice modificare.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at before update on public.users
for each row execute function public.set_updated_at();

drop trigger if exists shifts_set_updated_at on public.shifts;
create trigger shifts_set_updated_at before update on public.shifts
for each row execute function public.set_updated_at();

drop trigger if exists absences_set_updated_at on public.absences;
create trigger absences_set_updated_at before update on public.absences
for each row execute function public.set_updated_at();

drop trigger if exists marketplace_set_updated_at on public.marketplace;
create trigger marketplace_set_updated_at before update on public.marketplace
for each row execute function public.set_updated_at();

drop trigger if exists marketplace_ilegal_set_updated_at on public.marketplace_ilegal;
create trigger marketplace_ilegal_set_updated_at before update on public.marketplace_ilegal
for each row execute function public.set_updated_at();

-- Realtime este necesar ca rapoarte.html să actualizeze lista turelor active imediat.
do $$
begin
  alter publication supabase_realtime add table public.shifts;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.absences;
exception when duplicate_object then null;
end $$;

-- RLS rămâne activ. Cheia de server folosită de Edge Function îl ocolește;
-- nu adăuga politici "public all" într-un proiect pus online.
alter table public.users enable row level security;
alter table public.shifts enable row level security;
alter table public.absences enable row level security;
alter table public.app_settings enable row level security;
alter table public.marketplace enable row level security;
alter table public.marketplace_ilegal enable row level security;
alter table public.profiles enable row level security;

drop policy if exists "authenticated users can read app settings" on public.app_settings;
create policy "authenticated users can read app settings"
on public.app_settings for select to authenticated using (true);

-- Pentru închiderea automată: deploy-ul Edge Function rămâne separat.
-- După deploy, rulează și conținutul din:
-- supabase/migrations/20260728_schedule_close_expired_shifts.sql
