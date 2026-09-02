-- Director minim pentru afișarea numelor în rapoarte, fără expunerea celorlalte coloane din users.
alter table public.shifts add column if not exists colleague_name text;

update public.shifts shift
set colleague_name = coalesce(nullif(trim(member.display_name), ''), nullif(trim(member.username), ''))
from public.users member
where trim(shift.discord_id) = trim(member.discord_id)
  and (shift.colleague_name is null or trim(shift.colleague_name) = '');

create or replace function public.get_user_directory()
returns table(discord_id text, display_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select
    u.discord_id,
    coalesce(nullif(trim(u.display_name), ''), nullif(trim(u.username), ''), 'Mecanic') as display_name
  from public.users u
  where u.discord_id is not null;
$$;

revoke all on function public.get_user_directory() from public;
grant execute on function public.get_user_directory() to anon, authenticated;
