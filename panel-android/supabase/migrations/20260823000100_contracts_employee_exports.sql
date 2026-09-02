-- Evidența angajaților, contractelor și exporturilor de identitate.
-- CNP-ul este păstrat doar pe organizație și nu este expus prin RLS public.

create table if not exists public.organization_employees (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  discord_id text,
  full_name text not null,
  cnp text not null,
  status text not null default 'active' check (status in ('active', 'inactive')),
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  last_discord_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, cnp)
);

create unique index if not exists organization_employees_discord_unique
  on public.organization_employees (organization_id, discord_id)
  where discord_id is not null;

create table if not exists public.organization_contracts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null references public.organization_employees(id) on delete restrict,
  contract_number text not null,
  contract_text text not null,
  phone text,
  position text,
  salary text,
  schedule text,
  start_date text,
  created_by_discord_id text,
  created_at timestamptz not null default now(),
  unique (organization_id, contract_number)
);

create index if not exists organization_contracts_created_at_idx
  on public.organization_contracts (organization_id, created_at desc);

create table if not exists public.contract_export_batches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  export_type text not null check (export_type in ('manual', 'weekly_discord')),
  status text not null default 'processing' check (status in ('processing', 'completed', 'failed')),
  period_start date,
  period_end date,
  created_by_discord_id text,
  row_count integer not null default 0,
  error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists contract_export_batches_lookup_idx
  on public.contract_export_batches (organization_id, export_type, created_at desc);

create table if not exists public.contract_export_items (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.contract_export_batches(id) on delete cascade,
  employee_id uuid not null references public.organization_employees(id) on delete restrict,
  full_name text not null,
  cnp text not null,
  created_at timestamptz not null default now(),
  unique (batch_id, employee_id)
);

create index if not exists contract_export_items_employee_idx
  on public.contract_export_items (employee_id, created_at desc);

alter table public.organization_employees enable row level security;
alter table public.organization_contracts enable row level security;
alter table public.contract_export_batches enable row level security;
alter table public.contract_export_items enable row level security;

revoke all on table public.organization_employees from anon, authenticated;
revoke all on table public.organization_contracts from anon, authenticated;
revoke all on table public.contract_export_batches from anon, authenticated;
revoke all on table public.contract_export_items from anon, authenticated;
