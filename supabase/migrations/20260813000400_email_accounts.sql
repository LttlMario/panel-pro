-- Conturi email separate de identitatea Discord.
-- Discord rămâne sursa pentru roluri și acces la organizații.

CREATE TABLE IF NOT EXISTS public.user_accounts (
  auth_user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL,
  discord_id text UNIQUE,
  terms_version text NOT NULL DEFAULT '2026-08-13',
  terms_accepted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_accounts_username_length CHECK (char_length(username) BETWEEN 3 AND 32),
  CONSTRAINT user_accounts_username_format CHECK (username ~ '^[A-Za-z0-9][A-Za-z0-9_.-]*$')
);

CREATE UNIQUE INDEX IF NOT EXISTS user_accounts_username_lower_idx
  ON public.user_accounts (lower(username));

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
  IF EXISTS (SELECT 1 FROM public.user_accounts WHERE lower(username) = lower(base_username)) THEN
    RAISE EXCEPTION 'USERNAME_TAKEN';
  END IF;

  INSERT INTO public.user_accounts (
    auth_user_id,
    username,
    terms_version,
    terms_accepted_at
  ) VALUES (
    new.id,
    base_username,
    coalesce(new.raw_user_meta_data->>'terms_version', '2026-08-13'),
    now()
  )
  ON CONFLICT (auth_user_id) DO NOTHING;

  RETURN new;
END;
$$;

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
REVOKE ALL ON FUNCTION public.create_user_account_from_auth() FROM PUBLIC;
