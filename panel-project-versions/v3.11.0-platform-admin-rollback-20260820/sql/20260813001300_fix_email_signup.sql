-- Repară înregistrarea conturilor email și oferă un mesaj clar pentru username-uri duplicate.
-- Rulează după 20260813000400_email_accounts.sql.

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

ALTER TABLE IF EXISTS public.user_accounts
  ADD COLUMN IF NOT EXISTS auth_user_id uuid,
  ADD COLUMN IF NOT EXISTS username text,
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
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized text := lower(btrim(coalesce(candidate, '')));
BEGIN
  IF normalized !~ '^[a-z0-9][a-z0-9_.-]{2,31}$' THEN
    RETURN false;
  END IF;
  RETURN NOT EXISTS (
    SELECT 1 FROM public.user_accounts
    WHERE lower(username) = normalized
  );
END;
$$;

ALTER FUNCTION public.check_username_available(text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.check_username_available(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_username_available(text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.create_user_account_from_auth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_username text;
BEGIN
  base_username := lower(regexp_replace(
    coalesce(new.raw_user_meta_data->>'username', split_part(coalesce(new.email, ''), '@', 1), 'utilizator'),
    '[^a-zA-Z0-9_.-]', '', 'g'
  ));
  base_username := regexp_replace(base_username, '^[^a-z0-9]+', '', 'i');
  base_username := left(base_username, 24);
  IF char_length(base_username) < 3 THEN base_username := 'utilizator'; END IF;

  IF NOT public.check_username_available(base_username) THEN
    RAISE EXCEPTION 'USERNAME_TAKEN';
  END IF;

  INSERT INTO public.user_accounts (
    auth_user_id, username, terms_version, terms_accepted_at
  ) VALUES (
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

DROP TRIGGER IF EXISTS on_auth_user_created_panel_account ON auth.users;
CREATE TRIGGER on_auth_user_created_panel_account
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.create_user_account_from_auth();
