-- Trimiteri din formularele paginilor custom.
-- Tabelul este accesibil doar prin Edge Function, nu direct din client.
create table if not exists public.platform_page_submissions (
  id uuid primary key default gen_random_uuid(),
  page_slug text not null references public.platform_custom_pages(slug) on delete cascade,
  block_index integer not null check (block_index >= 0 and block_index <= 39),
  values jsonb not null default '{}'::jsonb,
  submitter_discord_id text,
  submitter_organization_id uuid,
  status text not null default 'new' check (status in ('new', 'read', 'handled', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists platform_page_submissions_page_idx
  on public.platform_page_submissions (page_slug, created_at desc);

alter table public.platform_page_submissions enable row level security;
revoke all on table public.platform_page_submissions from anon, authenticated;

comment on table public.platform_page_submissions is
  'Cereri trimise prin formularele paginilor custom; acces doar prin manage-platform-pages.';
