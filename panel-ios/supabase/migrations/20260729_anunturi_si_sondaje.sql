create extension if not exists pgcrypto;
create table if not exists public.community_posts(id uuid primary key default gen_random_uuid(),post_type text not null check(post_type in('announcement','question','poll')),audience text not null check(audience in('family','mechanics')),title text not null check(length(title) between 1 and 140),content text not null check(length(content) between 1 and 4000),author_discord_id text not null,author_name text not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
alter table public.community_posts drop constraint if exists community_posts_content_check;
alter table public.community_posts add constraint community_posts_content_check
check (length(content) between 0 and 4000);
alter table public.community_posts add column if not exists discord_message_id text;
create table if not exists public.community_poll_options(id uuid primary key default gen_random_uuid(),post_id uuid not null references public.community_posts(id) on delete cascade,option_text text not null,position smallint not null default 0);
create table if not exists public.community_poll_votes(id uuid primary key default gen_random_uuid(),post_id uuid not null references public.community_posts(id) on delete cascade,option_id uuid not null references public.community_poll_options(id) on delete cascade,user_discord_id text not null,created_at timestamptz not null default now(),unique(post_id,user_discord_id));
create table if not exists public.community_reactions(id uuid primary key default gen_random_uuid(),post_id uuid not null references public.community_posts(id) on delete cascade,user_discord_id text not null,reaction text not null check(reaction in('👍','❤️','✅','🤔')),created_at timestamptz not null default now(),unique(post_id,user_discord_id,reaction));
alter table public.community_posts enable row level security;alter table public.community_poll_options enable row level security;alter table public.community_poll_votes enable row level security;alter table public.community_reactions enable row level security;
drop policy if exists "community posts readable" on public.community_posts;create policy "community posts readable" on public.community_posts for select to anon using(true);
drop policy if exists "poll options readable" on public.community_poll_options;create policy "poll options readable" on public.community_poll_options for select to anon using(true);
drop policy if exists "poll votes readable" on public.community_poll_votes;create policy "poll votes readable" on public.community_poll_votes for select to anon using(true);
drop policy if exists "reactions readable" on public.community_reactions;create policy "reactions readable" on public.community_reactions for select to anon using(true);
alter table public.community_posts replica identity full;alter publication supabase_realtime add table public.community_posts;
alter table public.community_poll_votes replica identity full;alter table public.community_reactions replica identity full;alter table public.community_poll_options replica identity full;
do $$ begin
if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='community_poll_votes') then alter publication supabase_realtime add table public.community_poll_votes; end if;
if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='community_reactions') then alter publication supabase_realtime add table public.community_reactions; end if;
if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='community_poll_options') then alter publication supabase_realtime add table public.community_poll_options; end if;
end $$;
