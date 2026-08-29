-- Arhivează angajații eliminați din lista curentă fără să rupă istoricul contractelor și al exporturilor.
alter table public.organization_employees
  add column if not exists archived_at timestamptz;

create index if not exists organization_employees_archived_idx
  on public.organization_employees (organization_id, archived_at, status, full_name);
