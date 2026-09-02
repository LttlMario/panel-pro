-- Legătura dintre rolurile Discord și nivelurile de acces din panel.
-- Rolurile sunt sincronizate de funcția Edge la fiecare autentificare.

create table if not exists public.discord_role_mappings (
  discord_role_id text primary key,
  discord_role_name text not null,
  panel_role text not null,
  permission_level smallint not null check (permission_level between 1 and 5),
  priority smallint not null default 0,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.discord_role_mappings
  (discord_role_id, discord_role_name, panel_role, permission_level, priority)
values
  ('1526734209304105091', 'Lider',       'Lider',       5, 70),
  ('1526734654202319068', 'CoLider',     'CoLider',     5, 60),
  ('1526736781700104212', 'Coordonator', 'Coordonator', 5, 50),
  ('1528828654187184318', 'Manager',     'Manager',     4, 40),
  ('1526734716760227930', 'La Familia',  'Familia',     3, 30),
  ('1530174614951690250', 'Sef Mecanic', 'Sef Mecanic', 2, 20),
  ('1526734796125114488', 'El Mecanico', 'El Mecanico', 1, 10)
on conflict (discord_role_id) do update set
  discord_role_name = excluded.discord_role_name,
  panel_role = excluded.panel_role,
  permission_level = excluded.permission_level,
  priority = excluded.priority,
  updated_at = now();

alter table public.discord_role_mappings enable row level security;

drop policy if exists "role mappings readable by anon" on public.discord_role_mappings;
create policy "role mappings readable by anon"
  on public.discord_role_mappings for select to anon using (true);
