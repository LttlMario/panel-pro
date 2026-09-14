create table if not exists public.platform_sponsorships (
  id uuid primary key default gen_random_uuid(),
  sponsor_name text not null check (char_length(sponsor_name) between 2 and 120),
  title text not null check (char_length(title) between 2 and 160),
  image_url text not null check (char_length(image_url) between 5 and 1000),
  target_url text not null check (target_url ~* '^https?://'),
  size text not null default 'medium' check (size in ('small','medium','large','wide','leaderboard')),
  placement text not null default 'footer' check (placement in ('top','dashboard','footer','sidebar')),
  pages text[] not null default array['*']::text[],
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  priority integer not null default 100 check (priority between 0 and 9999),
  active boolean not null default true,
  impressions bigint not null default 0,
  clicks bigint not null default 0,
  created_by_discord_id text,
  updated_by_discord_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_sponsorships_dates_check check (ends_at is null or ends_at > starts_at)
);

create index if not exists platform_sponsorships_active_idx
  on public.platform_sponsorships (active, starts_at, ends_at, priority);

alter table public.platform_sponsorships enable row level security;
revoke all on table public.platform_sponsorships from anon, authenticated;

comment on table public.platform_sponsorships is
  'Bannere sponsorizate administrate de administratorul global si afisate public.';

create or replace function public.increment_platform_sponsorship_metric(sponsorship_id uuid, metric text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if metric = 'click' then
    update public.platform_sponsorships set clicks = clicks + 1 where id = sponsorship_id;
  elsif metric = 'impression' then
    update public.platform_sponsorships set impressions = impressions + 1 where id = sponsorship_id;
  end if;
end;
$$;
revoke all on function public.increment_platform_sponsorship_metric(uuid, text) from public, anon, authenticated;
