alter table public.marketplace
add column if not exists created_by_discord_id text;

alter table public.marketplace_ilegal
add column if not exists created_by_discord_id text;

create index if not exists marketplace_created_by_idx
on public.marketplace(created_by_discord_id);

create index if not exists marketplace_ilegal_created_by_idx
on public.marketplace_ilegal(created_by_discord_id);
