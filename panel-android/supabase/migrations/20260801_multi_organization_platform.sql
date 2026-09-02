-- Platformă multi-organizație securizată. Rulează peste schema existentă.
create extension if not exists pgcrypto;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check(slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check(length(btrim(name)) between 2 and 100),
  code text,
  address text,
  description text,
  logo_url text,
  banner_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_guilds (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  guild_id text not null unique check(guild_id ~ '^\d{15,22}$'),
  guild_name text,
  kind text not null default 'primary' check(kind in('primary','secondary')),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique(organization_id,kind)
);

create table if not exists public.organization_role_mappings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  guild_id text not null references public.organization_guilds(guild_id) on delete cascade,
  discord_role_id text not null check(discord_role_id ~ '^\d{15,22}$'),
  discord_role_name text not null,
  panel_role text not null,
  permission_level smallint not null check(permission_level between 1 and 7),
  priority smallint not null default 0,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id,guild_id,discord_role_id),
  unique(organization_id,guild_id,permission_level)
);

create table if not exists public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  discord_id text not null,
  panel_role text not null,
  permission_level smallint not null check(permission_level between 0 and 7),
  active boolean not null default true,
  last_verified_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key(organization_id,discord_id)
);

create table if not exists public.panel_sessions (
  token_hash text primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  discord_id text not null,
  permission_level smallint not null check(permission_level between 0 and 7),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index if not exists panel_sessions_lookup_idx on public.panel_sessions(token_hash,expires_at) where revoked_at is null;

create table if not exists public.organization_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  discord_client_id text not null,
  panel_public_url text not null,
  family_role_id text,
  mechanics_role_id text,
  family_webhook_url text,
  mechanics_webhook_url text,
  pontaj_webhook_url text,
  requests_webhook_url text,
  contracts_webhook_url text,
  marketplace_webhook_url text,
  illegal_marketplace_webhook_url text,
  updated_by_discord_id text,
  updated_at timestamptz not null default now()
);

-- Loginul folosește aplicația Discord comună a platformei.
create or replace function public.get_discord_oauth_config()
returns table(discord_client_id text) language sql stable security definer set search_path=''
as $$ select s.discord_client_id from public.organization_settings s join public.organizations o on o.id=s.organization_id where o.active order by o.created_at limit 1 $$;
revoke all on function public.get_discord_oauth_config() from public;
grant execute on function public.get_discord_oauth_config() to anon,authenticated;

-- Migrează instalația actuală într-o organizație inițială.
do $$
declare org_id uuid; cfg public.discord_panel_config%rowtype;
begin
  select * into cfg from public.discord_panel_config where id=1;
  select id into org_id from public.organizations order by created_at limit 1;
  if org_id is null then
    insert into public.organizations(slug,name,code,description,logo_url,banner_url)
    values('organizatia-principala',coalesce(nullif(cfg.organization_name,''),'Organizația principală'),cfg.organization_code,cfg.organization_description,cfg.organization_logo,cfg.organization_banner)
    returning id into org_id;
  end if;
  if cfg.guild_id is not null and cfg.guild_id ~ '^\d{15,22}$' then
    insert into public.organization_guilds(organization_id,guild_id,kind) values(org_id,cfg.guild_id,'primary') on conflict(guild_id) do nothing;
  end if;
  if cfg.guild_id_secondary is not null and cfg.guild_id_secondary ~ '^\d{15,22}$' then
    insert into public.organization_guilds(organization_id,guild_id,kind) values(org_id,cfg.guild_id_secondary,'secondary') on conflict(guild_id) do nothing;
  end if;
  if cfg.discord_client_id is not null and cfg.panel_public_url is not null then
    insert into public.organization_settings(organization_id,discord_client_id,panel_public_url,family_role_id,mechanics_role_id,family_webhook_url,mechanics_webhook_url,pontaj_webhook_url,requests_webhook_url,contracts_webhook_url,marketplace_webhook_url,illegal_marketplace_webhook_url,updated_by_discord_id)
    values(org_id,cfg.discord_client_id,cfg.panel_public_url,cfg.family_role_id,cfg.mechanics_role_id,cfg.family_webhook_url,cfg.mechanics_webhook_url,cfg.pontaj_webhook_url,cfg.requests_webhook_url,cfg.contracts_webhook_url,cfg.marketplace_webhook_url,cfg.illegal_marketplace_webhook_url,cfg.updated_by_discord_id)
    on conflict(organization_id) do nothing;
  end if;
  insert into public.organization_role_mappings(organization_id,guild_id,discord_role_id,discord_role_name,panel_role,permission_level,priority,enabled)
  select org_id,cfg.guild_id,m.discord_role_id,m.discord_role_name,m.panel_role,m.permission_level,m.priority,m.enabled
  from public.discord_role_mappings m where cfg.guild_id is not null and m.discord_role_id ~ '^\d{15,22}$' on conflict do nothing;
  insert into public.organization_role_mappings(organization_id,guild_id,discord_role_id,discord_role_name,panel_role,permission_level,priority,enabled)
  select org_id,cfg.guild_id_secondary,m.discord_role_id_secondary,coalesce(m.discord_role_name_secondary,m.discord_role_name),m.panel_role,m.permission_level,m.priority,m.enabled
  from public.discord_role_mappings m where cfg.guild_id_secondary is not null and m.discord_role_id_secondary ~ '^\d{15,22}$' on conflict do nothing;
end $$;

-- Atașează fiecare tabel operațional organizației inițiale.
do $$ declare table_name text; org_id uuid; begin
  select id into org_id from public.organizations order by created_at limit 1;
  foreach table_name in array array['shifts','absences','app_settings','marketplace','marketplace_ilegal','profiles','illegal_locations','community_posts','community_poll_options','community_poll_votes','community_reactions','admin_audit_log','panel_notifications','panel_notification_reads'] loop
    execute format('alter table public.%I add column if not exists organization_id uuid references public.organizations(id)',table_name);
    execute format('update public.%I set organization_id=$1 where organization_id is null',table_name) using org_id;
    execute format('alter table public.%I alter column organization_id set not null',table_name);
    execute format('create index if not exists %I on public.%I(organization_id)',table_name||'_organization_idx',table_name);
  end loop;
end $$;
alter table public.profiles drop constraint if exists profiles_discord_id_key;
create unique index if not exists profiles_org_discord_uidx on public.profiles(organization_id,discord_id) where discord_id is not null;

-- Un utilizator poate avea câte o tură deschisă în fiecare organizație.
drop index if exists public.shifts_one_open_shift_per_user_idx;
create unique index if not exists shifts_one_open_shift_per_org_user_idx on public.shifts(organization_id,discord_id)
where status in('active','paused') and end_time is null;

-- Setările au cheie unică în interiorul organizației, nu global.
alter table public.app_settings drop constraint if exists app_settings_pkey;
alter table public.app_settings add primary key(organization_id,key);

-- Context securizat extras din tokenul opac trimis în header.
create or replace function public.panel_session_context()
returns table(organization_id uuid,discord_id text,permission_level smallint)
language sql stable security definer set search_path='' as $$
  select s.organization_id,s.discord_id,s.permission_level
  from public.panel_sessions s
  where s.token_hash=encode(extensions.digest(coalesce((nullif(current_setting('request.headers',true),'')::jsonb->>'x-panel-session'),''),'sha256'),'hex')
    and s.revoked_at is null and s.expires_at>now()
  limit 1
$$;
revoke all on function public.panel_session_context() from public;
grant execute on function public.panel_session_context() to anon,authenticated;

create or replace function public.current_panel_organization_id() returns uuid
language sql stable security definer set search_path='' as $$ select organization_id from public.panel_session_context() $$;
create or replace function public.current_panel_discord_id() returns text
language sql stable security definer set search_path='' as $$ select discord_id from public.panel_session_context() $$;
create or replace function public.current_panel_permission_level() returns smallint
language sql stable security definer set search_path='' as $$ select permission_level from public.panel_session_context() $$;
revoke all on function public.current_panel_organization_id(),public.current_panel_discord_id(),public.current_panel_permission_level() from public;
grant execute on function public.current_panel_organization_id(),public.current_panel_discord_id(),public.current_panel_permission_level() to anon,authenticated;

create or replace function public.get_user_directory()
returns table(discord_id text,display_name text) language sql stable security definer set search_path='' as $$
  select u.discord_id,coalesce(nullif(trim(u.display_name),''),nullif(trim(u.username),''),'Membru')
  from public.users u join public.organization_members m on m.discord_id=u.discord_id
  where m.organization_id=public.current_panel_organization_id() and m.active
$$;
revoke all on function public.get_user_directory() from public;
grant execute on function public.get_user_directory() to anon,authenticated;

-- Inserările din browser primesc automat organizația sesiunii validate.
do $$ declare table_name text; begin
  foreach table_name in array array['shifts','absences','app_settings','marketplace','marketplace_ilegal','profiles','illegal_locations','community_posts','community_poll_options','community_poll_votes','community_reactions','admin_audit_log','panel_notifications','panel_notification_reads'] loop
    execute format('alter table public.%I alter column organization_id set default public.current_panel_organization_id()',table_name);
  end loop;
end $$;

-- Elimină politicile anonime permisive și aplică izolarea pe sesiune.
do $$ declare table_name text; policy_name text; begin
  foreach table_name in array array['shifts','absences','app_settings','marketplace','marketplace_ilegal','profiles','illegal_locations','community_posts','community_poll_options','community_poll_votes','community_reactions','admin_audit_log','panel_notifications','panel_notification_reads'] loop
    for policy_name in select pol.polname from pg_catalog.pg_policy pol join pg_catalog.pg_class c on c.oid=pol.polrelid join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=table_name loop
      execute format('drop policy if exists %I on public.%I',policy_name,table_name);
    end loop;
    execute format('alter table public.%I enable row level security',table_name);
    execute format('create policy tenant_isolation on public.%I for all to anon,authenticated using(organization_id=public.current_panel_organization_id()) with check(organization_id=public.current_panel_organization_id())',table_name);
  end loop;
end $$;

alter table public.users enable row level security;
drop policy if exists anon_full_access on public.users;
drop policy if exists users_tenant_read on public.users;
create policy users_tenant_read on public.users for select to anon,authenticated using(
  exists(select 1 from public.organization_members m where m.organization_id=public.current_panel_organization_id() and m.discord_id=users.discord_id and m.active)
  and(users.discord_id=public.current_panel_discord_id() or public.current_panel_permission_level()>=4)
);

alter table public.organizations enable row level security;
alter table public.organization_guilds enable row level security;
alter table public.organization_role_mappings enable row level security;
alter table public.organization_members enable row level security;
alter table public.organization_settings enable row level security;
alter table public.panel_sessions enable row level security;
drop policy if exists organization_session_read on public.organizations;
drop policy if exists guild_session_read on public.organization_guilds;
drop policy if exists roles_session_read on public.organization_role_mappings;
drop policy if exists members_session_read on public.organization_members;
drop policy if exists settings_admin_read on public.organization_settings;
create policy organization_session_read on public.organizations for select to anon,authenticated using(id=public.current_panel_organization_id());
create policy guild_session_read on public.organization_guilds for select to anon,authenticated using(organization_id=public.current_panel_organization_id());
create policy roles_session_read on public.organization_role_mappings for select to anon,authenticated using(organization_id=public.current_panel_organization_id());
create policy members_session_read on public.organization_members for select to anon,authenticated using(organization_id=public.current_panel_organization_id());
create policy settings_admin_read on public.organization_settings for select to anon,authenticated using(organization_id=public.current_panel_organization_id() and public.current_panel_permission_level()=7);

revoke all on public.panel_sessions from anon,authenticated;
grant select,insert,update,delete on public.shifts,public.absences,public.app_settings,public.marketplace,public.marketplace_ilegal,public.illegal_locations to anon,authenticated;
grant select on public.profiles to anon,authenticated;
grant select on public.users,public.organizations,public.organization_guilds,public.organization_role_mappings,public.organization_members,public.organization_settings to anon,authenticated;
grant select,insert,update,delete on public.community_posts,public.community_poll_options,public.community_poll_votes,public.community_reactions to anon,authenticated;
grant select on public.admin_audit_log,public.panel_notifications,public.panel_notification_reads to anon,authenticated;

-- Reguli de scriere cu privilegii minime.
do $$ declare table_name text; begin
  foreach table_name in array array['shifts','absences','app_settings','marketplace','marketplace_ilegal','profiles','illegal_locations','community_posts','community_poll_options','community_poll_votes','community_reactions','admin_audit_log','panel_notifications','panel_notification_reads'] loop
    execute format('drop policy if exists tenant_isolation on public.%I',table_name);
  end loop;
end $$;

create policy shifts_read on public.shifts for select to anon,authenticated using(organization_id=public.current_panel_organization_id());
create policy shifts_insert_own on public.shifts for insert to anon,authenticated with check(organization_id=public.current_panel_organization_id() and discord_id=public.current_panel_discord_id());
create policy shifts_update on public.shifts for update to anon,authenticated using(organization_id=public.current_panel_organization_id() and(discord_id=public.current_panel_discord_id() or public.current_panel_permission_level()>=4)) with check(organization_id=public.current_panel_organization_id());
create policy shifts_delete_admin on public.shifts for delete to anon,authenticated using(organization_id=public.current_panel_organization_id() and public.current_panel_permission_level()>=4);

create policy absences_read on public.absences for select to anon,authenticated using(organization_id=public.current_panel_organization_id());
create policy absences_insert_own on public.absences for insert to anon,authenticated with check(organization_id=public.current_panel_organization_id() and discord_id=public.current_panel_discord_id());
create policy absences_update on public.absences for update to anon,authenticated using(organization_id=public.current_panel_organization_id() and(discord_id=public.current_panel_discord_id() or public.current_panel_permission_level()>=4)) with check(organization_id=public.current_panel_organization_id());
create policy absences_delete_admin on public.absences for delete to anon,authenticated using(organization_id=public.current_panel_organization_id() and public.current_panel_permission_level()>=4);

create policy app_settings_read on public.app_settings for select to anon,authenticated using(organization_id=public.current_panel_organization_id());
create policy app_settings_admin on public.app_settings for all to anon,authenticated using(organization_id=public.current_panel_organization_id() and public.current_panel_permission_level()=7) with check(organization_id=public.current_panel_organization_id() and public.current_panel_permission_level()=7);

create policy marketplace_read on public.marketplace for select to anon,authenticated using(organization_id=public.current_panel_organization_id());
create policy marketplace_insert on public.marketplace for insert to anon,authenticated with check(organization_id=public.current_panel_organization_id() and created_by_discord_id=public.current_panel_discord_id());
create policy marketplace_update on public.marketplace for update to anon,authenticated using(organization_id=public.current_panel_organization_id() and(created_by_discord_id=public.current_panel_discord_id() or public.current_panel_permission_level()=7)) with check(organization_id=public.current_panel_organization_id());
create policy marketplace_illegal_read on public.marketplace_ilegal for select to anon,authenticated using(organization_id=public.current_panel_organization_id() and public.current_panel_permission_level()>=3);
create policy marketplace_illegal_insert on public.marketplace_ilegal for insert to anon,authenticated with check(organization_id=public.current_panel_organization_id() and created_by_discord_id=public.current_panel_discord_id() and public.current_panel_permission_level()>=3);
create policy marketplace_illegal_update on public.marketplace_ilegal for update to anon,authenticated using(organization_id=public.current_panel_organization_id() and(created_by_discord_id=public.current_panel_discord_id() or public.current_panel_permission_level()=7)) with check(organization_id=public.current_panel_organization_id());
create policy profiles_read on public.profiles for select to anon,authenticated using(organization_id=public.current_panel_organization_id());

create policy locations_read on public.illegal_locations for select to anon,authenticated using(organization_id=public.current_panel_organization_id() and public.current_panel_permission_level()>=3);
create policy locations_admin on public.illegal_locations for all to anon,authenticated using(organization_id=public.current_panel_organization_id() and public.current_panel_permission_level()=7) with check(organization_id=public.current_panel_organization_id() and public.current_panel_permission_level()=7);

create policy community_posts_read on public.community_posts for select to anon,authenticated using(organization_id=public.current_panel_organization_id());
create policy community_options_read on public.community_poll_options for select to anon,authenticated using(organization_id=public.current_panel_organization_id());
create policy community_votes_read on public.community_poll_votes for select to anon,authenticated using(organization_id=public.current_panel_organization_id());
create policy community_reactions_read on public.community_reactions for select to anon,authenticated using(organization_id=public.current_panel_organization_id());
create policy audit_read_admin on public.admin_audit_log for select to anon,authenticated using(organization_id=public.current_panel_organization_id() and public.current_panel_permission_level()=7);
create policy notifications_read on public.panel_notifications for select to anon,authenticated using(organization_id=public.current_panel_organization_id() and(recipient_discord_id is null or recipient_discord_id=public.current_panel_discord_id()));
create policy notification_reads_read on public.panel_notification_reads for select to anon,authenticated using(organization_id=public.current_panel_organization_id() and discord_id=public.current_panel_discord_id());

-- Curăță automat sesiunile expirate.
do $$ declare job bigint; begin select jobid into job from cron.job where jobname='cleanup-panel-sessions' limit 1;if job is not null then perform cron.unschedule(job);end if;end $$;
select cron.schedule('cleanup-panel-sessions','23 4 * * *',$job$delete from public.panel_sessions where expires_at<now() or revoked_at<now()-interval '7 days'$job$);
