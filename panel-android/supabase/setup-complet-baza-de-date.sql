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
  colleague_name text,
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
  discord_close_notified_at timestamptz,
  discord_close_notification_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shifts_type_check check (shift_type in ('zi', 'noapte')),
  constraint shifts_status_check check (status in ('active', 'paused', 'completed', 'auto_completed')),
  constraint shifts_paused_seconds_check check (paused_seconds >= 0),
  constraint shifts_duration_ms_check check (duration_ms >= 0)
);

-- Compatibilitate cu un tabel shifts creat înainte de noul sistem de pontaj.
alter table public.shifts add column if not exists started_at timestamptz;
alter table public.shifts add column if not exists colleague_name text;
alter table public.shifts add column if not exists ended_at timestamptz;
alter table public.shifts add column if not exists auto_stop_at timestamptz;
alter table public.shifts add column if not exists status text not null default 'completed';
alter table public.shifts add column if not exists paused_at timestamptz;
alter table public.shifts add column if not exists discord_close_notified_at timestamptz;
alter table public.shifts add column if not exists discord_close_notification_error text;
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

-- ================================================================
-- EXTENSIILE V2.9.0: LOCAȚII, ROLURI, COMUNITATE ȘI CONFIGURARE
-- ================================================================
alter table public.marketplace add column if not exists created_by_discord_id text;
alter table public.marketplace_ilegal add column if not exists created_by_discord_id text;
create index if not exists marketplace_created_by_idx on public.marketplace(created_by_discord_id);
create index if not exists marketplace_ilegal_created_by_idx on public.marketplace_ilegal(created_by_discord_id);

create table if not exists public.illegal_locations (
  id text primary key,
  map_key text not null check (map_key in ('ls','cayo','maldive')),
  category text not null,
  title text not null,
  description text not null default '',
  images jsonb not null default '[]'::jsonb,
  x numeric(6,2) not null check (x between 0 and 100),
  y numeric(6,2) not null check (y between 0 and 100),
  notes text not null default '',
  requirements text not null default '',
  rewards text not null default '',
  last_updated date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists illegal_locations_map_category_idx on public.illegal_locations(map_key,category);

create table if not exists public.discord_role_mappings (
  discord_role_id text primary key,
  discord_role_name text not null,
  panel_role text not null,
  permission_level smallint not null check(permission_level between 1 and 7),
  priority smallint not null default 0,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.discord_role_mappings(discord_role_id,discord_role_name,panel_role,permission_level,priority)
values
 ('1526734796125114488','El Mecanico','El Mecanico',1,10),
 ('1530174614951690250','Sef Mecanic','Sef Mecanic',2,20),
 ('1526734716760227930','La Familia','Familia',3,30),
 ('1528828654187184318','Manager','Manager',4,40),
 ('1526734654202319068','Co Lider','Co Lider',5,50),
 ('1526734209304105091','Lider','Lider',6,60),
 ('1526736781700104212','Coordonator','Coordonator',7,70)
on conflict(discord_role_id) do update set discord_role_name=excluded.discord_role_name,panel_role=excluded.panel_role,permission_level=excluded.permission_level,priority=excluded.priority,enabled=true,updated_at=now();

create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  post_type text not null check(post_type in('announcement','question','poll')),
  audience text not null check(audience in('family','mechanics')),
  title text not null check(length(title) between 1 and 140),
  content text not null default '' check(length(content) between 0 and 4000),
  author_discord_id text not null,
  author_name text not null,
  discord_message_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.community_poll_options(id uuid primary key default gen_random_uuid(),post_id uuid not null references public.community_posts(id) on delete cascade,option_text text not null,position smallint not null default 0);
create table if not exists public.community_poll_votes(id uuid primary key default gen_random_uuid(),post_id uuid not null references public.community_posts(id) on delete cascade,option_id uuid not null references public.community_poll_options(id) on delete cascade,user_discord_id text not null,created_at timestamptz not null default now(),unique(post_id,user_discord_id));
create table if not exists public.community_reactions(id uuid primary key default gen_random_uuid(),post_id uuid not null references public.community_posts(id) on delete cascade,user_discord_id text not null,reaction text not null check(reaction in('👍','❤️','✅','🤔')),created_at timestamptz not null default now(),unique(post_id,user_discord_id,reaction));

create table if not exists public.discord_panel_config (
  id smallint primary key default 1 check(id=1),discord_client_id text not null,guild_id text not null,panel_public_url text not null,
  family_role_id text,mechanics_role_id text,family_webhook_url text,mechanics_webhook_url text,pontaj_webhook_url text,
  requests_webhook_url text,contracts_webhook_url text,marketplace_webhook_url text,illegal_marketplace_webhook_url text,
  updated_by_discord_id text,updated_at timestamptz not null default now()
);

create or replace function public.get_discord_oauth_config()
returns table(discord_client_id text) language sql stable security definer set search_path=''
as $$ select config.discord_client_id from public.discord_panel_config config where config.id=1 $$;
revoke all on function public.get_discord_oauth_config() from public;
grant execute on function public.get_discord_oauth_config() to anon,authenticated;

create or replace function public.get_user_directory()
returns table(discord_id text,display_name text) language sql stable security definer set search_path=''
as $$ select u.discord_id,coalesce(nullif(trim(u.display_name),''),nullif(trim(u.username),''),'Mecanic') from public.users u where u.discord_id is not null $$;
revoke all on function public.get_user_directory() from public;
grant execute on function public.get_user_directory() to anon,authenticated;

alter table public.illegal_locations enable row level security;
alter table public.discord_role_mappings enable row level security;
alter table public.community_posts enable row level security;
alter table public.community_poll_options enable row level security;
alter table public.community_poll_votes enable row level security;
alter table public.community_reactions enable row level security;
alter table public.discord_panel_config enable row level security;
revoke all on table public.discord_panel_config from anon,authenticated;

grant usage on schema public to anon;
do $$ declare table_name text; begin
  foreach table_name in array array['users','shifts','absences','app_settings','marketplace','marketplace_ilegal','profiles','illegal_locations'] loop
    execute format('grant select,insert,update,delete on table public.%I to anon',table_name);
    execute format('drop policy if exists "anon_full_access" on public.%I',table_name);
    execute format('create policy "anon_full_access" on public.%I for all to anon using(true) with check(true)',table_name);
  end loop;
end $$;
drop policy if exists "role mappings readable by anon" on public.discord_role_mappings;
create policy "role mappings readable by anon" on public.discord_role_mappings for select to anon using(true);
drop policy if exists "community posts readable" on public.community_posts;
create policy "community posts readable" on public.community_posts for select to anon using(true);
drop policy if exists "poll options readable" on public.community_poll_options;
create policy "poll options readable" on public.community_poll_options for select to anon using(true);
drop policy if exists "poll votes readable" on public.community_poll_votes;
create policy "poll votes readable" on public.community_poll_votes for select to anon using(true);
drop policy if exists "reactions readable" on public.community_reactions;
create policy "reactions readable" on public.community_reactions for select to anon using(true);

do $$ begin alter publication supabase_realtime add table public.community_posts; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.community_poll_options; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.community_poll_votes; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.community_reactions; exception when duplicate_object then null; end $$;

create extension if not exists pg_cron with schema extensions;
create or replace function public.cleanup_panel_data_older_than_30_days() returns void language plpgsql security definer set search_path='' as $$
declare cutoff timestamptz:=now()-interval '30 days'; begin
 delete from public.community_posts where created_at<cutoff;
 delete from public.marketplace where created_at<cutoff;
 delete from public.marketplace_ilegal where created_at<cutoff;
 delete from public.absences where coalesce(end_at,start_at,created_at)<cutoff;
 delete from public.shifts where status in('completed','auto_completed') and coalesce(ended_at,created_at)<cutoff;
end $$;
revoke all on function public.cleanup_panel_data_older_than_30_days() from public,anon,authenticated;
do $$ declare job bigint; begin select jobid into job from cron.job where jobname='panel-cleanup-after-30-days' limit 1;if job is not null then perform cron.unschedule(job);end if;end $$;
select cron.schedule('panel-cleanup-after-30-days','17 3 * * *',$command$select public.cleanup_panel_data_older_than_30_days();$command$);

-- După rularea acestui SQL, deployează toate directoarele din supabase/functions.

-- Diagnostic administrativ: raportează exclusiv existența tabelelor, RLS și jobul de curățare.
create or replace function public.get_panel_system_diagnostics()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  required_tables text[] := array['users','shifts','absences','app_settings','marketplace','marketplace_ilegal','illegal_locations','discord_panel_config','discord_role_mappings','community_posts','community_poll_options','community_poll_votes','community_reactions'];
  table_name text; missing_tables text[] := array[]::text[]; rls_disabled text[] := array[]::text[]; cleanup_active boolean := false;
begin
  foreach table_name in array required_tables loop
    if to_regclass('public.' || table_name) is null then missing_tables := array_append(missing_tables, table_name);
    elsif not coalesce((select c.relrowsecurity from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=table_name), false) then rls_disabled := array_append(rls_disabled, table_name);
    end if;
  end loop;
  if to_regclass('cron.job') is not null then execute 'select exists(select 1 from cron.job where jobname = $1 and active)' into cleanup_active using 'panel-cleanup-after-30-days'; end if;
  return jsonb_build_object('missing_tables',to_jsonb(missing_tables),'rls_disabled_tables',to_jsonb(rls_disabled),'cleanup_cron_active',cleanup_active);
end; $$;
revoke all on function public.get_panel_system_diagnostics() from public, anon, authenticated;

-- ================================================================
-- JURNAL ADMINISTRATIV ȘI CENTRU DE NOTIFICĂRI
-- ================================================================
create table if not exists public.admin_audit_log(id bigint generated by default as identity primary key,actor_discord_id text not null,actor_name text,action text not null,target_type text,target_id text,details jsonb not null default '{}'::jsonb,created_at timestamptz not null default now());
create table if not exists public.panel_notifications(id bigint generated by default as identity primary key,recipient_discord_id text,title text not null check(length(title) between 1 and 120),message text not null check(length(message) between 1 and 1000),level text not null default 'info' check(level in('info','success','warning','error')),link text,expires_at timestamptz,created_at timestamptz not null default now());
create table if not exists public.panel_notification_reads(notification_id bigint references public.panel_notifications(id) on delete cascade,discord_id text not null,read_at timestamptz not null default now(),primary key(notification_id,discord_id));
create index if not exists audit_created_at_idx on public.admin_audit_log(created_at desc);
create index if not exists notifications_recipient_idx on public.panel_notifications(recipient_discord_id,created_at desc);
alter table public.admin_audit_log enable row level security;alter table public.panel_notifications enable row level security;alter table public.panel_notification_reads enable row level security;
revoke all on public.admin_audit_log,public.panel_notifications,public.panel_notification_reads from anon,authenticated;
grant select on public.admin_audit_log to anon;
drop policy if exists anon_audit_read on public.admin_audit_log;
create policy anon_audit_read on public.admin_audit_log for select to anon using(true);

