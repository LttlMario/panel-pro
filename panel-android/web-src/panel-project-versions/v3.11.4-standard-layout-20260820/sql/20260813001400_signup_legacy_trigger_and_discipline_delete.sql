-- Fix final pentru signup email și ștergerea evidențelor disciplinare.
-- Rulează după migrarea disciplinară 20260813001000.

CREATE TABLE IF NOT EXISTS public.user_accounts (
  auth_user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL,
  discord_id text UNIQUE,
  discord_guild_id text,
  terms_version text NOT NULL DEFAULT '2026-08-13',
  terms_accepted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_accounts_username_length CHECK (char_length(username) BETWEEN 3 AND 32),
  CONSTRAINT user_accounts_username_format CHECK (username ~ '^[A-Za-z0-9][A-Za-z0-9_.-]*$')
);

ALTER TABLE public.user_accounts
  ADD COLUMN IF NOT EXISTS discord_id text,
  ADD COLUMN IF NOT EXISTS discord_guild_id text,
  ADD COLUMN IF NOT EXISTS terms_version text NOT NULL DEFAULT '2026-08-13',
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS user_accounts_username_lower_idx
  ON public.user_accounts (lower(username));

CREATE OR REPLACE FUNCTION public.check_username_available(candidate text)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE normalized text := lower(btrim(coalesce(candidate, '')));
BEGIN
  IF normalized !~ '^[a-z0-9][a-z0-9_.-]{2,31}$' THEN RETURN false; END IF;
  RETURN NOT EXISTS (SELECT 1 FROM public.user_accounts WHERE lower(username) = normalized);
END;
$$;

ALTER FUNCTION public.check_username_available(text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.check_username_available(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_username_available(text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.create_user_account_from_auth()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE base_username text;
BEGIN
  base_username := lower(regexp_replace(
    coalesce(new.raw_user_meta_data->>'username', split_part(coalesce(new.email, ''), '@', 1), 'utilizator'),
    '[^a-zA-Z0-9_.-]', '', 'g'
  ));
  base_username := regexp_replace(base_username, '^[^a-z0-9]+', '', 'i');
  base_username := left(base_username, 24);
  IF char_length(base_username) < 3 THEN base_username := 'utilizator'; END IF;
  IF NOT public.check_username_available(base_username) THEN RAISE EXCEPTION 'USERNAME_TAKEN'; END IF;

  INSERT INTO public.user_accounts (auth_user_id, username, terms_version, terms_accepted_at)
  VALUES (
    new.id,
    base_username,
    coalesce(new.raw_user_meta_data->>'terms_version', '2026-08-13'),
    coalesce(nullif(new.raw_user_meta_data->>'terms_accepted_at', '')::timestamptz, now())
  ) ON CONFLICT (auth_user_id) DO NOTHING;
  RETURN new;
END;
$$;

ALTER FUNCTION public.create_user_account_from_auth() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.create_user_account_from_auth() FROM PUBLIC;

-- Elimină trigger-ele legacy care încearcă să creeze profiles fără organizație.
DO $$
DECLARE trigger_name text;
BEGIN
  FOR trigger_name IN
    SELECT t.tgname
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'auth'
      AND c.relname = 'users'
      AND NOT t.tgisinternal
      AND pg_get_triggerdef(t.oid) ILIKE '%handle_new_user%'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON auth.users', trigger_name);
  END LOOP;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_created_panel_account ON auth.users;
CREATE TRIGGER on_auth_user_created_panel_account
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.create_user_account_from_auth();

ALTER TABLE public.user_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_accounts_self_read ON public.user_accounts;
CREATE POLICY user_accounts_self_read
  ON public.user_accounts FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid());
REVOKE ALL ON TABLE public.user_accounts FROM anon;
GRANT SELECT ON TABLE public.user_accounts TO authenticated;

-- Repară conturile Auth create înainte ca triggerul corect să fie instalat.
DO $$
DECLARE
  auth_row record;
  base_username text;
  candidate text;
BEGIN
  FOR auth_row IN
    SELECT a.id, a.email, a.raw_user_meta_data
    FROM auth.users a
    LEFT JOIN public.user_accounts ua ON ua.auth_user_id = a.id
    WHERE ua.auth_user_id IS NULL
  LOOP
    base_username := lower(regexp_replace(
      coalesce(auth_row.raw_user_meta_data->>'username', split_part(coalesce(auth_row.email, ''), '@', 1), 'utilizator'),
      '[^a-zA-Z0-9_.-]', '', 'g'
    ));
    base_username := regexp_replace(base_username, '^[^a-z0-9]+', '', 'i');
    base_username := left(base_username, 24);
    IF char_length(base_username) < 3 THEN base_username := 'utilizator'; END IF;
    candidate := base_username;
    IF EXISTS (SELECT 1 FROM public.user_accounts WHERE lower(username) = lower(candidate)) THEN
      candidate := left(base_username, 17) || '-' || substr(md5(auth_row.id::text), 1, 6);
    END IF;
    INSERT INTO public.user_accounts (auth_user_id, username, terms_version, terms_accepted_at)
    VALUES (auth_row.id, candidate, coalesce(auth_row.raw_user_meta_data->>'terms_version', '2026-08-13'), coalesce(nullif(auth_row.raw_user_meta_data->>'terms_accepted_at', '')::timestamptz, now()))
    ON CONFLICT (auth_user_id) DO NOTHING;
  END LOOP;
END $$;

DO $$
BEGIN
  IF to_regclass('public.disciplinary_warnings') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS disciplinary_warnings_delete ON public.disciplinary_warnings';
    EXECUTE $policy$
      CREATE POLICY disciplinary_warnings_delete ON public.disciplinary_warnings
      FOR DELETE TO anon, authenticated
      USING (
        organization_id = public.current_panel_organization_id()
        AND (
          issued_by_discord_id = public.current_panel_discord_id()
          OR public.current_panel_has_discipline_access(target_scope, 'write')
          OR public.current_panel_is_platform_admin()
        )
      )
    $policy$;
  END IF;
  IF to_regclass('public.disciplinary_sanctions') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS disciplinary_sanctions_delete ON public.disciplinary_sanctions';
    EXECUTE $policy$
      CREATE POLICY disciplinary_sanctions_delete ON public.disciplinary_sanctions
      FOR DELETE TO anon, authenticated
      USING (
        organization_id = public.current_panel_organization_id()
        AND (
          issued_by_discord_id = public.current_panel_discord_id()
          OR public.current_panel_has_discipline_access(target_scope, 'sanction')
          OR public.current_panel_is_platform_admin()
        )
      )
    $policy$;
  END IF;
END $$;
