create table if not exists public.platform_task_drafts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  guild_id text not null,
  created_by_discord_id text not null,
  assignee_ids jsonb not null default '[]'::jsonb,
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  created_at timestamptz not null default now()
);

create index if not exists platform_task_drafts_expiry_idx
  on public.platform_task_drafts (organization_id, created_by_discord_id, expires_at);

alter table public.platform_task_drafts enable row level security;
