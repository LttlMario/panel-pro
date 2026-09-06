-- Pagini custom create de administratorul global din asistentul Panel Pro.
-- Continutul este JSON validat de Edge Function; nu permitem HTML arbitrar.
create table if not exists public.platform_custom_pages (
  slug text primary key,
  title text not null,
  description text not null default '',
  icon text not null default '📄',
  sidebar_section text not null default 'administratie',
  sort_order integer not null default 100,
  content jsonb not null default '{"blocks":[]}'::jsonb,
  enabled boolean not null default true,
  created_by_discord_id text,
  updated_by_discord_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_custom_pages_slug_check check (slug ~ '^[a-z][a-z0-9-]{1,79}\.html$'),
  constraint platform_custom_pages_section_check check (sidebar_section in ('management','resurse','ilegal','administratie','feedback'))
);

create index if not exists platform_custom_pages_sidebar_idx
  on public.platform_custom_pages (sidebar_section, sort_order, title);

alter table public.platform_custom_pages enable row level security;
revoke all on table public.platform_custom_pages from anon, authenticated;

comment on table public.platform_custom_pages is
  'Pagini Panel Pro definite de administratorul global; randarea se face prin custom-page.html.';

create table if not exists public.platform_module_templates (
  module_key text primary key,
  label text not null,
  description text not null default '',
  definition jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  updated_by_discord_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.platform_module_templates enable row level security;
revoke all on table public.platform_module_templates from anon, authenticated;
