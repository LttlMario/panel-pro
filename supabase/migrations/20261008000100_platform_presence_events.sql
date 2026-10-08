create table if not exists public.platform_presence_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  guild_id text not null,
  module_key text not null,
  title text not null,
  event_type text not null default 'Activitate',
  details text,
  status text not null default 'active' check (status in ('active', 'closed')),
  created_by_discord_id text not null,
  embed_message_id text,
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists platform_presence_events_active_idx
  on public.platform_presence_events (organization_id, guild_id, module_key, status, created_at desc);

create table if not exists public.platform_presence_attendees (
  event_id uuid not null references public.platform_presence_events(id) on delete cascade,
  organization_id uuid not null,
  discord_id text not null,
  display_name text not null,
  joined_at timestamptz not null default now(),
  primary key (event_id, discord_id)
);

create index if not exists platform_presence_attendees_history_idx
  on public.platform_presence_attendees (organization_id, discord_id, joined_at desc);

alter table public.platform_presence_events enable row level security;
alter table public.platform_presence_attendees enable row level security;

comment on table public.platform_presence_events is 'Evenimente create din modulele Discord cu prezenta Panel Pro.';
comment on table public.platform_presence_attendees is 'Istoricul participantilor la evenimentele de prezenta Panel Pro.';
