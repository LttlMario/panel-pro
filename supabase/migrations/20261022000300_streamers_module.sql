create table if not exists public.discord_streamer_submissions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  guild_id text not null,
  target text not null default 'primary' check (target in ('primary', 'secondary')),
  submitter_discord_id text not null,
  submitter_name text not null,
  platform text not null,
  title text not null,
  stream_url text not null,
  game text,
  details text,
  created_at timestamptz not null default now()
);

create index if not exists discord_streamer_submissions_organization_idx
  on public.discord_streamer_submissions (organization_id, created_at desc);

alter table public.discord_streamer_submissions enable row level security;

revoke all on public.discord_streamer_submissions from anon, authenticated;
grant all on public.discord_streamer_submissions to service_role;
