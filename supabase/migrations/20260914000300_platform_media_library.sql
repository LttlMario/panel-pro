insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('panel-media', 'panel-media', true, 8388608, array['image/png']::text[])
on conflict (id) do update set public = true, file_size_limit = 8388608, allowed_mime_types = array['image/png']::text[];

create table if not exists public.platform_media_assets (
  id uuid primary key default gen_random_uuid(),
  file_path text not null unique,
  public_url text not null,
  original_name text not null default 'imagine.png',
  size_bytes integer not null default 0,
  created_by_discord_id text,
  created_at timestamptz not null default now()
);
alter table public.platform_media_assets enable row level security;
revoke all on table public.platform_media_assets from anon, authenticated;
