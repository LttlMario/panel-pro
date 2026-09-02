create table if not exists public.discord_panel_config (
  id smallint primary key default 1 check (id = 1),
  discord_client_id text not null,
  guild_id text not null,
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

alter table public.discord_panel_config enable row level security;
revoke all on table public.discord_panel_config from anon, authenticated;

-- Loginul poate afla doar Client ID-ul; restul configurației rămâne privat.
create or replace function public.get_discord_oauth_config()
returns table(discord_client_id text)
language sql
stable
security definer
set search_path = ''
as $$
  select config.discord_client_id
  from public.discord_panel_config config
  where config.id = 1;
$$;

revoke all on function public.get_discord_oauth_config() from public;
grant execute on function public.get_discord_oauth_config() to anon, authenticated;

-- Sistemul actual folosește nivelurile 1-7.
alter table public.discord_role_mappings drop constraint if exists discord_role_mappings_permission_level_check;
alter table public.discord_role_mappings
  add constraint discord_role_mappings_permission_level_check check (permission_level between 1 and 7);
