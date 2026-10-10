-- Flux privat pentru completarea contractului de către angajat.
-- Păstrăm contractele existente și adăugăm doar datele noi + cererea intermediară.
alter table public.organization_employees
  add column if not exists phone text,
  add column if not exists iban text;

alter table public.organization_contracts
  add column if not exists iban text;

create table if not exists public.organization_contract_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  guild_id text not null,
  target text not null default 'primary' check (target in ('primary', 'secondary')),
  manager_discord_id text not null,
  manager_name text not null,
  employee_discord_id text not null,
  status text not null default 'pending' check (status in ('pending', 'completed', 'cancelled', 'expired')),
  dm_channel_id text,
  dm_message_id text,
  contract_id uuid references public.organization_contracts(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists organization_contract_requests_employee_idx
  on public.organization_contract_requests (organization_id, employee_discord_id, status, created_at desc);

alter table public.organization_contract_requests enable row level security;
revoke all on table public.organization_contract_requests from anon, authenticated;
