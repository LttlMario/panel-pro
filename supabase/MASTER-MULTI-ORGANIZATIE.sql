--
-- PostgreSQL database dump
--

\restrict 776HATD2Y9xN7owVd12lCs56WRrPvepKgijWovf0fzfd4WkhgQ0Ch2hDeq1IRq2

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA public;


ALTER SCHEMA public OWNER TO postgres;

--
-- Name: cleanup_panel_data_older_than_30_days(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.cleanup_panel_data_older_than_30_days() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare cutoff timestamptz:=now()-interval '30 days'; begin
 delete from public.community_posts where created_at<cutoff;
 delete from public.marketplace where created_at<cutoff;
 delete from public.marketplace_ilegal where created_at<cutoff;
 delete from public.absences where coalesce(end_at,start_at,created_at)<cutoff;
 delete from public.shifts where status in('completed','auto_completed') and coalesce(ended_at,created_at)<cutoff;
end $$;


ALTER FUNCTION public.cleanup_panel_data_older_than_30_days() OWNER TO postgres;

--
-- Name: close_expired_shifts_in_database(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.close_expired_shifts_in_database() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare affected integer;
begin
  update public.shifts s set status='auto_completed',ended_at=now(),end_time=(now() at time zone 'Europe/Bucharest')::time,
    duration_ms=greatest(0,floor(extract(epoch from(now()-s.started_at)))::bigint-coalesce(s.paused_seconds,0))*1000,
    duration=to_char(make_interval(secs=>greatest(0,floor(extract(epoch from(now()-s.started_at)))::integer-coalesce(s.paused_seconds,0))),'HH24:MI:SS'),
    stop_reason='Încheiere automată – ora configurată a fost atinsă',updated_at=now()
  where s.status in('active','paused') and s.end_time is null and s.auto_stop_at is not null and s.auto_stop_at<=now()-interval '2 minutes';
  get diagnostics affected=row_count;
  return affected;
end; $$;


ALTER FUNCTION public.close_expired_shifts_in_database() OWNER TO postgres;

--
-- Name: current_panel_discord_id(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.current_panel_discord_id() RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$ select discord_id from public.panel_session_context() $$;


ALTER FUNCTION public.current_panel_discord_id() OWNER TO postgres;

--
-- Name: current_panel_organization_id(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.current_panel_organization_id() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$ select organization_id from public.panel_session_context() $$;


ALTER FUNCTION public.current_panel_organization_id() OWNER TO postgres;

--
-- Name: current_panel_permission_level(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.current_panel_permission_level() RETURNS smallint
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$ select permission_level from public.panel_session_context() $$;


ALTER FUNCTION public.current_panel_permission_level() OWNER TO postgres;

--
-- Name: current_panel_is_platform_admin(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.current_panel_is_platform_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
      SELECT COALESCE(is_platform_admin, false)
      FROM public.panel_sessions
      WHERE token_hash = encode(
        extensions.digest(
          COALESCE((NULLIF(current_setting('request.headers', true), '')::jsonb->>'x-panel-session'), ''),
          'sha256'
        ),
        'hex'
      )
        AND revoked_at IS NULL
        AND expires_at > now()
      LIMIT 1
    $$;


ALTER FUNCTION public.current_panel_is_platform_admin() OWNER TO postgres;

--
-- Name: enforce_organization_package_limits(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.enforce_organization_package_limits() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
declare package_code text; guild_count integer; role_count integer;
begin
  select coalesce((value->>'code'),'full') into package_code from public.app_settings where organization_id=coalesce(new.organization_id,old.organization_id) and key='organization_package';
  if package_code='standard' then
    select count(*) into guild_count from public.organization_guilds where organization_id=coalesce(new.organization_id,old.organization_id) and enabled=true;
    if tg_table_name='organization_guilds' and tg_op<>'DELETE' then guild_count:=guild_count+1; end if;
    if guild_count>1 then raise exception 'Pachetul Standard permite un singur server Discord.'; end if;
    select count(*) into role_count from public.organization_role_mappings where organization_id=coalesce(new.organization_id,old.organization_id) and enabled=true;
    if tg_table_name='organization_role_mappings' and tg_op<>'DELETE' then role_count:=role_count+1; end if;
    if role_count>6 then raise exception 'Pachetul Standard permite maximum 6 roluri Discord.'; end if;
  end if;
  return coalesce(new,old);
end; $$;


ALTER FUNCTION public.enforce_organization_package_limits() OWNER TO postgres;

--
-- Name: fill_shift_colleague_name(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fill_shift_colleague_name() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  if new.colleague_name is null or btrim(new.colleague_name)='' then
    select coalesce(nullif(btrim(u.display_name),''),nullif(btrim(u.username),'')) into new.colleague_name
    from public.users u where btrim(u.discord_id)=btrim(new.discord_id) limit 1;
  end if;
  return new;
end; $$;


ALTER FUNCTION public.fill_shift_colleague_name() OWNER TO postgres;

--
-- Name: get_discord_oauth_config(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_discord_oauth_config() RETURNS TABLE(discord_client_id text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$ select s.discord_client_id from public.organization_settings s join public.organizations o on o.id=s.organization_id where o.active order by o.created_at limit 1 $$;


ALTER FUNCTION public.get_discord_oauth_config() OWNER TO postgres;

--
-- Name: get_panel_system_diagnostics(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_panel_system_diagnostics() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
declare
  required_tables text[] := array['users','shifts','absences','app_settings','marketplace','marketplace_ilegal','profiles','illegal_locations','discord_panel_config','discord_role_mappings','community_posts','community_poll_options','community_poll_votes','community_reactions','admin_audit_log','panel_notifications','panel_notification_reads'];
  table_name text; missing_tables text[] := array[]::text[]; rls_disabled text[] := array[]::text[]; cleanup_active boolean := false;
begin
  foreach table_name in array required_tables loop
    if to_regclass('public.' || table_name) is null then missing_tables := array_append(missing_tables, table_name);
    elsif not coalesce((select c.relrowsecurity from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=table_name), false) then rls_disabled := array_append(rls_disabled, table_name);
    end if;
  end loop;
  if to_regclass('cron.job') is not null then execute 'select exists(select 1 from cron.job where jobname = $1 and active)' into cleanup_active using 'panel-cleanup-after-30-days'; end if;
  return jsonb_build_object('missing_tables',to_jsonb(missing_tables),'rls_disabled_tables',to_jsonb(rls_disabled),'cleanup_cron_active',cleanup_active);
end; $_$;


ALTER FUNCTION public.get_panel_system_diagnostics() OWNER TO postgres;

--
-- Name: get_user_directory(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_user_directory() RETURNS TABLE(discord_id text, display_name text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select u.discord_id,coalesce(nullif(trim(u.display_name),''),nullif(trim(u.username),''),'Membru')
  from public.users u join public.organization_members m on m.discord_id=u.discord_id
  where m.organization_id=public.current_panel_organization_id() and m.active
$$;


ALTER FUNCTION public.get_user_directory() OWNER TO postgres;

--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  insert into public.profiles (id, username, organizatie, functie)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'organizatie', 'Unassigned'),
    coalesce(new.raw_user_meta_data ->> 'functie', 'Membru')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;


ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

--
-- Name: panel_session_context(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.panel_session_context() RETURNS TABLE(organization_id uuid, discord_id text, permission_level smallint)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select s.organization_id,s.discord_id,s.permission_level
  from public.panel_sessions s
  where s.token_hash=encode(extensions.digest(coalesce((nullif(current_setting('request.headers',true),'')::jsonb->>'x-panel-session'),''),'sha256'),'hex')
    and s.revoked_at is null and s.expires_at>now()
  limit 1
$$;


ALTER FUNCTION public.panel_session_context() OWNER TO postgres;

--
-- Name: pause_expired_organizations(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.pause_expired_organizations() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
declare changed_count integer;
begin
  update public.organizations o
  set lifecycle_status='grace', grace_until=now()+interval '72 hours', active=false, updated_at=now()
  where o.active=true
    and exists (select 1 from public.app_settings s where s.organization_id=o.id and s.key='organization_access' and (s.value->>'expires_at') is not null and ((s.value->>'expires_at')::timestamptz)<=now())
    and coalesce(o.lifecycle_status,'active')='active';
  get diagnostics changed_count = row_count;
  insert into public.organization_lifecycle_events(organization_id,event_type,details)
  select o.id,'organization_expired',jsonb_build_object('grace_until',o.grace_until)
  from public.organizations o
  where o.lifecycle_status='grace' and o.grace_until > now() and not exists (select 1 from public.organization_lifecycle_events e where e.organization_id=o.id and e.event_type='organization_expired' and e.created_at>now()-interval '1 day');
  return changed_count;
end;
$$;


ALTER FUNCTION public.pause_expired_organizations() OWNER TO postgres;

--
-- Name: queue_organization_expiration_notifications(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.queue_organization_expiration_notifications() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
declare added integer;
begin
  insert into public.organization_expiration_notifications(organization_id,threshold,scheduled_for)
  select o.id, x.threshold, x.when_at
  from public.organizations o
  join public.app_settings s on s.organization_id=o.id and s.key='organization_access'
  cross join lateral (values
    ('7d'::text,(s.value->>'expires_at')::timestamptz-interval '7 days'),
    ('3d'::text,(s.value->>'expires_at')::timestamptz-interval '3 days'),
    ('24h'::text,(s.value->>'expires_at')::timestamptz-interval '24 hours'),
    ('expired'::text,(s.value->>'expires_at')::timestamptz)
  ) x(threshold,when_at)
  where (s.value->>'expires_at') is not null and x.when_at<=now() and o.lifecycle_status in ('active','grace')
  on conflict (organization_id,threshold) do nothing;
  get diagnostics added=row_count; return added;
end; $$;


ALTER FUNCTION public.queue_organization_expiration_notifications() OWNER TO postgres;

--
-- Name: rls_auto_enable(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.rls_auto_enable() RETURNS event_trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION public.rls_auto_enable() OWNER TO postgres;

--
-- Name: rpc_actualizeaza_inventar(uuid, integer, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.rpc_actualizeaza_inventar(p_item_id uuid, p_cantitate_noua integer, p_user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
declare
    v_nume_item text;
    v_org text;
begin
    select nume_item, organizatie into v_nume_item, v_org
    from public.inventar_bucatarie
    where id = p_item_id;

    update public.inventar_bucatarie
    set cantitate = p_cantitate_noua,
        updated_at = timezone('utc'::text, now()),
        updated_by = p_user_id
    where id = p_item_id;

    insert into public.audit_logs (user_id, actiune, detalii)
    values (
        p_user_id, 
        'UPDATE_INVENTAR', 
        format('Item-ul "%s" din organizația "%s" a fost actualizat la cantitatea %s.', v_nume_item, v_org, p_cantitate_noua)
    );
end;
$$;


ALTER FUNCTION public.rpc_actualizeaza_inventar(p_item_id uuid, p_cantitate_noua integer, p_user_id uuid) OWNER TO postgres;

--
-- Name: rpc_gestioneaza_cerere(uuid, text, uuid, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.rpc_gestioneaza_cerere(p_cerere_id uuid, p_status_nou text, p_admin_id uuid, p_comentariu text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
begin
    update public.cereri
    set status = p_status_nou,
        raspuns_de = p_admin_id,
        comentariu_admin = p_comentariu,
        updated_at = timezone('utc'::text, now())
    where id = p_cerere_id;

    insert into public.audit_logs (user_id, actiune, detalii)
    values (
        p_admin_id,
        'GESTIUNE_CERERE',
        format('Cererea ID %s a fost marcată ca: %s', p_cerere_id, p_status_nou)
    );
end;
$$;


ALTER FUNCTION public.rpc_gestioneaza_cerere(p_cerere_id uuid, p_status_nou text, p_admin_id uuid, p_comentariu text) OWNER TO postgres;

--
-- Name: rpc_obtine_statistici_panou(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.rpc_obtine_statistici_panou() RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
declare
    v_total_useri int;
    v_cereri_in_asteptare int;
    v_contracte_active int;
    v_rezultat json;
begin
    select count(*) into v_total_useri from public.profiles;
    select count(*) into v_cereri_in_asteptare from public.cereri where status = 'In asteptare';
    select count(*) into v_contracte_active from public.contracte where status = 'Activ';

    v_rezultat := json_build_object(
        'total_useri', v_total_useri,
        'cereri_in_asteptare', v_cereri_in_asteptare,
        'contracte_active', v_contracte_active,
        'timestamp', now()
    );

    return v_rezultat;
end;
$$;


ALTER FUNCTION public.rpc_obtine_statistici_panou() OWNER TO postgres;

--
-- Name: rpc_salveaza_calcul(uuid, text, jsonb, jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.rpc_salveaza_calcul(p_user_id uuid, p_tip_calculator text, p_date_intrare jsonb, p_rezultat jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
declare
    v_new_id uuid;
begin
    insert into public.istoric_calculatoare (user_id, tip_calculator, date_intrare, rezultat)
    values (p_user_id, p_tip_calculator, p_date_intrare, p_rezultat)
    returning id into v_new_id;

    return v_new_id;
end;
$$;


ALTER FUNCTION public.rpc_salveaza_calcul(p_user_id uuid, p_tip_calculator text, p_date_intrare jsonb, p_rezultat jsonb) OWNER TO postgres;

--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION public.set_updated_at() OWNER TO postgres;

--
-- Name: sync_user_name_to_shifts(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.sync_user_name_to_shifts() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare resolved_name text;
begin
  resolved_name:=coalesce(nullif(btrim(new.display_name),''),nullif(btrim(new.username),''));
  if resolved_name is not null then
    update public.shifts set colleague_name=resolved_name
    where btrim(discord_id)=btrim(new.discord_id) and colleague_name is distinct from resolved_name;
  end if;
  return new;
end; $$;


ALTER FUNCTION public.sync_user_name_to_shifts() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: absences; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.absences (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    discord_id text NOT NULL,
    colleague_name text,
    notice_type text DEFAULT 'Învoire'::text NOT NULL,
    reason text,
    start_date date,
    days integer DEFAULT 1 NOT NULL,
    notes text,
    start_at timestamp with time zone,
    end_at timestamp with time zone,
    proof_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    organization_id uuid DEFAULT public.current_panel_organization_id() NOT NULL,
    CONSTRAINT absences_days_check CHECK ((days > 0)),
    CONSTRAINT absences_period_check CHECK (((end_at IS NULL) OR (start_at IS NULL) OR (end_at > start_at)))
);


ALTER TABLE public.absences OWNER TO postgres;

--
-- Name: admin_audit_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.admin_audit_log (
    id bigint NOT NULL,
    actor_discord_id text NOT NULL,
    actor_name text,
    action text NOT NULL,
    target_type text,
    target_id text,
    details jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    organization_id uuid DEFAULT public.current_panel_organization_id()
);


ALTER TABLE public.admin_audit_log OWNER TO postgres;

--
-- Name: admin_audit_log_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.admin_audit_log ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.admin_audit_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: app_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.app_settings (
    key text NOT NULL,
    value jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    organization_id uuid DEFAULT public.current_panel_organization_id() NOT NULL
);


ALTER TABLE public.app_settings OWNER TO postgres;

--
-- Name: community_poll_options; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.community_poll_options (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    post_id uuid NOT NULL,
    option_text text NOT NULL,
    "position" smallint DEFAULT 0 NOT NULL,
    organization_id uuid DEFAULT public.current_panel_organization_id() NOT NULL
);


ALTER TABLE public.community_poll_options OWNER TO postgres;

--
-- Name: community_poll_votes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.community_poll_votes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    post_id uuid NOT NULL,
    option_id uuid NOT NULL,
    user_discord_id text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    organization_id uuid DEFAULT public.current_panel_organization_id() NOT NULL
);


ALTER TABLE public.community_poll_votes OWNER TO postgres;

--
-- Name: community_posts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.community_posts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    post_type text NOT NULL,
    title text NOT NULL,
    content text DEFAULT ''::text NOT NULL,
    author_discord_id text NOT NULL,
    author_name text NOT NULL,
    discord_message_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    organization_id uuid DEFAULT public.current_panel_organization_id() NOT NULL,
    CONSTRAINT community_posts_content_check CHECK (((length(content) >= 0) AND (length(content) <= 4000))),
    CONSTRAINT community_posts_post_type_check CHECK ((post_type = ANY (ARRAY['announcement'::text, 'question'::text, 'poll'::text]))),
    CONSTRAINT community_posts_title_check CHECK (((length(title) >= 1) AND (length(title) <= 140)))
);


ALTER TABLE public.community_posts OWNER TO postgres;

--
-- Name: community_reactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.community_reactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    post_id uuid NOT NULL,
    user_discord_id text NOT NULL,
    reaction text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    organization_id uuid DEFAULT public.current_panel_organization_id() NOT NULL,
    CONSTRAINT community_reactions_reaction_check CHECK ((reaction = ANY (ARRAY['👍'::text, '❤️'::text, '✅'::text, '🤔'::text])))
);


ALTER TABLE public.community_reactions OWNER TO postgres;

--
-- Name: discord_panel_config; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.discord_panel_config (
    id smallint DEFAULT 1 NOT NULL,
    discord_client_id text NOT NULL,
    guild_id text NOT NULL,
    discord_client_id_secondary text,
    guild_id_secondary text,
    panel_public_url text NOT NULL,
    organization_name text,
    organization_code text,
    organization_description text,
    organization_logo text,
    organization_banner text,
    family_role_id text,
    mechanics_role_id text,
    family_webhook_url text,
    mechanics_webhook_url text,
    pontaj_webhook_url text,
    requests_webhook_url text,
    contracts_webhook_url text,
    marketplace_webhook_url text,
    illegal_marketplace_webhook_url text,
    updated_by_discord_id text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT discord_panel_config_id_check CHECK ((id = 1))
);


ALTER TABLE public.discord_panel_config OWNER TO postgres;

--
-- Name: discord_role_mappings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.discord_role_mappings (
    discord_role_id text NOT NULL,
    discord_role_name text NOT NULL,
    discord_role_id_secondary text,
    discord_role_name_secondary text,
    panel_role text NOT NULL,
    permission_level smallint NOT NULL,
    priority smallint DEFAULT 0 NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT discord_role_mappings_permission_level_check CHECK (((permission_level >= 1) AND (permission_level <= 7)))
);


ALTER TABLE public.discord_role_mappings OWNER TO postgres;

--
-- Name: illegal_locations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.illegal_locations (
    id text NOT NULL,
    map_key text NOT NULL,
    category text NOT NULL,
    title text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    images jsonb DEFAULT '[]'::jsonb NOT NULL,
    x numeric(6,2) NOT NULL,
    y numeric(6,2) NOT NULL,
    notes text DEFAULT ''::text NOT NULL,
    requirements text DEFAULT ''::text NOT NULL,
    rewards text DEFAULT ''::text NOT NULL,
    last_updated date DEFAULT CURRENT_DATE NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    organization_id uuid DEFAULT public.current_panel_organization_id(),
    CONSTRAINT illegal_locations_map_key_check CHECK ((map_key = ANY (ARRAY['ls'::text, 'cayo'::text, 'maldive'::text]))),
    CONSTRAINT illegal_locations_x_check CHECK (((x >= (0)::numeric) AND (x <= (100)::numeric))),
    CONSTRAINT illegal_locations_y_check CHECK (((y >= (0)::numeric) AND (y <= (100)::numeric)))
);


ALTER TABLE public.illegal_locations OWNER TO postgres;

--
-- Name: marketplace; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.marketplace (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nume text NOT NULL,
    display_name text,
    telefon text,
    tip_actiune text NOT NULL,
    categorie text,
    produse text,
    pret text,
    imagini_json text,
    imagine_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by_discord_id text,
    organization_id uuid DEFAULT public.current_panel_organization_id() NOT NULL
);


ALTER TABLE public.marketplace OWNER TO postgres;

--
-- Name: marketplace_ilegal; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.marketplace_ilegal (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nume text NOT NULL,
    telefon text,
    tip_actiune text NOT NULL,
    categorie text,
    subcategorie text,
    produse text,
    pret text,
    imagini_json text,
    imagine_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by_discord_id text,
    organization_id uuid DEFAULT public.current_panel_organization_id() NOT NULL
);


ALTER TABLE public.marketplace_ilegal OWNER TO postgres;

--
-- Name: organization_expiration_notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.organization_expiration_notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    threshold text NOT NULL,
    scheduled_for timestamp with time zone NOT NULL,
    sent_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT organization_expiration_notifications_threshold_check CHECK ((threshold = ANY (ARRAY['7d'::text, '3d'::text, '24h'::text, 'expired'::text])))
);


ALTER TABLE public.organization_expiration_notifications OWNER TO postgres;

--
-- Name: organization_guilds; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.organization_guilds (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    guild_id text NOT NULL,
    guild_name text,
    kind text DEFAULT 'primary'::text NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT organization_guilds_guild_id_check CHECK ((guild_id ~ '^\d{15,22}$'::text)),
    CONSTRAINT organization_guilds_kind_check CHECK ((kind = ANY (ARRAY['primary'::text, 'secondary'::text])))
);


ALTER TABLE public.organization_guilds OWNER TO postgres;

--
-- Name: organization_lifecycle_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.organization_lifecycle_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    event_type text NOT NULL,
    actor_discord_id text,
    details jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.organization_lifecycle_events OWNER TO postgres;

--
-- Name: organization_members; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.organization_members (
    organization_id uuid NOT NULL,
    discord_id text NOT NULL,
    panel_role text NOT NULL,
    permission_level smallint NOT NULL,
    active boolean DEFAULT true NOT NULL,
    last_verified_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT organization_members_permission_level_check CHECK (((permission_level >= 0) AND (permission_level <= 99)))
);


ALTER TABLE public.organization_members OWNER TO postgres;

--
-- Name: organization_role_mappings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.organization_role_mappings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    guild_id text NOT NULL,
    discord_role_id text NOT NULL,
    discord_role_name text NOT NULL,
    panel_role text NOT NULL,
    permission_level smallint NOT NULL,
    priority smallint DEFAULT 0 NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT organization_role_mappings_discord_role_id_check CHECK ((discord_role_id ~ '^\d{15,22}$'::text)),
    CONSTRAINT organization_role_mappings_permission_level_check CHECK (((permission_level >= 1) AND (permission_level <= 99)))
);


ALTER TABLE public.organization_role_mappings OWNER TO postgres;

--
-- Name: organization_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.organization_settings (
    organization_id uuid NOT NULL,
    discord_client_id text NOT NULL,
    panel_public_url text NOT NULL,
    family_role_id text,
    mechanics_role_id text,
    family_webhook_url text,
    mechanics_webhook_url text,
    pontaj_webhook_url text,
    requests_webhook_url text,
    contracts_webhook_url text,
    marketplace_webhook_url text,
    illegal_marketplace_webhook_url text,
    updated_by_discord_id text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    webhook_routes jsonb DEFAULT '{}'::jsonb NOT NULL,
    marketplace_secondary_webhook_url text,
    pontaj_secondary_webhook_url text,
    requests_secondary_webhook_url text,
    contracts_secondary_webhook_url text,
    illegal_marketplace_secondary_webhook_url text
);


ALTER TABLE public.organization_settings OWNER TO postgres;

--
-- Name: COLUMN organization_settings.webhook_routes; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.organization_settings.webhook_routes IS 'Sursa unică pentru toate webhook-urile Discord, pe canal și rută primary/secondary.';


--
-- Name: organization_vouchers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.organization_vouchers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    package_code text NOT NULL,
    duration_days integer,
    organization_id uuid,
    created_by_discord_id text,
    redeemed_by_discord_id text,
    redeemed_at timestamp with time zone,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    redeemed_organization_id uuid,
    max_attempts integer DEFAULT 5 NOT NULL,
    attempt_count integer DEFAULT 0 NOT NULL,
    guild_id text,
    CONSTRAINT organization_vouchers_package_code_check CHECK ((package_code = ANY (ARRAY['standard'::text, 'full'::text])))
);


ALTER TABLE public.organization_vouchers OWNER TO postgres;

--
-- Name: TABLE organization_vouchers; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.organization_vouchers IS 'Coduri unice pentru activarea pachetelor Standard si Full.';


--
-- Name: organizations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.organizations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    name text NOT NULL,
    code text,
    address text,
    description text,
    logo_url text,
    banner_url text,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    lifecycle_status text DEFAULT 'active'::text NOT NULL,
    grace_until timestamp with time zone,
    live_status_message_id text,
    live_status_last_update timestamp with time zone,
    CONSTRAINT organizations_lifecycle_status_check CHECK ((lifecycle_status = ANY (ARRAY['draft'::text, 'active'::text, 'grace'::text, 'paused'::text]))),
    CONSTRAINT organizations_name_check CHECK (((length(btrim(name)) >= 2) AND (length(btrim(name)) <= 100))),
    CONSTRAINT organizations_slug_check CHECK ((slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'::text))
);


ALTER TABLE public.organizations OWNER TO postgres;

--
-- Name: panel_notification_reads; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.panel_notification_reads (
    notification_id bigint NOT NULL,
    discord_id text NOT NULL,
    read_at timestamp with time zone DEFAULT now() NOT NULL,
    organization_id uuid DEFAULT public.current_panel_organization_id() NOT NULL
);


ALTER TABLE public.panel_notification_reads OWNER TO postgres;

--
-- Name: panel_notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.panel_notifications (
    id bigint NOT NULL,
    recipient_discord_id text,
    title text NOT NULL,
    message text NOT NULL,
    level text DEFAULT 'info'::text NOT NULL,
    link text,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    organization_id uuid DEFAULT public.current_panel_organization_id() NOT NULL,
    CONSTRAINT panel_notifications_level_check CHECK ((level = ANY (ARRAY['info'::text, 'success'::text, 'warning'::text, 'error'::text]))),
    CONSTRAINT panel_notifications_message_check CHECK (((length(message) >= 1) AND (length(message) <= 1000))),
    CONSTRAINT panel_notifications_title_check CHECK (((length(title) >= 1) AND (length(title) <= 120)))
);


ALTER TABLE public.panel_notifications OWNER TO postgres;

--
-- Name: panel_notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.panel_notifications ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.panel_notifications_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: panel_sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.panel_sessions (
    token_hash text NOT NULL,
    organization_id uuid NOT NULL,
    discord_id text NOT NULL,
    permission_level smallint NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    is_platform_admin boolean DEFAULT false NOT NULL,
    CONSTRAINT panel_sessions_permission_level_check CHECK (((permission_level >= 0) AND (permission_level <= 99)))
);


ALTER TABLE public.panel_sessions OWNER TO postgres;

--
-- Name: profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    discord_id text,
    username text,
    display_name text,
    avatar_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    organization_id uuid DEFAULT public.current_panel_organization_id() NOT NULL
);


ALTER TABLE public.profiles OWNER TO postgres;

--
-- Name: shifts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.shifts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    discord_id text NOT NULL,
    colleague_name text,
    date date DEFAULT CURRENT_DATE NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone,
    duration text DEFAULT '00:00:00'::text NOT NULL,
    duration_ms bigint DEFAULT 0 NOT NULL,
    shift_type text DEFAULT 'zi'::text NOT NULL,
    status text DEFAULT 'completed'::text NOT NULL,
    started_at timestamp with time zone,
    ended_at timestamp with time zone,
    auto_stop_at timestamp with time zone,
    paused_at timestamp with time zone,
    paused_seconds integer DEFAULT 0 NOT NULL,
    stop_reason text,
    discord_close_notified_at timestamp with time zone,
    discord_close_notification_error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    organization_id uuid DEFAULT public.current_panel_organization_id() NOT NULL,
    CONSTRAINT shifts_duration_ms_check CHECK ((duration_ms >= 0)),
    CONSTRAINT shifts_paused_seconds_check CHECK ((paused_seconds >= 0)),
    CONSTRAINT shifts_status_check CHECK ((status = ANY (ARRAY['active'::text, 'paused'::text, 'completed'::text, 'auto_completed'::text]))),
    CONSTRAINT shifts_type_check CHECK ((shift_type = ANY (ARRAY['zi'::text, 'noapte'::text])))
);


ALTER TABLE public.shifts OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    discord_id text NOT NULL,
    username text,
    display_name text,
    email text,
    avatar text,
    avatar_url text,
    role text DEFAULT 'Mecanic'::text NOT NULL,
    default_role text DEFAULT 'Mecanic'::text NOT NULL,
    service text DEFAULT 'Atelier'::text NOT NULL,
    maintenance_mode boolean DEFAULT false NOT NULL,
    discord_logs_active boolean DEFAULT true NOT NULL,
    threshold_value numeric DEFAULT 0 NOT NULL,
    max_shift_hours numeric DEFAULT 8 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Data for Name: absences; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.absences (id, discord_id, colleague_name, notice_type, reason, start_date, days, notes, start_at, end_at, proof_url, created_at, updated_at, organization_id) FROM stdin;
\.


--
-- Data for Name: admin_audit_log; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.admin_audit_log (id, actor_discord_id, actor_name, action, target_type, target_id, details, created_at, organization_id) FROM stdin;
1	247012210021236738	\N	organization_saved	organization	3aa50e04-ba96-4bc4-959b-b7a14aff46f7	{"name": "Familia Es Todo", "roles": 7}	2026-08-03 18:05:52.883542+00	3aa50e04-ba96-4bc4-959b-b7a14aff46f7
2	247012210021236738	\N	organization_saved	organization	3aa50e04-ba96-4bc4-959b-b7a14aff46f7	{"name": "Familia Es Todo", "roles": 7}	2026-08-04 11:18:26.336217+00	3aa50e04-ba96-4bc4-959b-b7a14aff46f7
\.


--
-- Data for Name: app_settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.app_settings (key, value, updated_at, organization_id) FROM stdin;
organization_package	{"code": "full", "unlimited": true, "expires_at": null}	2026-08-04 11:18:23.92+00	3aa50e04-ba96-4bc4-959b-b7a14aff46f7
pontaj_config	{"maxHours": 12, "dayEndTime": "19:59", "nightEndTime": "23:00", "excludeBreaks": false}	2026-08-03 08:49:53.76054+00	3aa50e04-ba96-4bc4-959b-b7a14aff46f7
organization_access	{"expires_at": "2036-03-30T17:19:00.000Z"}	2026-08-04 11:18:25.7+00	3aa50e04-ba96-4bc4-959b-b7a14aff46f7
contract_template	{"title": "CONTRACT INDIVIDUAL DE MUNCĂ", "template": "Încheiat între:\\n\\nAngajator: {{COMPANY}}, cu sediul la {{ADDRESS}}, reprezentată legal de {{MANAGER}}, denumită în continuare Angajator,\\n\\nși\\n\\nSalariat:\\n{{EMPLOYEE_NAME}}\\n\\ndomiciliat(ă) în Los Santos,\\nCNP: {{CNP}},\\nTelefon: {{PHONE}},\\ndenumit(ă) în continuare Angajat.\\n\\nArt. 1 – Obiectul contractului\\n\\nAngajatul este încadrat în funcția de {{POSITION}} în cadrul activității de service auto și/sau spălătorie auto, conform fișei postului anexate la prezentul contract.\\n\\nArt. 2 – Durata contractului\\n\\nContractul se încheie pe perioadă: Perioada Nedeterminata\\n\\nData începerii activității este {{START_DATE}}.\\n\\nArt. 3 – Locul muncii\\n\\nActivitatea se va desfășura la punctul de lucru al {{COMPANY}}, situat la {{ADDRESS}}, precum și în alte locații ale societății, dacă este necesar.\\n\\nArt. 4 – Programul de lucru\\n\\nProgramul normal de lucru este de 3 ore/zi, între ora {{PROGRAM}}, conform programului stabilit de angajator si Primaria Orasului Los Santos.\\n\\nArt. 5 – Salarizarea\\n\\nSalariul de bază net: {{SALARY}}.\\nPlata salariului se efectuează săptămânal in fiecare Duminica.\\nAngajatul poate beneficia de bonusuri sau prime de performanță, conform politicii societății.\\nOrele suplimentare se efectuează numai cu aprobarea angajatorului și nu sunt remunerate prin salariul de bază. Compensarea acestora se realizează exclusiv din sumele încasate cu titlu de bacșiș („ciubuc”) sau din veniturile obținute în urma lucrărilor efectuate în intervalul respectiv, conform înțelegerii dintre părți.\\n\\nArt. 6 – Obligațiile angajatului\\n\\nAngajatul se obligă:\\n\\nsă respecte programul de lucru;\\nsă execute atribuțiile prevăzute în fișa postului;\\nsă utilizeze corespunzător echipamentele și uneltele societății;\\nsă respecte normele de securitate și sănătate în muncă;\\nsă păstreze confidențialitatea informațiilor privind activitatea societății și a clienților;\\nsă manifeste un comportament profesionist față de clienți și colegi;\\nsă informeze imediat angajatorul despre orice incident sau defecțiune constatată.\\n\\nArt. 7 – Obligațiile angajatorului\\n\\nAngajatorul se obligă:\\n\\nsă asigure condiții corespunzătoare de muncă;\\nsă achite salariul la termen;\\nsă pună la dispoziția angajatului echipamentele necesare;\\nsă respecte drepturile prevăzute de legislația muncii;\\nsă asigure instruirea privind securitatea și sănătatea în muncă.\\n\\nArt. 8 – Demisia și încetarea contractului\\n\\nAngajatul poate demisiona prin notificare scrisă, cu respectarea termenului de preaviz prevăzut de lege sau de prezentul contract.\\n\\nAngajatorul poate dispune încetarea contractului numai în condițiile și pentru motivele prevăzute de legislația muncii, cu respectarea procedurilor legale.\\n\\nLa încetarea raporturilor de muncă, angajatul va preda toate bunurile, echipamentele, documentele și materialele aparținând societății.\\n\\nArt. 9 – Fișa postului\\n\\nAtribuții principale\\n\\nexecutarea lucrărilor specifice postului ocupat;\\nmenținerea curățeniei la locul de muncă;\\nutilizarea corectă a echipamentelor și sculelor;\\nrespectarea procedurilor interne;\\ncomunicarea cu superiorul direct privind desfășurarea activității;\\nrespectarea normelor de protecția muncii și PSI.\\n\\nArt. 10 – Dispoziții finale\\n\\nPrezentul contract produce efecte începând cu data de {{START_DATE}}.\\n\\nOrice modificare se face numai prin act adițional, semnat de ambele părți.\\n\\nContractul este întocmit în două exemplare originale, câte unul pentru fiecare parte.\\n\\nANGAJATOR\\n\\nCompania: {{COMPANY}}\\n\\nReprezentant: {{MANAGER}}\\n\\nSemnătură: {{MANAGER}}\\n\\nANGAJAT\\n\\nNume: {{EMPLOYEE_NAME}}\\n\\nSemnătură:"}	2026-08-04 11:18:25.869+00	3aa50e04-ba96-4bc4-959b-b7a14aff46f7
page_permissions	{"index.html": ["1532801991162593291", "1532802419950354582", "1532802167805841548", "1526734716760227930", "1532802780677275680", "1526734209304105091", "1526734654202319068", "1526736781700104212"], "cereri.html": ["1532801991162593291", "1526734654202319068", "1526734209304105091", "1532802419950354582", "1532802167805841548", "1526734716760227930", "1532802780677275680", "1526736781700104212"], "pontaj.html": ["1532801991162593291", "1532802167805841548", "1532802419950354582", "1526734716760227930", "1532802780677275680", "1526734654202319068", "1526734209304105091", "1526736781700104212"], "anunturi.html": ["1532801991162593291", "1532802167805841548", "1526734716760227930", "1532802780677275680", "1532802419950354582", "1526734209304105091", "1526734654202319068", "1526736781700104212"], "asistent.html": ["1532802780677275680", "1532802419950354582", "1532802167805841548", "1526734209304105091", "1526734716760227930", "1532801991162593291", "1526734654202319068", "1526736781700104212"], "rapoarte.html": ["1532802780677275680", "1532802419950354582", "1526734209304105091", "1526734654202319068", "1526736781700104212"], "bucatarie.html": ["1532801991162593291", "1526736781700104212", "1532802167805841548", "1526734654202319068", "1526734716760227930", "1526734209304105091", "1532802780677275680"], "contracte.html": ["1526734654202319068", "1526734209304105091", "1532802419950354582", "1526736781700104212", "1532802780677275680"], "marketplace.html": ["1532801991162593291", "1526734654202319068", "1532802167805841548", "1526734209304105091", "1526734716760227930", "1532802419950354582", "1532802780677275680", "1526736781700104212"], "craftmecanics.html": ["1532801991162593291", "1526734654202319068", "1532802167805841548", "1526734209304105091", "1526734716760227930", "1532802419950354582", "1532802780677275680", "1526736781700104212"], "locatiiilegale.html": ["1532802419950354582", "1526734209304105091", "1526734654202319068", "1526736781700104212", "1526734716760227930"], "calculatorilegal.html": ["1532802419950354582", "1526734209304105091", "1526734654202319068", "1526734716760227930", "1526736781700104212"], "marketplace-ilegal.html": ["1532802419950354582", "1526734716760227930", "1526734209304105091", "1526734654202319068", "1526736781700104212"]}	2026-08-04 11:18:25.953+00	3aa50e04-ba96-4bc4-959b-b7a14aff46f7
\.


--
-- Data for Name: community_poll_options; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.community_poll_options (id, post_id, option_text, "position", organization_id) FROM stdin;
\.


--
-- Data for Name: community_poll_votes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.community_poll_votes (id, post_id, option_id, user_discord_id, created_at, organization_id) FROM stdin;
\.


--
-- Data for Name: community_posts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.community_posts (id, post_type, title, content, author_discord_id, author_name, discord_message_id, created_at, updated_at, organization_id) FROM stdin;
521c3248-ba45-49e8-b92f-718fb278e5d9	announcement	Toti sunt rugati sa isi adauge datele de contact!	Va rog, cei care nu ati completat datele de contact, sa o faceti.\n\nAveti timp pana maine!	247012210021236738	Little Mario I 3000	\N	2026-08-04 11:19:44.931028+00	2026-08-04 11:19:44.931028+00	3aa50e04-ba96-4bc4-959b-b7a14aff46f7
\.


--
-- Data for Name: community_reactions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.community_reactions (id, post_id, user_discord_id, reaction, created_at, organization_id) FROM stdin;
\.


--
-- Data for Name: discord_panel_config; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.discord_panel_config (id, discord_client_id, guild_id, discord_client_id_secondary, guild_id_secondary, panel_public_url, organization_name, organization_code, organization_description, organization_logo, organization_banner, family_role_id, mechanics_role_id, family_webhook_url, mechanics_webhook_url, pontaj_webhook_url, requests_webhook_url, contracts_webhook_url, marketplace_webhook_url, illegal_marketplace_webhook_url, updated_by_discord_id, updated_at) FROM stdin;
\.


--
-- Data for Name: discord_role_mappings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.discord_role_mappings (discord_role_id, discord_role_name, discord_role_id_secondary, discord_role_name_secondary, panel_role, permission_level, priority, enabled, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: illegal_locations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.illegal_locations (id, map_key, category, title, description, images, x, y, notes, requirements, rewards, last_updated, created_at, updated_at, organization_id) FROM stdin;
pescuit-braconier	ls	deliveries	Pescuit Braconier	Zonă maritimă dedicată activităților ilegale de pescuit și recoltare.	["image_6d6b63.jpg"]	55.40	3.50	Necesar echipament de scufundare / barcă.	Niciuna	Pește și bunuri rare	2026-07-25	2026-08-03 10:08:13.868513+00	2026-08-03 10:08:13.868513+00	3aa50e04-ba96-4bc4-959b-b7a14aff46f7
camera-tortura	ls	weapons	Camera de Tortură	Locație ascunsă pentru activități speciale ale facțiunii.	["image_6e3e73.jpg"]	45.31	82.31	Acces restrictiv membrii autorizați.	Rang intern în facțiune	Control și informații	2026-08-03	2026-08-03 10:09:45.761909+00	2026-08-03 10:09:45.761909+00	3aa50e04-ba96-4bc4-959b-b7a14aff46f7
spital-sandy	ls	hospitals	Spital Sandy Shores	Unitate medicală din zona Sandy Shores.	["image_6e4c80.jpg"]	58.80	38.50	Disponibil pentru tratament rapid.	Niciuna	Refacere completă sănătate	2026-07-25	2026-08-03 10:09:45.761909+00	2026-08-03 10:09:45.761909+00	3aa50e04-ba96-4bc4-959b-b7a14aff46f7
cayo-spital-alt-1	cayo	hospitals	Spital Cayo (Alternativ 1 & 2)	Perspectivă apropiată și hartă orientare.	["image_6e489f.jpg", "image_6e491e.jpg"]	81.20	51.30	Intrare secundară.	Niciuna	Asistență medicală	2026-07-25	2026-08-03 10:09:45.761909+00	2026-08-03 10:09:45.761909+00	3aa50e04-ba96-4bc4-959b-b7a14aff46f7
vanzare-seminte	ls	suppliers	Vânzare Semințe Coca & Canabis	Punct de achiziție semințe pentru culturi.	["image_6e5081.jpg"]	56.23	13.27	Stoc limitat.	Fonduri cash	Semințe calitate superioară	2026-08-03	2026-08-03 10:09:45.761909+00	2026-08-03 10:09:45.761909+00	3aa50e04-ba96-4bc4-959b-b7a14aff46f7
cumparare-acetona	ls	suppliers	Cumpărare Acetonă (Humane Labs)	Locația de achiziție a acetonei, situată în perimetrul Humane Labs & Research.	["image_6d6bdd.jpg"]	72.54	34.49	Necesar pentru procesarea cocainei.	Bani cash / Licență	Acetonă x1	2026-08-03	2026-08-03 10:08:13.868513+00	2026-08-03 10:08:13.868513+00	3aa50e04-ba96-4bc4-959b-b7a14aff46f7
rulota-desert	ls	deliveries	Rulotă Livrat (Grand Senora Desert)	Punct de livrare în zona deșertului aproape de Harmony.	["image_6d6ee2.jpg"]	49.17	42.45	Acces facil cu vehicule de teren.	Contract activ de livrare	Fonduri și XP	2026-08-03	2026-08-03 10:09:45.761909+00	2026-08-03 10:09:45.761909+00	3aa50e04-ba96-4bc4-959b-b7a14aff46f7
rulota-mirror	ls	deliveries	Rulotă Livrat (Mirror Park)	Locație de livrare amplasată în zona Mirror Park.	["image_6d6f06.jpg"]	55.40	70.52	Evitați atragerea atenției.	Contract activ de livrare	Fonduri și XP	2026-08-03	2026-08-03 10:09:45.761909+00	2026-08-03 10:09:45.761909+00	3aa50e04-ba96-4bc4-959b-b7a14aff46f7
rulota-vespucci	ls	deliveries	Rulotă Livrat (Vespucci / Magellan Ave)	Punct alternativ de livrare în zona Vespucci.	["image_6d6f9f.jpg"]	34.90	77.05	Zonă urbană intens circulată.	Contract activ de livrare	Fonduri și XP	2026-08-03	2026-08-03 10:09:45.761909+00	2026-08-03 10:09:45.761909+00	3aa50e04-ba96-4bc4-959b-b7a14aff46f7
rulota-murrieta	ls	deliveries	Rulotă Livrat (Murrieta Oil Field)	Punct strategic pentru livrări și activități în zona de est / Murrieta Oil Field.	["image_6d67a5.jpg"]	55.97	82.14	Atenție la patrulele din zonă.	Contract activ de livrare	Fonduri și XP	2026-08-03	2026-08-03 10:08:13.868513+00	2026-08-03 10:08:13.868513+00	3aa50e04-ba96-4bc4-959b-b7a14aff46f7
spital-mirror	ls	hospitals	Spital Mirror	Punct medical zona estică.	["image_6e4cfa.jpg"]	53.83	75.00	Asistență medicală de urgență.	Niciuna	Refacere completă sănătate	2026-08-03	2026-08-03 10:09:45.761909+00	2026-08-03 10:09:45.761909+00	3aa50e04-ba96-4bc4-959b-b7a14aff46f7
craftare-arme	cayo	weapons	Craftare Arme	Atelier specializat pentru fabricarea echipamentului armat.	["image_6dc1bb.jpg"]	59.92	57.54	Necesită componente de armă.	Licență de armurier	Arme și accesorii	2026-08-03	2026-08-03 10:08:13.868513+00	2026-08-03 10:08:13.868513+00	3aa50e04-ba96-4bc4-959b-b7a14aff46f7
cayo-spital-1	cayo	hospitals	Spital Cayo	Punct medical pe insulă.	["image_6d687a.jpg", "image_6dc214.jpg"]	57.13	55.95	Niciodată singuri pe Cayo.	Niciuna	Tratament complet	2026-08-03	2026-08-03 10:09:45.761909+00	2026-08-03 10:09:45.761909+00	3aa50e04-ba96-4bc4-959b-b7a14aff46f7
procesare-marijuana	cayo	drugs	Procesare Canabin	Centrul de procesare marijuana / canabis.	["image_6dc259.jpg"]	67.26	52.36	Necesită materie primă.	Frunze Cannabis	Pachete Marijuana	2026-08-03	2026-08-03 10:08:13.868513+00	2026-08-03 10:08:13.868513+00	3aa50e04-ba96-4bc4-959b-b7a14aff46f7
procesare-cocaina	cayo	drugs	Procesare Cocaină	Locație dedicată procesării cocainei.	["image_6dc5bb.jpg"]	61.85	48.92	Combinație chimică strictă.	Frunze Cocă + Acetonă	Cocaină pură	2026-08-03	2026-08-03 10:08:13.868513+00	2026-08-03 10:08:13.868513+00	3aa50e04-ba96-4bc4-959b-b7a14aff46f7
\.


--
-- Data for Name: marketplace; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.marketplace (id, nume, display_name, telefon, tip_actiune, categorie, produse, pret, imagini_json, imagine_url, created_at, updated_at, created_by_discord_id, organization_id) FROM stdin;
\.


--
-- Data for Name: marketplace_ilegal; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.marketplace_ilegal (id, nume, telefon, tip_actiune, categorie, subcategorie, produse, pret, imagini_json, imagine_url, created_at, updated_at, created_by_discord_id, organization_id) FROM stdin;
\.


--
-- Data for Name: organization_expiration_notifications; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.organization_expiration_notifications (id, organization_id, threshold, scheduled_for, sent_at, created_at) FROM stdin;
\.


--
-- Data for Name: organization_guilds; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.organization_guilds (id, organization_id, guild_id, guild_name, kind, enabled, created_at) FROM stdin;
289c228f-8155-4673-9d23-e97acc01445f	3aa50e04-ba96-4bc4-959b-b7a14aff46f7	1526731246691029103	👑⚜ 𝓡𝓸𝔂𝓪𝓵 ⚜👑	primary	t	2026-08-04 11:18:25.20319+00
cbd24177-88ea-4347-b8ff-36de30acde85	3aa50e04-ba96-4bc4-959b-b7a14aff46f7	1532801930311766309	LFA Service	secondary	t	2026-08-04 11:18:25.29138+00
\.


--
-- Data for Name: organization_lifecycle_events; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.organization_lifecycle_events (id, organization_id, event_type, actor_discord_id, details, created_at) FROM stdin;
\.


--
-- Data for Name: organization_members; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.organization_members (organization_id, discord_id, panel_role, permission_level, active, last_verified_at, created_at) FROM stdin;
3aa50e04-ba96-4bc4-959b-b7a14aff46f7	1491366570788651138	Mecanic	1	t	2026-08-04 18:25:48.896+00	2026-08-04 12:01:48.493404+00
3aa50e04-ba96-4bc4-959b-b7a14aff46f7	1192790397768978492	Mecanic	1	t	2026-08-04 20:08:23.929+00	2026-08-03 16:07:27.006014+00
3aa50e04-ba96-4bc4-959b-b7a14aff46f7	1395712209392369785	Caporegime	5	t	2026-08-04 13:20:18.404+00	2026-08-04 13:20:18.464744+00
3aa50e04-ba96-4bc4-959b-b7a14aff46f7	940551066628521994	Mecanic	1	t	2026-08-04 16:18:42.67+00	2026-08-03 20:35:41.891362+00
3aa50e04-ba96-4bc4-959b-b7a14aff46f7	1405542421340618815	Manager	4	t	2026-08-04 20:35:53.33+00	2026-08-03 15:40:01.881699+00
3aa50e04-ba96-4bc4-959b-b7a14aff46f7	1411405223326515220	Mecanic	1	t	2026-08-03 17:39:13.341+00	2026-08-03 16:04:41.889948+00
3aa50e04-ba96-4bc4-959b-b7a14aff46f7	1084074954607308926	Mecanic	1	t	2026-08-04 21:04:30.882+00	2026-08-04 20:47:45.797316+00
3aa50e04-ba96-4bc4-959b-b7a14aff46f7	247012210021236738	Caporegime	99	t	2026-08-05 07:16:55.914+00	2026-08-03 08:51:45.647646+00
3aa50e04-ba96-4bc4-959b-b7a14aff46f7	1341125408321441895	Mecanic	1	t	2026-08-04 17:14:03.945+00	2026-08-04 17:14:04.001338+00
3aa50e04-ba96-4bc4-959b-b7a14aff46f7	959178717026984057	Mecanic	1	t	2026-08-04 17:20:53.286+00	2026-08-04 16:23:08.974036+00
\.


--
-- Data for Name: organization_role_mappings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.organization_role_mappings (id, organization_id, guild_id, discord_role_id, discord_role_name, panel_role, permission_level, priority, enabled, created_at, updated_at) FROM stdin;
3023219b-8708-4599-982b-fea2d5bbc8e5	3aa50e04-ba96-4bc4-959b-b7a14aff46f7	1532801930311766309	1532801991162593291	Mecanic	Mecanic	1	10	t	2026-08-04 11:18:26.233566+00	2026-08-04 11:18:26.233566+00
f05bbf0e-266a-40f5-a53d-f1d23d439822	3aa50e04-ba96-4bc4-959b-b7a14aff46f7	1532801930311766309	1532802167805841548	Sef Mecanic	Sef Mecanic	2	20	t	2026-08-04 11:18:26.233566+00	2026-08-04 11:18:26.233566+00
c25f0efb-9587-4040-acde-e98a03043fb0	3aa50e04-ba96-4bc4-959b-b7a14aff46f7	1526731246691029103	1526734716760227930	Soldato	Soldato	3	30	t	2026-08-04 11:18:26.233566+00	2026-08-04 11:18:26.233566+00
91280ffe-30b9-48bb-98a3-d481adc0a953	3aa50e04-ba96-4bc4-959b-b7a14aff46f7	1532801930311766309	1532802780677275680	Manager	Manager	4	40	t	2026-08-04 11:18:26.233566+00	2026-08-04 11:18:26.233566+00
7386f0d9-006f-4d9e-8c16-03a0f132cb98	3aa50e04-ba96-4bc4-959b-b7a14aff46f7	1526731246691029103	1526736781700104212	Caporegime	Caporegime	5	50	t	2026-08-04 11:18:26.233566+00	2026-08-04 11:18:26.233566+00
c7bd94f4-99c7-4a88-b28f-b2f52226a269	3aa50e04-ba96-4bc4-959b-b7a14aff46f7	1526731246691029103	1526734654202319068	Underboss	Underboss	6	60	t	2026-08-04 11:18:26.233566+00	2026-08-04 11:18:26.233566+00
b719f148-7ca3-414c-8d1c-5d6a42d94a53	3aa50e04-ba96-4bc4-959b-b7a14aff46f7	1526731246691029103	1526734209304105091	Don	Don	7	70	t	2026-08-04 11:18:26.233566+00	2026-08-04 11:18:26.233566+00
\.


--
-- Data for Name: organization_settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.organization_settings (organization_id, discord_client_id, panel_public_url, family_role_id, mechanics_role_id, family_webhook_url, mechanics_webhook_url, pontaj_webhook_url, requests_webhook_url, contracts_webhook_url, marketplace_webhook_url, illegal_marketplace_webhook_url, updated_by_discord_id, updated_at, webhook_routes, marketplace_secondary_webhook_url, pontaj_secondary_webhook_url, requests_secondary_webhook_url, contracts_secondary_webhook_url, illegal_marketplace_secondary_webhook_url) FROM stdin;
3aa50e04-ba96-4bc4-959b-b7a14aff46f7	1531023771211792384	https://panel-management.netlify.app/	\N	\N	\N	\N	\N	\N	\N	\N	\N	247012210021236738	2026-08-04 11:18:25.5+00	{"family": {"primary": null}, "pontaj": {"primary": null, "secondary": {"url": "https://discord.com/api/webhooks/1532828256938491965/zH6yno21vWqo8V_GHyacVbzI-i33rrv6Ey_ePV-E53MjmfHZ0bfmML-FvJ0rYHj6C9rD"}}, "requests": {"primary": {"url": "https://discord.com/api/webhooks/1530881772240502898/HOf5YsmCARiAAiKhS_qcbc8opbLU0viHooZfhXcAQVfHeth0L8BDkmN3X7rNBgb6mO2C"}, "secondary": {"url": "https://discord.com/api/webhooks/1532828450317144214/fYzx9drHCBDDNZ1XNUtUr_ug3BruHlgE-2gDAsMoNIWKALgyPRoaNzrDg2TbRRTWagsi"}}, "contracts": {"primary": null, "secondary": {"url": "https://discord.com/api/webhooks/1532828670077567118/H10GUwLFl9Bqt9beMf8JekmiL2dyMB-DKJ-j59fv5dNcelJDfOTYtCDwR6PTsEc2771J"}}, "mechanics": {"primary": null}, "marketplace": {"primary": {"url": "https://discord.com/api/webhooks/1531217999120568390/1zBGstFYhYI6SQC7xBl_IJn_taVHuZbrV0bZqceiWLg2RPMfnrMgATlwqbeu4IImFdCE"}, "secondary": {"url": "https://discord.com/api/webhooks/1532828910759444672/g4oFl6uGZ2P6xifYX_80Z_P2ViYkv6RO9VT8xglO2Ym4UCnPylAGT-Nu6p-uZiIzWckH"}}, "illegal_marketplace": {"primary": {"url": "https://discord.com/api/webhooks/1530160265486667849/MVfKr4C_3zj9HzNEm3gTyxUEyoEsd95QKnY5DFxTtTpbi48jDoIcEzlTIzIul15mKRX8"}, "secondary": null}}	\N	\N	\N	\N	\N
\.


--
-- Data for Name: organization_vouchers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.organization_vouchers (id, code, package_code, duration_days, organization_id, created_by_discord_id, redeemed_by_discord_id, redeemed_at, expires_at, created_at, redeemed_organization_id, max_attempts, attempt_count, guild_id) FROM stdin;
04f142e9-9388-45a6-909d-be28d153eaa9	FULL-452A405C374B	full	365	\N	247012210021236738	\N	\N	\N	2026-08-04 09:20:45.964175+00	\N	5	0	1397492387252797461
\.


--
-- Data for Name: organizations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.organizations (id, slug, name, code, address, description, logo_url, banner_url, active, created_at, updated_at, lifecycle_status, grace_until) FROM stdin;
3aa50e04-ba96-4bc4-959b-b7a14aff46f7	familia-es-todo	Familia Es Todo	familia-es-todo	Innocense Bvd. Service nr. 2	\N	https://cdn.corenexis.com/f/g7H0KT38cfn.png	\N	t	2026-08-03 08:49:53.176799+00	2026-08-04 11:18:25.786+00	active	\N
\.


--
-- Data for Name: panel_notification_reads; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.panel_notification_reads (notification_id, discord_id, read_at, organization_id) FROM stdin;
\.


--
-- Data for Name: panel_notifications; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.panel_notifications (id, recipient_discord_id, title, message, level, link, expires_at, created_at, organization_id) FROM stdin;
\.


--
-- Data for Name: panel_sessions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.panel_sessions (token_hash, organization_id, discord_id, permission_level, expires_at, revoked_at, created_at, last_seen_at, is_platform_admin) FROM stdin;
fc4c1ae33ffc15b2763bc51a59a757282e5996f26dd82d4b8795da2c7b22cba7	3aa50e04-ba96-4bc4-959b-b7a14aff46f7	247012210021236738	99	2026-08-05 17:39:07.629+00	\N	2026-08-05 05:39:07.741892+00	2026-08-05 05:39:07.741892+00	t
b840a1835916c646aa74797642ca5a3e9f0732bb158a7c268603ffec7397c398	3aa50e04-ba96-4bc4-959b-b7a14aff46f7	959178717026984057	1	2026-08-05 04:42:46.195+00	\N	2026-08-04 16:42:46.256434+00	2026-08-04 16:42:46.256434+00	f
387c0156e75cfc49a95b02f824012e01bcff3291739904ac62e5a9575a3efa9a	3aa50e04-ba96-4bc4-959b-b7a14aff46f7	1192790397768978492	1	2026-08-05 04:44:58.48+00	\N	2026-08-04 16:44:58.547474+00	2026-08-04 16:44:58.547474+00	f
f8e176edc1facef3f7eb866433ce89079ca44dd1060c90ebe98a06614377be8c	3aa50e04-ba96-4bc4-959b-b7a14aff46f7	959178717026984057	1	2026-08-05 05:03:38.903+00	\N	2026-08-04 17:03:39.035154+00	2026-08-04 17:03:39.035154+00	f
a877c954973d1ee184c50e01f2b60f6e89caf02528e7eb1966576bb961df3bf6	3aa50e04-ba96-4bc4-959b-b7a14aff46f7	959178717026984057	1	2026-08-05 05:03:52.543+00	\N	2026-08-04 17:03:52.662508+00	2026-08-04 17:03:52.662508+00	f
35ccfd79e11895f997522994efbf06bc1ce64aee0bcaf35fd59909c792b8c656	3aa50e04-ba96-4bc4-959b-b7a14aff46f7	1405542421340618815	4	2026-08-05 08:15:17.206+00	\N	2026-08-04 20:15:17.323755+00	2026-08-04 20:15:17.323755+00	f
5595d018446b1ee3c7b451600a28a4a4bb69a86569c58e6079fd42df71ce06bb	3aa50e04-ba96-4bc4-959b-b7a14aff46f7	1405542421340618815	4	2026-08-05 08:15:22.493+00	\N	2026-08-04 20:15:22.605467+00	2026-08-04 20:15:22.605467+00	f
09c7e124f9c47ad32be1beb99d9b169dc9371aa045c2505ec8f2562eea33c0bc	3aa50e04-ba96-4bc4-959b-b7a14aff46f7	1084074954607308926	1	2026-08-05 08:47:57.511+00	\N	2026-08-04 20:47:57.568182+00	2026-08-04 20:47:57.568182+00	f
3a0b3fdf473cac97e5e4baf9a7744a727232e9bfd8fa8e2e74031f7fe67abf3c	3aa50e04-ba96-4bc4-959b-b7a14aff46f7	1084074954607308926	1	2026-08-05 09:04:31.022+00	\N	2026-08-04 21:04:31.135843+00	2026-08-04 21:04:31.135843+00	f
aae0e8147afc29448a87deaf006f7f5864894e9b92c06a358bd1cfe21ad44d1a	3aa50e04-ba96-4bc4-959b-b7a14aff46f7	247012210021236738	99	2026-08-05 19:16:43.933+00	\N	2026-08-05 07:16:44.044632+00	2026-08-05 07:16:44.044632+00	t
3041edc9fea967ae2382c6df2f3f01897c2bdb292abd1287a766dc34736e68e9	3aa50e04-ba96-4bc4-959b-b7a14aff46f7	247012210021236738	99	2026-08-05 19:16:45.96+00	\N	2026-08-05 07:16:46.075642+00	2026-08-05 07:16:46.075642+00	t
23ff24f97a91642717db5cd1f3e227ef2d72a1f3fe524600848173d8a60dce10	3aa50e04-ba96-4bc4-959b-b7a14aff46f7	959178717026984057	1	2026-08-05 04:44:11.349+00	\N	2026-08-04 16:44:11.424137+00	2026-08-04 16:44:11.424137+00	f
d836726899345a7b42b547910cb501197e102cd5d494adb7e2ac1bc8ae9af202	3aa50e04-ba96-4bc4-959b-b7a14aff46f7	1192790397768978492	1	2026-08-05 04:45:01.242+00	\N	2026-08-04 16:45:01.309424+00	2026-08-04 16:45:01.309424+00	f
f43c920ce9037eb55a578bede3e56439809a21fed9f837e7c056a4422a60b367	3aa50e04-ba96-4bc4-959b-b7a14aff46f7	959178717026984057	1	2026-08-05 04:45:24.887+00	\N	2026-08-04 16:45:25.00143+00	2026-08-04 16:45:25.00143+00	f
b31f273b4d4831892904d1817ba1b4f0f2bd45df688dd530246f2ec79d0173e2	3aa50e04-ba96-4bc4-959b-b7a14aff46f7	959178717026984057	1	2026-08-05 05:03:34.215+00	\N	2026-08-04 17:03:34.34305+00	2026-08-04 17:03:34.34305+00	f
f4b79a2b16ad4a955183287863449e784c1b3b4a1325424c421752f03779c90c	3aa50e04-ba96-4bc4-959b-b7a14aff46f7	1405542421340618815	4	2026-08-05 08:34:36.033+00	\N	2026-08-04 20:34:36.108429+00	2026-08-04 20:34:36.108429+00	f
3053bd6004ef7674855f604ead8d62f91d955231ab387068dd50994f16347724	3aa50e04-ba96-4bc4-959b-b7a14aff46f7	1405542421340618815	4	2026-08-05 08:35:11.564+00	\N	2026-08-04 20:35:11.672016+00	2026-08-04 20:35:11.672016+00	f
72814123b2f214421ee9f62bbbbae19afb8d206ace76dbe7c41a16155605b862	3aa50e04-ba96-4bc4-959b-b7a14aff46f7	1084074954607308926	1	2026-08-05 08:48:24.866+00	\N	2026-08-04 20:48:24.976131+00	2026-08-04 20:48:24.976131+00	f
cab85b0d8f245f71099b0f1fb363614a535d4f4187b97ae0e5c2c397797bb191	3aa50e04-ba96-4bc4-959b-b7a14aff46f7	247012210021236738	99	2026-08-05 19:16:51.472+00	\N	2026-08-05 07:16:51.581461+00	2026-08-05 07:16:51.581461+00	t
6487af8073b0ef27f29a3b4f1d97b992f928a12614aa7dabfaca4afdb6fa7478	3aa50e04-ba96-4bc4-959b-b7a14aff46f7	247012210021236738	99	2026-08-05 19:16:56.038+00	\N	2026-08-05 07:16:56.096537+00	2026-08-05 07:16:56.096537+00	t
9f5e4fca349f2cbeed8d33487e653e7a51cb95c9a571a701872cc37794cbb3eb	3aa50e04-ba96-4bc4-959b-b7a14aff46f7	959178717026984057	1	2026-08-05 04:23:09.003+00	\N	2026-08-04 16:23:09.12209+00	2026-08-04 16:23:09.12209+00	f
be55abeb66e16a2e3e100b4cd434f1c89f629456fa24d23fe5be76e49510d773	3aa50e04-ba96-4bc4-959b-b7a14aff46f7	959178717026984057	1	2026-08-05 04:23:15.067+00	\N	2026-08-04 16:23:15.179464+00	2026-08-04 16:23:15.179464+00	f
0b30ca07335a72f308224ad8739dd8691c753460a1fbc8f31258adb28b2b5d08	3aa50e04-ba96-4bc4-959b-b7a14aff46f7	959178717026984057	1	2026-08-05 04:44:17.404+00	\N	2026-08-04 16:44:17.468576+00	2026-08-04 16:44:17.468576+00	f
7a08b83f539712397350ac96617767041bb270c763f61519845c4562546164e0	3aa50e04-ba96-4bc4-959b-b7a14aff46f7	1192790397768978492	1	2026-08-05 04:50:49.88+00	\N	2026-08-04 16:50:49.943125+00	2026-08-04 16:50:49.943125+00	f
fea5a6b945071a9df1817e5861f7c64709bc115cf6b4dea58d5ba188ac14b6ba	3aa50e04-ba96-4bc4-959b-b7a14aff46f7	1491366570788651138	1	2026-08-05 05:55:33.237+00	\N	2026-08-04 17:55:33.300436+00	2026-08-04 17:55:33.300436+00	f
1101fe044c4bc82a51713bf75664eada09b5b9b73d6cd435c7a94038b30d1d72	3aa50e04-ba96-4bc4-959b-b7a14aff46f7	1491366570788651138	1	2026-08-05 05:55:46.225+00	\N	2026-08-04 17:55:46.2846+00	2026-08-04 17:55:46.2846+00	f
e77282401fd19d6f818c388c56e66e046e431cdb8dff8ceab486e82753b9aca7	3aa50e04-ba96-4bc4-959b-b7a14aff46f7	1405542421340618815	4	2026-08-05 08:35:22.629+00	\N	2026-08-04 20:35:22.688179+00	2026-08-04 20:35:22.688179+00	f
e522909a23e6072be8d2d1998cffd6cc7a546e2ad9af2c8c5ed20d056af438b3	3aa50e04-ba96-4bc4-959b-b7a14aff46f7	1084074954607308926	1	2026-08-05 08:48:34.228+00	\N	2026-08-04 20:48:34.282198+00	2026-08-04 20:48:34.282198+00	f
1354e96733928a9a009195f3fa3e786362286986baf6c4e9d3b541307e4c1d10	3aa50e04-ba96-4bc4-959b-b7a14aff46f7	1192790397768978492	1	2026-08-05 04:51:18.378+00	\N	2026-08-04 16:51:18.448341+00	2026-08-04 16:51:18.448341+00	f
27b72a9f3ca287d375892c77b1a8c664d1ec8aae2a89ab677872bfc209f116e3	3aa50e04-ba96-4bc4-959b-b7a14aff46f7	1405542421340618815	4	2026-08-05 04:37:23.921+00	\N	2026-08-04 16:37:24.031916+00	2026-08-04 16:37:24.031916+00	f
60525466545c29822359dd831dcd77c25ef8bac755d7346da4a7fd4b617c4218	3aa50e04-ba96-4bc4-959b-b7a14aff46f7	1405542421340618815	4	2026-08-05 04:37:25.125+00	\N	2026-08-04 16:37:25.190935+00	2026-08-04 16:37:25.190935+00	f
5c11bc67b57524f1f897964c3987d33c6bb4e5a137733e47addc068ed74c3368	3aa50e04-ba96-4bc4-959b-b7a14aff46f7	1341125408321441895	1	2026-08-05 05:14:04.017+00	\N	2026-08-04 17:14:04.068847+00	2026-08-04 17:14:04.068847+00	f
32ef9fc56e25afc704bfad5d037788cf4d9f6a2a11a34ce7ce5fa048ed97ccd0	3aa50e04-ba96-4bc4-959b-b7a14aff46f7	1192790397768978492	1	2026-08-05 04:44:38.298+00	\N	2026-08-04 16:44:38.357086+00	2026-08-04 16:44:38.357086+00	f
09e52cd49880341920918215afa51185756cc751cd47bbafae7dfc317a09c5ad	3aa50e04-ba96-4bc4-959b-b7a14aff46f7	1405542421340618815	4	2026-08-05 08:35:42.087+00	\N	2026-08-04 20:35:42.152936+00	2026-08-04 20:35:42.152936+00	f
cdaa6a59f09d0dfae942dd966eeae04015a17e33e8fa11f8283f95ee0f74a72d	3aa50e04-ba96-4bc4-959b-b7a14aff46f7	1084074954607308926	1	2026-08-05 08:48:36.52+00	\N	2026-08-04 20:48:36.575088+00	2026-08-04 20:48:36.575088+00	f
32e6d179662eda38fa008a62dae7da6c63f8184d811fe40bff6147988aaf3dc2	3aa50e04-ba96-4bc4-959b-b7a14aff46f7	1084074954607308926	1	2026-08-05 08:48:55.476+00	\N	2026-08-04 20:48:55.532105+00	2026-08-04 20:48:55.532105+00	f
788b5e933d374b4b23126a69a12a77c22c40139ec57a0fea95a039e1cde96149	3aa50e04-ba96-4bc4-959b-b7a14aff46f7	1192790397768978492	1	2026-08-05 05:02:48.418+00	\N	2026-08-04 17:02:48.546243+00	2026-08-04 17:02:48.546243+00	f
09eb591dc49139d86945ab3137bd4176f18ac01ec0f947218b2b70a864545efb	3aa50e04-ba96-4bc4-959b-b7a14aff46f7	1491366570788651138	1	2026-08-05 06:25:49.005+00	\N	2026-08-04 18:25:49.071974+00	2026-08-04 18:25:49.071974+00	f
7a442fed06126e878e03e5def5d019a6e9a3ed788aba7696928caa7dbc94fc3b	3aa50e04-ba96-4bc4-959b-b7a14aff46f7	1405542421340618815	4	2026-08-05 08:35:53.444+00	\N	2026-08-04 20:35:53.563879+00	2026-08-04 20:35:53.563879+00	f
9e231004a89a6de2d471f782f5cfbcbe51963dbc56f47ffef3b9a15486d29516	3aa50e04-ba96-4bc4-959b-b7a14aff46f7	1084074954607308926	1	2026-08-05 09:04:02.183+00	\N	2026-08-04 21:04:02.300715+00	2026-08-04 21:04:02.300715+00	f
75c96ea36c9f92d78f54cfc68bc69dfea7a99683997fad336e6ce58a8e1431cf	3aa50e04-ba96-4bc4-959b-b7a14aff46f7	1405542421340618815	4	2026-08-05 04:37:28.04+00	\N	2026-08-04 16:37:28.165807+00	2026-08-04 16:37:28.165807+00	f
07b73d273cb81a723b02a3f79df71955910be5f7734a78bf3e7a9c5e7753a4d3	3aa50e04-ba96-4bc4-959b-b7a14aff46f7	1405542421340618815	4	2026-08-05 04:37:29.407+00	\N	2026-08-04 16:37:29.526626+00	2026-08-04 16:37:29.526626+00	f
a5675d42b65f708669d50e73863d3c3ddb156167c3bbfc723a9598c9bff3b937	3aa50e04-ba96-4bc4-959b-b7a14aff46f7	1405542421340618815	4	2026-08-05 04:37:29.734+00	\N	2026-08-04 16:37:29.847029+00	2026-08-04 16:37:29.847029+00	f
2608d984918c1f8ca587636cf98d45f209e6a3ff96e8ee674265253ea3ba7fb1	3aa50e04-ba96-4bc4-959b-b7a14aff46f7	1192790397768978492	1	2026-08-05 04:44:46.163+00	\N	2026-08-04 16:44:46.223553+00	2026-08-04 16:44:46.223553+00	f
2022bafb78c1e70921082011ae5ec4bc5e1a5b3712ece7580cfe615dc85c882c	3aa50e04-ba96-4bc4-959b-b7a14aff46f7	1192790397768978492	1	2026-08-05 05:02:53.579+00	\N	2026-08-04 17:02:53.641967+00	2026-08-04 17:02:53.641967+00	f
05dd69d608cf5917b23aa7f6a4aa861cd083e183c47670f4bc91482c48472d2d	3aa50e04-ba96-4bc4-959b-b7a14aff46f7	959178717026984057	1	2026-08-05 05:20:53.462+00	\N	2026-08-04 17:20:53.521223+00	2026-08-04 17:20:53.521223+00	f
be9554e1fa4f2e68543cb74e8fb435be6267b79e706459a0b820f09355af12b6	3aa50e04-ba96-4bc4-959b-b7a14aff46f7	1192790397768978492	1	2026-08-05 08:08:19.401+00	\N	2026-08-04 20:08:19.46464+00	2026-08-04 20:08:19.46464+00	f
f40d7797652aa2871758beb92142e4db0950dfbe5dcf81358004d0e490b00a34	3aa50e04-ba96-4bc4-959b-b7a14aff46f7	1192790397768978492	1	2026-08-05 08:08:24.086+00	\N	2026-08-04 20:08:24.2171+00	2026-08-04 20:08:24.2171+00	f
47a13bedde69481bf623c3b8cd4b1721fe5e11e5e501994dfa9103567c0d35e0	3aa50e04-ba96-4bc4-959b-b7a14aff46f7	1084074954607308926	1	2026-08-05 08:47:45.828+00	\N	2026-08-04 20:47:45.938754+00	2026-08-04 20:47:45.938754+00	f
8aad2b1ded486be347b7a93aa2d40a1382e67d613b3ce73d313a2252e6e0e744	3aa50e04-ba96-4bc4-959b-b7a14aff46f7	1084074954607308926	1	2026-08-05 09:04:23.094+00	\N	2026-08-04 21:04:23.197712+00	2026-08-04 21:04:23.197712+00	f
44781022ec9991219d47671ebd13cba563868181d34ee28ca3af9e2c60bec0f8	3aa50e04-ba96-4bc4-959b-b7a14aff46f7	959178717026984057	1	2026-08-05 04:41:43.228+00	\N	2026-08-04 16:41:43.30435+00	2026-08-04 16:41:43.30435+00	f
922f0dd7e85d77036c26afa9eb8aed6c02908fe85ebe52646d89f7a9b6f095ef	3aa50e04-ba96-4bc4-959b-b7a14aff46f7	959178717026984057	1	2026-08-05 04:42:04.868+00	\N	2026-08-04 16:42:04.946802+00	2026-08-04 16:42:04.946802+00	f
\.


--
-- Data for Name: profiles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.profiles (id, discord_id, username, display_name, avatar_url, created_at, updated_at, organization_id) FROM stdin;
\.


--
-- Data for Name: shifts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.shifts (id, discord_id, colleague_name, date, start_time, end_time, duration, duration_ms, shift_type, status, started_at, ended_at, auto_stop_at, paused_at, paused_seconds, stop_reason, discord_close_notified_at, discord_close_notification_error, created_at, updated_at, organization_id) FROM stdin;
5c575419-29d0-412e-88c4-0c42363a562c	1491366570788651138	Gabriel Troll # 25250	2026-08-04	20:55:52	21:36:57	00:30:15	1815000	noapte	completed	2026-08-04 17:55:52.705+00	2026-08-04 18:36:57.996+00	2026-08-04 20:00:00+00	\N	650	Încheiere manuală	\N	\N	2026-08-04 17:55:52.705+00	2026-08-04 18:36:56.718111+00	3aa50e04-ba96-4bc4-959b-b7a14aff46f7
76b3b04d-13f3-450f-af73-13010afd1356	247012210021236738	Little Mario I 3000	2026-08-03	11:58:27	11:58:41	00:00:13	13000	zi	completed	2026-08-03 08:58:27.652+00	2026-08-03 08:58:41.627+00	2026-08-03 16:59:00+00	\N	0	Încheiere manuală	\N	\N	2026-08-03 08:58:27.652+00	2026-08-03 08:58:41.844217+00	3aa50e04-ba96-4bc4-959b-b7a14aff46f7
eef116d6-d573-40dc-8ae5-cec2bd9c5659	1341125408321441895	Nicholas Paleta | 30352	2026-08-04	20:14:09	20:22:28	00:08:19	499000	noapte	active	2026-08-04 17:14:09.594+00	2026-08-04 17:22:28.811+00	2026-08-04 20:00:00+00	\N	2162	Încheiere de către manager	\N	\N	2026-08-04 17:14:09.594+00	2026-08-04 18:57:17.891157+00	3aa50e04-ba96-4bc4-959b-b7a14aff46f7
6ba730cc-f20d-4837-8e33-76d7eaad883c	247012210021236738	Little Mario I 3000	2026-08-03	11:59:00	11:59:12	00:00:07	7000	zi	completed	2026-08-03 08:59:00.579+00	2026-08-03 08:59:12.311+00	2026-08-03 16:59:00+00	2026-08-03 08:59:08.158+00	0	Încheiere manuală	\N	\N	2026-08-03 08:59:00.579+00	2026-08-03 08:59:12.496461+00	3aa50e04-ba96-4bc4-959b-b7a14aff46f7
c806e859-b6b5-483c-84ad-56f28d647306	247012210021236738	Little Mario I 3000	2026-08-03	14:23:46	14:24:04	00:00:13	13000	zi	completed	2026-08-03 11:23:46.696+00	2026-08-03 11:24:04.833+00	2026-08-03 16:59:00+00	2026-08-03 11:23:59.468+00	0	Încheiere manuală	\N	\N	2026-08-03 11:23:46.696+00	2026-08-03 11:24:05.450483+00	3aa50e04-ba96-4bc4-959b-b7a14aff46f7
c6bdd08d-9047-4161-9a6c-4f3ee7a04c98	940551066628521994	Neagu Marci I 23873	2026-08-04	20:06:43	23:00:01	02:53:17	10397000	noapte	auto_completed	2026-08-04 17:06:43.972+00	2026-08-04 20:00:01.872+00	2026-08-04 20:00:00+00	\N	0	Încheiere automată – program maxim atins	2026-08-04 20:00:06.045+00	\N	2026-08-04 17:06:43.972+00	2026-08-04 20:00:06.079845+00	3aa50e04-ba96-4bc4-959b-b7a14aff46f7
fa6176fd-4201-4233-a27a-5ce1b8e7028f	1192790397768978492	David Vaselina I 30238	2026-08-04	20:02:47	23:00:10	01:12:25	4345000	noapte	auto_completed	2026-08-04 17:02:47.72+00	2026-08-04 20:00:10.223+00	2026-08-04 20:00:00+00	2026-08-04 18:35:17.93+00	1205	Încheiere automată – program maxim atins	2026-08-04 20:00:11.819+00	\N	2026-08-04 17:02:47.72+00	2026-08-04 20:00:21.336778+00	3aa50e04-ba96-4bc4-959b-b7a14aff46f7
f1c031c1-e3b9-4d64-bc50-4b0e35ca8655	1341125408321441895	Nicholas Paleta | 30352	2026-08-04	22:43:34	23:02:00.176571	00:18:26	1106000	noapte	auto_completed	2026-08-04 19:43:34.136+00	2026-08-04 20:02:00.176571+00	2026-08-04 20:00:00+00	\N	0	Încheiere automată – ora configurată a fost atinsă	2026-08-04 20:04:37.291+00	\N	2026-08-04 19:43:34.136+00	2026-08-04 20:04:37.573751+00	3aa50e04-ba96-4bc4-959b-b7a14aff46f7
910fb18f-4762-4e91-ba6b-783c2cfa85e0	1192790397768978492	David Vaselina I 30238	2026-08-03	19:07:27	19:59:00	00:43:09	2589000	zi	auto_completed	2026-08-03 16:07:27.04+00	2026-08-03 16:59:00.23+00	2026-08-03 16:59:00+00	\N	504	Încheiere automată – program maxim atins	2026-08-03 16:59:02.06+00	\N	2026-08-03 16:07:27.04+00	2026-08-03 16:59:09.267251+00	3aa50e04-ba96-4bc4-959b-b7a14aff46f7
f527e6aa-afea-4538-bbad-d8fe3107e28f	1411405223326515220	Gabriel Molusca | 26947	2026-08-03	19:05:06	19:59:17	00:54:10	3250000	zi	auto_completed	2026-08-03 16:05:06.617+00	2026-08-03 16:59:17.387+00	2026-08-03 16:59:00+00	\N	0	Încheiere automată – program maxim atins	2026-08-03 16:59:18.787+00	\N	2026-08-03 16:05:06.617+00	2026-08-03 16:59:15.767106+00	3aa50e04-ba96-4bc4-959b-b7a14aff46f7
f996e5c5-c537-4e79-9cb8-67e1c77a38c6	1341125408321441895	Nicholas Paleta | 30352	2026-08-04	23:11:47	23:37:41	00:25:53	1553000	zi	completed	2026-08-04 20:11:47.465+00	2026-08-04 20:37:41.112+00	2026-08-05 16:59:00+00	\N	0	Încheiere manuală	\N	\N	2026-08-04 20:11:47.465+00	2026-08-04 20:37:41.234295+00	3aa50e04-ba96-4bc4-959b-b7a14aff46f7
aba17085-e32f-4720-b4ed-e040be349a80	940551066628521994	Neagu Marci I 23873	2026-08-04	23:11:15	23:51:32	00:40:16	2416000	zi	completed	2026-08-04 20:11:15.817+00	2026-08-04 20:51:32.541+00	2026-08-05 16:59:00+00	\N	0	Încheiere manuală	\N	\N	2026-08-04 20:11:15.817+00	2026-08-04 20:51:32.915265+00	3aa50e04-ba96-4bc4-959b-b7a14aff46f7
37dae710-dd39-4ef7-b6c5-5b96d8e27a9a	1411405223326515220	Gabriel Molusca | 26947	2026-08-03	20:00:11	20:40:06	00:37:47	2267000	noapte	completed	2026-08-03 17:00:11.317+00	2026-08-03 17:40:06.191+00	2026-08-03 20:00:00+00	2026-08-03 17:37:58.329+00	0	Încheiere manuală	\N	\N	2026-08-03 17:00:11.317+00	2026-08-03 17:40:03.246056+00	3aa50e04-ba96-4bc4-959b-b7a14aff46f7
15d70d41-96a1-4c11-8846-60ad2df7fd57	247012210021236738	Little Mario I 3000	2026-08-03	20:56:10	20:56:20	00:00:09	9000	noapte	completed	2026-08-03 17:56:10.595+00	2026-08-03 17:56:20.336+00	2026-08-03 20:00:00+00	\N	0	Încheiere manuală	\N	\N	2026-08-03 17:56:10.595+00	2026-08-03 17:56:21.080644+00	3aa50e04-ba96-4bc4-959b-b7a14aff46f7
d0f98243-c191-4318-b9a9-33784dfa7ae8	247012210021236738	Little Mario I 3000	2026-08-03	20:58:57	20:59:04	00:00:06	6000	noapte	completed	2026-08-03 17:58:57.851+00	2026-08-03 17:59:04.838+00	2026-08-03 20:00:00+00	\N	0	Încheiere manuală	\N	\N	2026-08-03 17:58:57.851+00	2026-08-03 17:59:05.468409+00	3aa50e04-ba96-4bc4-959b-b7a14aff46f7
c0229629-0d1a-47a4-95fa-4e9ff8b37e1b	247012210021236738	Little Mario I 3000	2026-08-03	21:06:06	21:06:10	00:00:03	3000	noapte	completed	2026-08-03 18:06:06.951+00	2026-08-03 18:06:10.51+00	2026-08-03 20:00:00+00	\N	0	Încheiere manuală	\N	\N	2026-08-03 18:06:06.951+00	2026-08-03 18:06:11.101714+00	3aa50e04-ba96-4bc4-959b-b7a14aff46f7
18e50962-31b9-46c4-a5ea-7ae2de9c6d82	1192790397768978492	David Vaselina I 30238	2026-08-03	20:02:33	21:13:57	00:44:59	2699000	noapte	completed	2026-08-03 17:02:33.945+00	2026-08-03 18:13:57.552+00	2026-08-03 20:00:00+00	\N	1584	Încheiere manuală	\N	\N	2026-08-03 17:02:33.945+00	2026-08-03 18:14:04.834703+00	3aa50e04-ba96-4bc4-959b-b7a14aff46f7
6ad240a9-42cc-4054-b839-db1ac6866285	940551066628521994	Neagu Marci I 23873	2026-08-03	23:36:05	01:50:47	02:14:42	8082000	zi	completed	2026-08-03 20:36:05.263+00	2026-08-03 22:50:47.723+00	2026-08-04 16:59:00+00	\N	0	Încheiere manuală	\N	\N	2026-08-03 20:36:05.263+00	2026-08-03 22:50:44.069732+00	3aa50e04-ba96-4bc4-959b-b7a14aff46f7
84d2f57d-b979-4a35-8f87-aa9a5bc21c45	247012210021236738	Little Mario I 3000	2026-08-04	09:55:46	09:57:35	00:00:38	38000	zi	completed	2026-08-04 06:55:46.674+00	2026-08-04 06:57:35.883+00	2026-08-04 16:59:00+00	\N	71	Încheiere manuală	\N	\N	2026-08-04 06:55:46.674+00	2026-08-04 06:57:37.455252+00	3aa50e04-ba96-4bc4-959b-b7a14aff46f7
1e8f1f12-d809-469d-a343-c2afddd96c6f	1491366570788651138	Gabriel Troll # 25250	2026-08-04	15:02:12	15:59:43	00:57:31	3451000	zi	completed	2026-08-04 12:02:12.606+00	2026-08-04 12:59:43.639+00	2026-08-04 16:59:00+00	\N	0	Încheiere manuală	\N	\N	2026-08-04 12:02:12.606+00	2026-08-04 12:59:42.646642+00	3aa50e04-ba96-4bc4-959b-b7a14aff46f7
01b52a95-ec10-4547-a432-d883c52b0611	940551066628521994	Neagu Marci I 23873	2026-08-04	19:31:14	19:59:05	00:27:51	1671000	zi	auto_completed	2026-08-04 16:31:14.365+00	2026-08-04 16:59:05.546+00	2026-08-04 16:59:00+00	\N	0	Încheiere automată – program maxim atins	2026-08-04 16:59:19.403+00	\N	2026-08-04 16:31:14.365+00	2026-08-04 16:59:36.357982+00	3aa50e04-ba96-4bc4-959b-b7a14aff46f7
1c5dabc6-f721-498f-8b06-2a799b7f1464	959178717026984057	Matei Caldare | 25169	2026-08-04	19:23:19	20:01:00.0325	00:37:40	2260000	zi	auto_completed	2026-08-04 16:23:19.652+00	2026-08-04 17:01:00.0325+00	2026-08-04 16:59:00+00	\N	0	Încheiere automată – ora configurată a fost atinsă	\N	\N	2026-08-04 16:23:19.652+00	2026-08-04 17:20:53.264604+00	3aa50e04-ba96-4bc4-959b-b7a14aff46f7
22ff0559-1f15-4dfd-879b-ef19e78607a7	247012210021236738	Little Mario I 3000	2026-08-04	20:40:25	20:40:41	00:00:15	15000	noapte	completed	2026-08-04 17:40:25.696+00	2026-08-04 17:40:41.043+00	2026-08-04 20:00:00+00	\N	0	Încheiere manuală	\N	\N	2026-08-04 17:40:25.696+00	2026-08-04 17:40:41.797975+00	3aa50e04-ba96-4bc4-959b-b7a14aff46f7
3ec9cfb5-8621-4701-a77c-b544f0b2b85f	959178717026984057	Matei Caldare | 25169	2026-08-04	20:03:42	21:30:27	01:11:46	4306000	noapte	completed	2026-08-04 17:03:42.993+00	2026-08-04 18:30:27.973+00	2026-08-04 20:00:00+00	\N	898	Încheiere manuală	\N	\N	2026-08-04 17:03:42.993+00	2026-08-04 18:30:28.276029+00	3aa50e04-ba96-4bc4-959b-b7a14aff46f7
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, discord_id, username, display_name, email, avatar, avatar_url, role, default_role, service, maintenance_mode, discord_logs_active, threshold_value, max_shift_hours, created_at, updated_at) FROM stdin;
c8a66815-5241-4539-bfc2-2617d41f3dcf	1491366570788651138	noxxllfaa	Gabriel Troll # 25250	noxxllgta@gmail.com	https://cdn.discordapp.com/avatars/1491366570788651138/4faae2986621af1877a6afa0dbc3c903.png	https://cdn.discordapp.com/avatars/1491366570788651138/4faae2986621af1877a6afa0dbc3c903.png	Mecanic	Mecanic	Atelier	f	t	0	8	2026-08-04 12:01:48.350626+00	2026-08-04 18:25:48.859935+00
2656eb31-7b9f-4244-be5e-5554362e80d2	247012210021236738	littlemario_	Little Mario I 3000	1nebun@gmail.com	https://cdn.discordapp.com/avatars/247012210021236738/599768c8febb969e060a013d972752d0.png	https://cdn.discordapp.com/avatars/247012210021236738/599768c8febb969e060a013d972752d0.png	Caporegime	Caporegime	Atelier	f	t	0	8	2026-08-03 08:45:40.3646+00	2026-08-05 07:16:55.901586+00
c9a370c5-c4d5-4c9d-9723-a6336e74fd0f	1192790397768978492	david2acbh	David Vaselina I 30238	obadadavid096@gmail.com	https://cdn.discordapp.com/avatars/1192790397768978492/3090b6ded310861ac743d57d4d6343a2.png	https://cdn.discordapp.com/avatars/1192790397768978492/3090b6ded310861ac743d57d4d6343a2.png	Mecanic	Mecanic	Atelier	f	t	0	8	2026-08-03 16:07:26.936511+00	2026-08-04 20:08:23.90997+00
ab0f847a-c5c5-47c7-b408-809b6c7aae06	1395712209392369785	yonutz0048	Johny I 18762	\N	https://cdn.discordapp.com/avatars/1395712209392369785/1aed4dca4bb8240ca0083be5788ff04b.png	https://cdn.discordapp.com/avatars/1395712209392369785/1aed4dca4bb8240ca0083be5788ff04b.png	Caporegime	Caporegime	Atelier	f	t	0	8	2026-08-04 13:20:18.361249+00	2026-08-04 13:20:18.361249+00
8f3cdb02-01ae-41c4-b65b-2f2881079a2d	940551066628521994	marci_18.	Neagu Marci I 23873	\N	https://cdn.discordapp.com/avatars/940551066628521994/b17413df1313c08546a09ebef6b06bcb.png	https://cdn.discordapp.com/avatars/940551066628521994/b17413df1313c08546a09ebef6b06bcb.png	Mecanic	Mecanic	Atelier	f	t	0	8	2026-08-03 20:35:41.813608+00	2026-08-04 16:18:42.647735+00
10b584f9-de8f-4f0c-a2c4-03ed1172fd0a	1411405223326515220	gabi_bab_66485	Gabriel Molusca | 26947	gabrielbabascu@yahoo.com	https://cdn.discordapp.com/avatars/1411405223326515220/05afa2c1c24788ddb08dc01431d0dbf5.png	https://cdn.discordapp.com/avatars/1411405223326515220/05afa2c1c24788ddb08dc01431d0dbf5.png	Mecanic	Mecanic	Atelier	f	t	0	8	2026-08-03 16:04:41.784173+00	2026-08-03 17:39:13.321013+00
59e885f8-caad-47e2-835b-067c6f1f4acd	1341125408321441895	bndzzz2	Nicholas Paleta | 30352	nicholas.frog21@gmail.com	https://cdn.discordapp.com/avatars/1341125408321441895/56169964899be3f71bf0d4675b61d306.png	https://cdn.discordapp.com/avatars/1341125408321441895/56169964899be3f71bf0d4675b61d306.png	Mecanic	Mecanic	Atelier	f	t	0	8	2026-08-04 17:14:03.923399+00	2026-08-04 17:14:03.923399+00
4cfc255d-f08d-4ccc-8309-bc5bbd11db0c	959178717026984057	danielpb3373	Matei Caldare | 25169	giangadaniel00@gmail.com	https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f468-200d-1f4bb.png	https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f468-200d-1f4bb.png	Mecanic	Mecanic	Atelier	f	t	0	8	2026-08-04 16:23:08.810319+00	2026-08-04 17:20:53.264604+00
5c965fc8-2e3a-4658-bf7e-745cf9ce522f	1084074954607308926	jsn1405	Giussepe Dravetti | 20847	vchinezu334@gmail.com	https://cdn.discordapp.com/avatars/1084074954607308926/73f223542f750ac1ef685c077313538a.png	https://cdn.discordapp.com/avatars/1084074954607308926/73f223542f750ac1ef685c077313538a.png	Mecanic	Mecanic	Atelier	f	t	0	8	2026-08-04 20:47:45.650048+00	2026-08-04 21:04:30.858556+00
779861e4-1393-40be-a8a7-1ec8a4004d38	1405542421340618815	qsvxzy	Mario Fuentes | 30340	kensefuromaniei@gmail.com	https://cdn.discordapp.com/avatars/1405542421340618815/2acb2ccc7b605231af50fe9646f5260b.png	https://cdn.discordapp.com/avatars/1405542421340618815/2acb2ccc7b605231af50fe9646f5260b.png	Manager	Manager	Atelier	f	t	0	8	2026-08-03 15:40:01.733789+00	2026-08-04 20:35:53.299189+00
\.


--
-- Name: admin_audit_log_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.admin_audit_log_id_seq', 2, true);


--
-- Name: panel_notifications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.panel_notifications_id_seq', 1, false);


--
-- Name: absences absences_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.absences
    ADD CONSTRAINT absences_pkey PRIMARY KEY (id);


--
-- Name: admin_audit_log admin_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_audit_log
    ADD CONSTRAINT admin_audit_log_pkey PRIMARY KEY (id);


--
-- Name: app_settings app_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.app_settings
    ADD CONSTRAINT app_settings_pkey PRIMARY KEY (organization_id, key);


--
-- Name: community_poll_options community_poll_options_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.community_poll_options
    ADD CONSTRAINT community_poll_options_pkey PRIMARY KEY (id);


--
-- Name: community_poll_votes community_poll_votes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.community_poll_votes
    ADD CONSTRAINT community_poll_votes_pkey PRIMARY KEY (id);


--
-- Name: community_poll_votes community_poll_votes_post_id_user_discord_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.community_poll_votes
    ADD CONSTRAINT community_poll_votes_post_id_user_discord_id_key UNIQUE (post_id, user_discord_id);


--
-- Name: community_posts community_posts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.community_posts
    ADD CONSTRAINT community_posts_pkey PRIMARY KEY (id);


--
-- Name: community_reactions community_reactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.community_reactions
    ADD CONSTRAINT community_reactions_pkey PRIMARY KEY (id);


--
-- Name: community_reactions community_reactions_post_id_user_discord_id_reaction_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.community_reactions
    ADD CONSTRAINT community_reactions_post_id_user_discord_id_reaction_key UNIQUE (post_id, user_discord_id, reaction);


--
-- Name: discord_panel_config discord_panel_config_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.discord_panel_config
    ADD CONSTRAINT discord_panel_config_pkey PRIMARY KEY (id);


--
-- Name: discord_role_mappings discord_role_mappings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.discord_role_mappings
    ADD CONSTRAINT discord_role_mappings_pkey PRIMARY KEY (discord_role_id);


--
-- Name: illegal_locations illegal_locations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.illegal_locations
    ADD CONSTRAINT illegal_locations_pkey PRIMARY KEY (id);


--
-- Name: marketplace_ilegal marketplace_ilegal_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketplace_ilegal
    ADD CONSTRAINT marketplace_ilegal_pkey PRIMARY KEY (id);


--
-- Name: marketplace marketplace_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketplace
    ADD CONSTRAINT marketplace_pkey PRIMARY KEY (id);


--
-- Name: organization_expiration_notifications organization_expiration_notificat_organization_id_threshold_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_expiration_notifications
    ADD CONSTRAINT organization_expiration_notificat_organization_id_threshold_key UNIQUE (organization_id, threshold);


--
-- Name: organization_expiration_notifications organization_expiration_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_expiration_notifications
    ADD CONSTRAINT organization_expiration_notifications_pkey PRIMARY KEY (id);


--
-- Name: organization_guilds organization_guilds_guild_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_guilds
    ADD CONSTRAINT organization_guilds_guild_id_key UNIQUE (guild_id);


--
-- Name: organization_guilds organization_guilds_organization_id_kind_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_guilds
    ADD CONSTRAINT organization_guilds_organization_id_kind_key UNIQUE (organization_id, kind);


--
-- Name: organization_guilds organization_guilds_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_guilds
    ADD CONSTRAINT organization_guilds_pkey PRIMARY KEY (id);


--
-- Name: organization_lifecycle_events organization_lifecycle_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_lifecycle_events
    ADD CONSTRAINT organization_lifecycle_events_pkey PRIMARY KEY (id);


--
-- Name: organization_members organization_members_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_members
    ADD CONSTRAINT organization_members_pkey PRIMARY KEY (organization_id, discord_id);


--
-- Name: organization_role_mappings organization_role_mappings_organization_id_guild_id_discord_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_role_mappings
    ADD CONSTRAINT organization_role_mappings_organization_id_guild_id_discord_key UNIQUE (organization_id, guild_id, discord_role_id);


--
-- Name: organization_role_mappings organization_role_mappings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_role_mappings
    ADD CONSTRAINT organization_role_mappings_pkey PRIMARY KEY (id);


--
-- Name: organization_settings organization_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_settings
    ADD CONSTRAINT organization_settings_pkey PRIMARY KEY (organization_id);


--
-- Name: organization_vouchers organization_vouchers_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_vouchers
    ADD CONSTRAINT organization_vouchers_code_key UNIQUE (code);


--
-- Name: organization_vouchers organization_vouchers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_vouchers
    ADD CONSTRAINT organization_vouchers_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_slug_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_slug_key UNIQUE (slug);


--
-- Name: panel_notification_reads panel_notification_reads_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.panel_notification_reads
    ADD CONSTRAINT panel_notification_reads_pkey PRIMARY KEY (notification_id, discord_id);


--
-- Name: panel_notifications panel_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.panel_notifications
    ADD CONSTRAINT panel_notifications_pkey PRIMARY KEY (id);


--
-- Name: panel_sessions panel_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.panel_sessions
    ADD CONSTRAINT panel_sessions_pkey PRIMARY KEY (token_hash);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: shifts shifts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shifts
    ADD CONSTRAINT shifts_pkey PRIMARY KEY (id);


--
-- Name: users users_discord_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_discord_id_key UNIQUE (discord_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: absences_discord_id_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX absences_discord_id_created_at_idx ON public.absences USING btree (discord_id, created_at DESC);


--
-- Name: absences_end_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX absences_end_at_idx ON public.absences USING btree (end_at);


--
-- Name: absences_organization_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX absences_organization_idx ON public.absences USING btree (organization_id);


--
-- Name: admin_audit_log_organization_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX admin_audit_log_organization_idx ON public.admin_audit_log USING btree (organization_id);


--
-- Name: app_settings_organization_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX app_settings_organization_idx ON public.app_settings USING btree (organization_id);


--
-- Name: audit_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX audit_created_at_idx ON public.admin_audit_log USING btree (created_at DESC);


--
-- Name: community_poll_options_organization_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX community_poll_options_organization_idx ON public.community_poll_options USING btree (organization_id);


--
-- Name: community_poll_options_organization_post_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX community_poll_options_organization_post_idx ON public.community_poll_options USING btree (organization_id, post_id, "position");


--
-- Name: community_poll_votes_organization_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX community_poll_votes_organization_idx ON public.community_poll_votes USING btree (organization_id);


--
-- Name: community_poll_votes_organization_post_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX community_poll_votes_organization_post_idx ON public.community_poll_votes USING btree (organization_id, post_id);


--
-- Name: community_posts_organization_created_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX community_posts_organization_created_idx ON public.community_posts USING btree (organization_id, created_at DESC);


--
-- Name: community_posts_organization_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX community_posts_organization_idx ON public.community_posts USING btree (organization_id);


--
-- Name: community_reactions_organization_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX community_reactions_organization_idx ON public.community_reactions USING btree (organization_id);


--
-- Name: community_reactions_organization_post_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX community_reactions_organization_post_idx ON public.community_reactions USING btree (organization_id, post_id);


--
-- Name: discord_role_mappings_permission_level_uidx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX discord_role_mappings_permission_level_uidx ON public.discord_role_mappings USING btree (permission_level);


--
-- Name: illegal_locations_map_category_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX illegal_locations_map_category_idx ON public.illegal_locations USING btree (map_key, category);


--
-- Name: illegal_locations_organization_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX illegal_locations_organization_idx ON public.illegal_locations USING btree (organization_id);


--
-- Name: marketplace_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX marketplace_created_at_idx ON public.marketplace USING btree (created_at DESC);


--
-- Name: marketplace_created_by_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX marketplace_created_by_idx ON public.marketplace USING btree (created_by_discord_id);


--
-- Name: marketplace_ilegal_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX marketplace_ilegal_created_at_idx ON public.marketplace_ilegal USING btree (created_at DESC);


--
-- Name: marketplace_ilegal_created_by_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX marketplace_ilegal_created_by_idx ON public.marketplace_ilegal USING btree (created_by_discord_id);


--
-- Name: marketplace_ilegal_organization_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX marketplace_ilegal_organization_idx ON public.marketplace_ilegal USING btree (organization_id);


--
-- Name: marketplace_organization_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX marketplace_organization_idx ON public.marketplace USING btree (organization_id);


--
-- Name: notifications_recipient_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX notifications_recipient_idx ON public.panel_notifications USING btree (recipient_discord_id, created_at DESC);


--
-- Name: organization_lifecycle_events_org_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX organization_lifecycle_events_org_idx ON public.organization_lifecycle_events USING btree (organization_id, created_at DESC);


--
-- Name: organization_role_mappings_org_guild_level_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX organization_role_mappings_org_guild_level_idx ON public.organization_role_mappings USING btree (organization_id, guild_id, permission_level);


--
-- Name: organization_vouchers_code_lower_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX organization_vouchers_code_lower_idx ON public.organization_vouchers USING btree (lower(code));


--
-- Name: organization_vouchers_org_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX organization_vouchers_org_idx ON public.organization_vouchers USING btree (organization_id);


--
-- Name: panel_notification_reads_organization_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX panel_notification_reads_organization_idx ON public.panel_notification_reads USING btree (organization_id);


--
-- Name: panel_notifications_organization_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX panel_notifications_organization_idx ON public.panel_notifications USING btree (organization_id);


--
-- Name: panel_sessions_lookup_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX panel_sessions_lookup_idx ON public.panel_sessions USING btree (token_hash, expires_at) WHERE (revoked_at IS NULL);


--
-- Name: profiles_org_discord_uidx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX profiles_org_discord_uidx ON public.profiles USING btree (organization_id, discord_id) WHERE (discord_id IS NOT NULL);


--
-- Name: profiles_organization_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX profiles_organization_idx ON public.profiles USING btree (organization_id);


--
-- Name: shifts_date_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX shifts_date_idx ON public.shifts USING btree (date DESC);


--
-- Name: shifts_discord_id_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX shifts_discord_id_created_at_idx ON public.shifts USING btree (discord_id, created_at DESC);


--
-- Name: shifts_one_open_shift_per_org_user_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX shifts_one_open_shift_per_org_user_idx ON public.shifts USING btree (organization_id, discord_id) WHERE ((status = ANY (ARRAY['active'::text, 'paused'::text])) AND (end_time IS NULL));


--
-- Name: shifts_organization_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX shifts_organization_idx ON public.shifts USING btree (organization_id);


--
-- Name: shifts_pending_auto_discord_notification_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX shifts_pending_auto_discord_notification_idx ON public.shifts USING btree (auto_stop_at) WHERE ((status = 'auto_completed'::text) AND (discord_close_notified_at IS NULL));


--
-- Name: shifts_status_auto_stop_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX shifts_status_auto_stop_at_idx ON public.shifts USING btree (status, auto_stop_at);


--
-- Name: absences absences_set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER absences_set_updated_at BEFORE UPDATE ON public.absences FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: organization_guilds enforce_package_guild_limits; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER enforce_package_guild_limits BEFORE INSERT OR UPDATE ON public.organization_guilds FOR EACH ROW EXECUTE FUNCTION public.enforce_organization_package_limits();


--
-- Name: organization_role_mappings enforce_package_role_limits; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER enforce_package_role_limits BEFORE INSERT OR UPDATE ON public.organization_role_mappings FOR EACH ROW EXECUTE FUNCTION public.enforce_organization_package_limits();


--
-- Name: marketplace_ilegal marketplace_ilegal_set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER marketplace_ilegal_set_updated_at BEFORE UPDATE ON public.marketplace_ilegal FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: marketplace marketplace_set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER marketplace_set_updated_at BEFORE UPDATE ON public.marketplace FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: shifts shifts_fill_colleague_name; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER shifts_fill_colleague_name BEFORE INSERT OR UPDATE OF discord_id, colleague_name ON public.shifts FOR EACH ROW EXECUTE FUNCTION public.fill_shift_colleague_name();


--
-- Name: shifts shifts_set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER shifts_set_updated_at BEFORE UPDATE ON public.shifts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: users users_set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER users_set_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: users users_sync_name_to_shifts; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER users_sync_name_to_shifts AFTER INSERT OR UPDATE OF display_name, username ON public.users FOR EACH ROW EXECUTE FUNCTION public.sync_user_name_to_shifts();


--
-- Name: absences absences_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.absences
    ADD CONSTRAINT absences_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: admin_audit_log admin_audit_log_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_audit_log
    ADD CONSTRAINT admin_audit_log_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: app_settings app_settings_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.app_settings
    ADD CONSTRAINT app_settings_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: community_poll_options community_poll_options_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.community_poll_options
    ADD CONSTRAINT community_poll_options_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: community_poll_options community_poll_options_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.community_poll_options
    ADD CONSTRAINT community_poll_options_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.community_posts(id) ON DELETE CASCADE;


--
-- Name: community_poll_votes community_poll_votes_option_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.community_poll_votes
    ADD CONSTRAINT community_poll_votes_option_id_fkey FOREIGN KEY (option_id) REFERENCES public.community_poll_options(id) ON DELETE CASCADE;


--
-- Name: community_poll_votes community_poll_votes_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.community_poll_votes
    ADD CONSTRAINT community_poll_votes_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: community_poll_votes community_poll_votes_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.community_poll_votes
    ADD CONSTRAINT community_poll_votes_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.community_posts(id) ON DELETE CASCADE;


--
-- Name: community_posts community_posts_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.community_posts
    ADD CONSTRAINT community_posts_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: community_reactions community_reactions_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.community_reactions
    ADD CONSTRAINT community_reactions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: community_reactions community_reactions_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.community_reactions
    ADD CONSTRAINT community_reactions_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.community_posts(id) ON DELETE CASCADE;


--
-- Name: illegal_locations illegal_locations_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.illegal_locations
    ADD CONSTRAINT illegal_locations_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: marketplace_ilegal marketplace_ilegal_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketplace_ilegal
    ADD CONSTRAINT marketplace_ilegal_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: marketplace marketplace_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketplace
    ADD CONSTRAINT marketplace_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: organization_expiration_notifications organization_expiration_notifications_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_expiration_notifications
    ADD CONSTRAINT organization_expiration_notifications_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: organization_guilds organization_guilds_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_guilds
    ADD CONSTRAINT organization_guilds_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: organization_lifecycle_events organization_lifecycle_events_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_lifecycle_events
    ADD CONSTRAINT organization_lifecycle_events_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: organization_members organization_members_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_members
    ADD CONSTRAINT organization_members_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: organization_role_mappings organization_role_mappings_guild_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_role_mappings
    ADD CONSTRAINT organization_role_mappings_guild_id_fkey FOREIGN KEY (guild_id) REFERENCES public.organization_guilds(guild_id) ON DELETE CASCADE;


--
-- Name: organization_role_mappings organization_role_mappings_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_role_mappings
    ADD CONSTRAINT organization_role_mappings_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: organization_settings organization_settings_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_settings
    ADD CONSTRAINT organization_settings_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: organization_vouchers organization_vouchers_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_vouchers
    ADD CONSTRAINT organization_vouchers_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE SET NULL;


--
-- Name: organization_vouchers organization_vouchers_redeemed_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_vouchers
    ADD CONSTRAINT organization_vouchers_redeemed_organization_id_fkey FOREIGN KEY (redeemed_organization_id) REFERENCES public.organizations(id) ON DELETE SET NULL;


--
-- Name: panel_notification_reads panel_notification_reads_notification_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.panel_notification_reads
    ADD CONSTRAINT panel_notification_reads_notification_id_fkey FOREIGN KEY (notification_id) REFERENCES public.panel_notifications(id) ON DELETE CASCADE;


--
-- Name: panel_notification_reads panel_notification_reads_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.panel_notification_reads
    ADD CONSTRAINT panel_notification_reads_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: panel_notifications panel_notifications_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.panel_notifications
    ADD CONSTRAINT panel_notifications_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: panel_sessions panel_sessions_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.panel_sessions
    ADD CONSTRAINT panel_sessions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: shifts shifts_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shifts
    ADD CONSTRAINT shifts_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: absences; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.absences ENABLE ROW LEVEL SECURITY;

--
-- Name: absences absences_delete_admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY absences_delete_admin ON public.absences FOR DELETE TO authenticated, anon USING (((organization_id = public.current_panel_organization_id()) AND (public.current_panel_permission_level() >= 4)));


--
-- Name: absences absences_insert_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY absences_insert_own ON public.absences FOR INSERT TO authenticated, anon WITH CHECK (((organization_id = public.current_panel_organization_id()) AND (discord_id = public.current_panel_discord_id())));


--
-- Name: absences absences_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY absences_read ON public.absences FOR SELECT TO authenticated, anon USING ((organization_id = public.current_panel_organization_id()));


--
-- Name: absences absences_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY absences_update ON public.absences FOR UPDATE TO authenticated, anon USING (((organization_id = public.current_panel_organization_id()) AND ((discord_id = public.current_panel_discord_id()) OR (public.current_panel_permission_level() >= 4)))) WITH CHECK ((organization_id = public.current_panel_organization_id()));


--
-- Name: admin_audit_log; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

--
-- Name: app_settings; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: app_settings app_settings_admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY app_settings_admin ON public.app_settings TO authenticated, anon USING (((organization_id = public.current_panel_organization_id()) AND (public.current_panel_permission_level() = 7))) WITH CHECK (((organization_id = public.current_panel_organization_id()) AND (public.current_panel_permission_level() = 7)));


--
-- Name: app_settings app_settings_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY app_settings_read ON public.app_settings FOR SELECT TO authenticated, anon USING ((organization_id = public.current_panel_organization_id()));


--
-- Name: admin_audit_log audit_read_admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY audit_read_admin ON public.admin_audit_log FOR SELECT TO authenticated, anon USING (((organization_id = public.current_panel_organization_id()) AND (public.current_panel_permission_level() = 7)));


--
-- Name: community_poll_options community_options_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY community_options_read ON public.community_poll_options FOR SELECT TO authenticated, anon USING ((organization_id = public.current_panel_organization_id()));


--
-- Name: community_poll_options; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.community_poll_options ENABLE ROW LEVEL SECURITY;

--
-- Name: community_poll_votes; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.community_poll_votes ENABLE ROW LEVEL SECURITY;

--
-- Name: community_posts; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;

--
-- Name: community_posts community_posts_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY community_posts_read ON public.community_posts FOR SELECT TO authenticated, anon USING ((organization_id = public.current_panel_organization_id()));


--
-- Name: community_reactions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.community_reactions ENABLE ROW LEVEL SECURITY;

--
-- Name: community_reactions community_reactions_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY community_reactions_read ON public.community_reactions FOR SELECT TO authenticated, anon USING ((organization_id = public.current_panel_organization_id()));


--
-- Name: community_poll_votes community_votes_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY community_votes_read ON public.community_poll_votes FOR SELECT TO authenticated, anon USING ((organization_id = public.current_panel_organization_id()));


--
-- Name: discord_panel_config; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.discord_panel_config ENABLE ROW LEVEL SECURITY;

--
-- Name: discord_role_mappings; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.discord_role_mappings ENABLE ROW LEVEL SECURITY;

--
-- Name: organization_guilds guild_session_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY guild_session_read ON public.organization_guilds FOR SELECT TO authenticated, anon USING ((organization_id = public.current_panel_organization_id()));


--
-- Name: illegal_locations; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.illegal_locations ENABLE ROW LEVEL SECURITY;

--
-- Name: illegal_locations locations_admin; Type: POLICY; Schema: public; Owner: postgres
--

DROP POLICY IF EXISTS locations_delete_platform_admin ON public.illegal_locations;
DROP POLICY IF EXISTS locations_global_admin_delete ON public.illegal_locations;
DROP POLICY IF EXISTS locations_global_admin_insert ON public.illegal_locations;
DROP POLICY IF EXISTS locations_global_admin_update ON public.illegal_locations;
DROP POLICY IF EXISTS locations_global_read ON public.illegal_locations;
DROP POLICY IF EXISTS locations_insert_platform_admin ON public.illegal_locations;
DROP POLICY IF EXISTS locations_update_platform_admin ON public.illegal_locations;

CREATE POLICY locations_admin ON public.illegal_locations TO authenticated, anon USING (((organization_id IS NULL) AND public.current_panel_is_platform_admin())) WITH CHECK (((organization_id IS NULL) AND public.current_panel_is_platform_admin()));


--
-- Name: illegal_locations locations_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY locations_read ON public.illegal_locations FOR SELECT TO authenticated, anon USING (((organization_id IS NULL) OR (organization_id = public.current_panel_organization_id())));


--
-- Name: marketplace; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.marketplace ENABLE ROW LEVEL SECURITY;

--
-- Name: marketplace_ilegal; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.marketplace_ilegal ENABLE ROW LEVEL SECURITY;

--
-- Name: marketplace_ilegal marketplace_illegal_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY marketplace_illegal_insert ON public.marketplace_ilegal FOR INSERT TO authenticated, anon WITH CHECK (((organization_id IS NULL) AND (created_by_discord_id = public.current_panel_discord_id()) AND (public.current_panel_permission_level() >= 3)));


--
-- Name: marketplace_ilegal marketplace_illegal_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY marketplace_illegal_read ON public.marketplace_ilegal FOR SELECT TO authenticated, anon USING (((organization_id IS NULL) OR (organization_id = public.current_panel_organization_id())));


--
-- Name: marketplace_ilegal marketplace_illegal_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY marketplace_illegal_update ON public.marketplace_ilegal FOR UPDATE TO authenticated, anon USING ((((organization_id IS NULL) OR (organization_id = public.current_panel_organization_id())) AND ((created_by_discord_id = public.current_panel_discord_id()) OR (public.current_panel_permission_level() = 7)))) WITH CHECK ((organization_id IS NULL));


--
-- Name: marketplace marketplace_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY marketplace_insert ON public.marketplace FOR INSERT TO authenticated, anon WITH CHECK (((organization_id = public.current_panel_organization_id()) AND (created_by_discord_id = public.current_panel_discord_id())));


--
-- Name: marketplace marketplace_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY marketplace_read ON public.marketplace FOR SELECT TO authenticated, anon USING ((organization_id = public.current_panel_organization_id()));


--
-- Name: marketplace marketplace_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY marketplace_update ON public.marketplace FOR UPDATE TO authenticated, anon USING (((organization_id = public.current_panel_organization_id()) AND ((created_by_discord_id = public.current_panel_discord_id()) OR (public.current_panel_permission_level() = 7)))) WITH CHECK ((organization_id = public.current_panel_organization_id()));


--
-- Name: organization_members members_session_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY members_session_read ON public.organization_members FOR SELECT TO authenticated, anon USING ((organization_id = public.current_panel_organization_id()));


--
-- Name: panel_notification_reads notification_reads_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY notification_reads_read ON public.panel_notification_reads FOR SELECT TO authenticated, anon USING (((organization_id = public.current_panel_organization_id()) AND (discord_id = public.current_panel_discord_id())));


--
-- Name: panel_notifications notifications_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY notifications_read ON public.panel_notifications FOR SELECT TO authenticated, anon USING (((organization_id = public.current_panel_organization_id()) AND ((recipient_discord_id IS NULL) OR (recipient_discord_id = public.current_panel_discord_id()))));


--
-- Name: organization_expiration_notifications; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.organization_expiration_notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: organization_guilds; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.organization_guilds ENABLE ROW LEVEL SECURITY;

--
-- Name: organization_lifecycle_events; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.organization_lifecycle_events ENABLE ROW LEVEL SECURITY;

--
-- Name: organization_members; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

--
-- Name: organization_role_mappings; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.organization_role_mappings ENABLE ROW LEVEL SECURITY;

--
-- Name: organizations organization_session_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY organization_session_read ON public.organizations FOR SELECT TO authenticated, anon USING ((id = public.current_panel_organization_id()));


--
-- Name: organization_settings; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.organization_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: organization_vouchers; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.organization_vouchers ENABLE ROW LEVEL SECURITY;

--
-- Name: organizations; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

--
-- Name: panel_notification_reads; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.panel_notification_reads ENABLE ROW LEVEL SECURITY;

--
-- Name: panel_notifications; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.panel_notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: panel_sessions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.panel_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles profiles_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY profiles_read ON public.profiles FOR SELECT TO authenticated, anon USING ((organization_id = public.current_panel_organization_id()));


--
-- Name: discord_role_mappings role mappings readable by anon; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "role mappings readable by anon" ON public.discord_role_mappings FOR SELECT TO anon USING (true);


--
-- Name: organization_role_mappings roles_session_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY roles_session_read ON public.organization_role_mappings FOR SELECT TO authenticated, anon USING ((organization_id = public.current_panel_organization_id()));


--
-- Name: organization_settings settings_admin_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY settings_admin_read ON public.organization_settings FOR SELECT TO authenticated, anon USING (((organization_id = public.current_panel_organization_id()) AND (public.current_panel_permission_level() = 7)));


--
-- Name: shifts; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;

--
-- Name: shifts shifts_delete_admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY shifts_delete_admin ON public.shifts FOR DELETE TO authenticated, anon USING (((organization_id = public.current_panel_organization_id()) AND (public.current_panel_permission_level() >= 4)));


--
-- Name: shifts shifts_insert_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY shifts_insert_own ON public.shifts FOR INSERT TO authenticated, anon WITH CHECK (((organization_id = public.current_panel_organization_id()) AND (discord_id = public.current_panel_discord_id())));


--
-- Name: shifts shifts_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY shifts_read ON public.shifts FOR SELECT TO authenticated, anon USING ((organization_id = public.current_panel_organization_id()));


--
-- Name: shifts shifts_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY shifts_update ON public.shifts FOR UPDATE TO authenticated, anon USING (((organization_id = public.current_panel_organization_id()) AND ((discord_id = public.current_panel_discord_id()) OR (public.current_panel_permission_level() >= 4)))) WITH CHECK ((organization_id = public.current_panel_organization_id()));


--
-- Name: users; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

--
-- Name: users users_tenant_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY users_tenant_read ON public.users FOR SELECT TO authenticated, anon USING (((EXISTS ( SELECT 1
   FROM public.organization_members m
  WHERE ((m.organization_id = public.current_panel_organization_id()) AND (m.discord_id = users.discord_id) AND m.active))) AND ((discord_id = public.current_panel_discord_id()) OR (public.current_panel_permission_level() >= 4))));


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: postgres
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;
GRANT ALL ON SCHEMA public TO anon;
GRANT ALL ON SCHEMA public TO authenticated;
GRANT ALL ON SCHEMA public TO service_role;


--
-- Name: FUNCTION cleanup_panel_data_older_than_30_days(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.cleanup_panel_data_older_than_30_days() FROM PUBLIC;
GRANT ALL ON FUNCTION public.cleanup_panel_data_older_than_30_days() TO service_role;


--
-- Name: FUNCTION close_expired_shifts_in_database(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.close_expired_shifts_in_database() FROM PUBLIC;
GRANT ALL ON FUNCTION public.close_expired_shifts_in_database() TO service_role;


--
-- Name: FUNCTION current_panel_discord_id(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.current_panel_discord_id() FROM PUBLIC;
GRANT ALL ON FUNCTION public.current_panel_discord_id() TO service_role;
GRANT ALL ON FUNCTION public.current_panel_discord_id() TO anon;
GRANT ALL ON FUNCTION public.current_panel_discord_id() TO authenticated;


--
-- Name: FUNCTION current_panel_organization_id(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.current_panel_organization_id() FROM PUBLIC;
GRANT ALL ON FUNCTION public.current_panel_organization_id() TO service_role;
GRANT ALL ON FUNCTION public.current_panel_organization_id() TO anon;
GRANT ALL ON FUNCTION public.current_panel_organization_id() TO authenticated;


--
-- Name: FUNCTION current_panel_permission_level(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.current_panel_permission_level() FROM PUBLIC;
GRANT ALL ON FUNCTION public.current_panel_permission_level() TO service_role;
GRANT ALL ON FUNCTION public.current_panel_permission_level() TO anon;
GRANT ALL ON FUNCTION public.current_panel_permission_level() TO authenticated;


--
-- Name: FUNCTION current_panel_is_platform_admin(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.current_panel_is_platform_admin() FROM PUBLIC;
GRANT ALL ON FUNCTION public.current_panel_is_platform_admin() TO service_role;
GRANT ALL ON FUNCTION public.current_panel_is_platform_admin() TO anon;
GRANT ALL ON FUNCTION public.current_panel_is_platform_admin() TO authenticated;


--
-- Name: FUNCTION enforce_organization_package_limits(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.enforce_organization_package_limits() TO service_role;


--
-- Name: FUNCTION fill_shift_colleague_name(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.fill_shift_colleague_name() TO service_role;


--
-- Name: FUNCTION get_discord_oauth_config(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.get_discord_oauth_config() FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_discord_oauth_config() TO service_role;
GRANT ALL ON FUNCTION public.get_discord_oauth_config() TO anon;
GRANT ALL ON FUNCTION public.get_discord_oauth_config() TO authenticated;


--
-- Name: FUNCTION get_panel_system_diagnostics(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.get_panel_system_diagnostics() FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_panel_system_diagnostics() TO service_role;


--
-- Name: FUNCTION get_user_directory(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.get_user_directory() FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_user_directory() TO service_role;
GRANT ALL ON FUNCTION public.get_user_directory() TO anon;
GRANT ALL ON FUNCTION public.get_user_directory() TO authenticated;


--
-- Name: FUNCTION handle_new_user(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.handle_new_user() TO service_role;


--
-- Name: FUNCTION panel_session_context(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.panel_session_context() FROM PUBLIC;
GRANT ALL ON FUNCTION public.panel_session_context() TO service_role;
GRANT ALL ON FUNCTION public.panel_session_context() TO anon;
GRANT ALL ON FUNCTION public.panel_session_context() TO authenticated;


--
-- Name: FUNCTION pause_expired_organizations(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.pause_expired_organizations() TO service_role;


--
-- Name: FUNCTION queue_organization_expiration_notifications(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.queue_organization_expiration_notifications() TO service_role;


--
-- Name: FUNCTION rls_auto_enable(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.rls_auto_enable() TO service_role;


--
-- Name: FUNCTION rpc_actualizeaza_inventar(p_item_id uuid, p_cantitate_noua integer, p_user_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.rpc_actualizeaza_inventar(p_item_id uuid, p_cantitate_noua integer, p_user_id uuid) TO service_role;


--
-- Name: FUNCTION rpc_gestioneaza_cerere(p_cerere_id uuid, p_status_nou text, p_admin_id uuid, p_comentariu text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.rpc_gestioneaza_cerere(p_cerere_id uuid, p_status_nou text, p_admin_id uuid, p_comentariu text) TO service_role;


--
-- Name: FUNCTION rpc_obtine_statistici_panou(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.rpc_obtine_statistici_panou() TO service_role;


--
-- Name: FUNCTION rpc_salveaza_calcul(p_user_id uuid, p_tip_calculator text, p_date_intrare jsonb, p_rezultat jsonb); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.rpc_salveaza_calcul(p_user_id uuid, p_tip_calculator text, p_date_intrare jsonb, p_rezultat jsonb) TO service_role;


--
-- Name: FUNCTION set_updated_at(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.set_updated_at() TO service_role;


--
-- Name: FUNCTION sync_user_name_to_shifts(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.sync_user_name_to_shifts() TO service_role;


--
-- Name: TABLE absences; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.absences TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.absences TO anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.absences TO authenticated;


--
-- Name: TABLE admin_audit_log; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.admin_audit_log TO service_role;
GRANT SELECT ON TABLE public.admin_audit_log TO anon;
GRANT SELECT ON TABLE public.admin_audit_log TO authenticated;


--
-- Name: SEQUENCE admin_audit_log_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.admin_audit_log_id_seq TO service_role;


--
-- Name: TABLE app_settings; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.app_settings TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.app_settings TO anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.app_settings TO authenticated;


--
-- Name: TABLE community_poll_options; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.community_poll_options TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.community_poll_options TO anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.community_poll_options TO authenticated;


--
-- Name: TABLE community_poll_votes; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.community_poll_votes TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.community_poll_votes TO anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.community_poll_votes TO authenticated;


--
-- Name: TABLE community_posts; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.community_posts TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.community_posts TO anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.community_posts TO authenticated;


--
-- Name: TABLE community_reactions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.community_reactions TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.community_reactions TO anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.community_reactions TO authenticated;


--
-- Name: TABLE discord_panel_config; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.discord_panel_config TO service_role;


--
-- Name: TABLE discord_role_mappings; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.discord_role_mappings TO service_role;


--
-- Name: TABLE illegal_locations; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.illegal_locations TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.illegal_locations TO anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.illegal_locations TO authenticated;


--
-- Name: TABLE marketplace; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.marketplace TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.marketplace TO anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.marketplace TO authenticated;


--
-- Name: TABLE marketplace_ilegal; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.marketplace_ilegal TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.marketplace_ilegal TO anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.marketplace_ilegal TO authenticated;


--
-- Name: TABLE organization_expiration_notifications; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.organization_expiration_notifications TO service_role;


--
-- Name: TABLE organization_guilds; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.organization_guilds TO service_role;
GRANT SELECT ON TABLE public.organization_guilds TO anon;
GRANT SELECT ON TABLE public.organization_guilds TO authenticated;


--
-- Name: TABLE organization_lifecycle_events; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.organization_lifecycle_events TO service_role;


--
-- Name: TABLE organization_members; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.organization_members TO service_role;
GRANT SELECT ON TABLE public.organization_members TO anon;
GRANT SELECT ON TABLE public.organization_members TO authenticated;


--
-- Name: TABLE organization_role_mappings; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.organization_role_mappings TO service_role;
GRANT SELECT ON TABLE public.organization_role_mappings TO anon;
GRANT SELECT ON TABLE public.organization_role_mappings TO authenticated;


--
-- Name: TABLE organization_settings; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.organization_settings TO service_role;
GRANT SELECT ON TABLE public.organization_settings TO anon;
GRANT SELECT ON TABLE public.organization_settings TO authenticated;


--
-- Name: TABLE organization_vouchers; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.organization_vouchers TO service_role;


--
-- Name: TABLE organizations; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.organizations TO service_role;
GRANT SELECT ON TABLE public.organizations TO anon;
GRANT SELECT ON TABLE public.organizations TO authenticated;


--
-- Name: TABLE panel_notification_reads; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.panel_notification_reads TO service_role;
GRANT SELECT ON TABLE public.panel_notification_reads TO anon;
GRANT SELECT ON TABLE public.panel_notification_reads TO authenticated;


--
-- Name: TABLE panel_notifications; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.panel_notifications TO service_role;
GRANT SELECT ON TABLE public.panel_notifications TO anon;
GRANT SELECT ON TABLE public.panel_notifications TO authenticated;


--
-- Name: SEQUENCE panel_notifications_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.panel_notifications_id_seq TO service_role;


--
-- Name: TABLE panel_sessions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.panel_sessions TO service_role;


--
-- Name: TABLE profiles; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.profiles TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.profiles TO anon;
GRANT SELECT ON TABLE public.profiles TO authenticated;


--
-- Name: TABLE shifts; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.shifts TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.shifts TO anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.shifts TO authenticated;


--
-- Name: TABLE users; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.users TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.users TO anon;
GRANT SELECT ON TABLE public.users TO authenticated;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- PostgreSQL database dump complete
--

\unrestrict 776HATD2Y9xN7owVd12lCs56WRrPvepKgijWovf0fzfd4WkhgQ0Ch2hDeq1IRq2
