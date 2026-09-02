-- Permite administratorului platformei să activeze sau să dezactiveze
-- autentificarea și înregistrarea prin email/parolă.

CREATE TABLE IF NOT EXISTS public.platform_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.platform_settings FROM PUBLIC, anon, authenticated;

INSERT INTO public.platform_settings (key, value)
VALUES ('email_password_auth', '{"enabled": true}'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_public_auth_settings()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'email_password_enabled',
    COALESCE((value->>'enabled')::boolean, true)
  )
  FROM public.platform_settings
  WHERE key = 'email_password_auth'
  UNION ALL
  SELECT '{"email_password_enabled": true}'::jsonb
  WHERE NOT EXISTS (
    SELECT 1 FROM public.platform_settings WHERE key = 'email_password_auth'
  )
  LIMIT 1;
$$;

ALTER FUNCTION public.get_public_auth_settings() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_public_auth_settings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_auth_settings() TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.email_password_auth_is_enabled()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT (value->>'enabled')::boolean
     FROM public.platform_settings
     WHERE key = 'email_password_auth'),
    true
  );
$$;

ALTER FUNCTION public.email_password_auth_is_enabled() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.email_password_auth_is_enabled() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.email_password_auth_is_enabled() TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.prevent_disabled_email_password_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- OAuth users (Discord) trebuie să rămână funcționali indiferent de setare.
  IF COALESCE(new.raw_app_meta_data->>'provider', 'email') = 'email'
     AND NOT public.email_password_auth_is_enabled() THEN
    RAISE EXCEPTION 'EMAIL_PASSWORD_AUTH_DISABLED';
  END IF;
  RETURN new;
END;
$$;

ALTER FUNCTION public.prevent_disabled_email_password_signup() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.prevent_disabled_email_password_signup() FROM PUBLIC;

DROP TRIGGER IF EXISTS prevent_disabled_email_password_signup ON auth.users;
CREATE TRIGGER prevent_disabled_email_password_signup
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_disabled_email_password_signup();
