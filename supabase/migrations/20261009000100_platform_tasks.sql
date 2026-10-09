create table if not exists public.platform_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  guild_id text not null,
  title text not null,
  description text,
  due_at timestamptz not null,
  assignee_discord_id text not null,
  assignee_display_name text,
  created_by_discord_id text not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'refused', 'expired', 'cancelled')),
  response_note text,
  accepted_at timestamptz,
  refused_at timestamptz,
  dm_channel_id text,
  dm_message_id text,
  log_message_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists platform_tasks_org_status_idx on public.platform_tasks (organization_id, status, due_at);
create index if not exists platform_tasks_assignee_idx on public.platform_tasks (assignee_discord_id, status, due_at);

alter table public.platform_tasks enable row level security;

comment on table public.platform_tasks is 'Task-uri Discord atribuite angajatilor, cu raspuns privat si log persistent.';
