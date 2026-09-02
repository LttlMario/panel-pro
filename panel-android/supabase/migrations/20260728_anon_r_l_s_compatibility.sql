-- COMPATIBILITATE CHEIE ANON PENTRU APLICAȚIA ACTUALĂ
-- Rulează în Supabase > SQL Editor după ce ai publicat paginile cu cheia anon.
--
-- IMPORTANT: aplicația nu folosește încă Supabase Auth; rolurile vin din Discord/localStorage.
-- De aceea această variantă permite cheia anon să citească și să scrie datele pentru ca
-- aplicația existentă să rămână funcțională. Nu oferă protecție reală pe roluri în SQL.
-- Pentru protecție reală, acțiunile manager/admin trebuie mutate ulterior în Edge Functions.

grant usage on schema public to anon;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'users', 'shifts', 'absences', 'app_settings',
    'marketplace', 'marketplace_ilegal', 'profiles'
  ]
  loop
    if to_regclass('public.' || table_name) is not null then
      execute format('alter table public.%I enable row level security', table_name);
      execute format('grant select, insert, update, delete on table public.%I to anon', table_name);
      execute format('drop policy if exists "anon_full_access" on public.%I', table_name);
      execute format(
        'create policy "anon_full_access" on public.%I for all to anon using (true) with check (true)',
        table_name
      );
    end if;
  end loop;
end;
$$;
