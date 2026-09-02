-- Raportează numai starea infrastructurii. Este apelată cu service_role din Edge Function.
create or replace function public.get_panel_system_diagnostics()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  required_tables text[] := array['users','shifts','absences','app_settings','marketplace','marketplace_ilegal','illegal_locations','discord_panel_config','discord_role_mappings','community_posts','community_poll_options','community_poll_votes','community_reactions'];
  table_name text; missing_tables text[] := array[]::text[]; rls_disabled text[] := array[]::text[]; cleanup_active boolean := false;
begin
  foreach table_name in array required_tables loop
    if to_regclass('public.' || table_name) is null then missing_tables := array_append(missing_tables, table_name);
    elsif not coalesce((select c.relrowsecurity from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=table_name), false) then rls_disabled := array_append(rls_disabled, table_name);
    end if;
  end loop;
  if to_regclass('cron.job') is not null then execute 'select exists(select 1 from cron.job where jobname = $1 and active)' into cleanup_active using 'panel-cleanup-after-30-days'; end if;
  return jsonb_build_object('missing_tables',to_jsonb(missing_tables),'rls_disabled_tables',to_jsonb(rls_disabled),'cleanup_cron_active',cleanup_active);
end; $$;
revoke all on function public.get_panel_system_diagnostics() from public, anon, authenticated;
