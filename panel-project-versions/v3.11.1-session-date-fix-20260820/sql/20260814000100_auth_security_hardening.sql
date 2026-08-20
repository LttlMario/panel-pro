-- Protecții server-side pentru autentificarea conturilor email.
-- Nu stocăm parole și nu expunem snapshot-uri cu date de producție.

CREATE TABLE IF NOT EXISTS public.username_login_attempts (
  attempt_key text PRIMARY KEY,
  attempt_count integer NOT NULL DEFAULT 0,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  blocked_until timestamptz,
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.username_login_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.username_login_attempts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.username_login_attempts TO service_role;

CREATE OR REPLACE FUNCTION public.consume_username_login_attempt(
  p_key text,
  p_limit integer DEFAULT 10,
  p_window_seconds integer DEFAULT 900
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  normalized_key text := encode(extensions.digest(left(coalesce(p_key, ''), 300), 'sha256'), 'hex');
  current_row public.username_login_attempts%ROWTYPE;
  window_expired boolean;
BEGIN
  SELECT * INTO current_row
  FROM public.username_login_attempts
  WHERE attempt_key = normalized_key
  FOR UPDATE;

  window_expired := current_row.attempt_key IS NULL
    OR current_row.window_started_at + make_interval(secs => greatest(p_window_seconds, 60)) <= now();

  IF current_row.attempt_key IS NULL THEN
    INSERT INTO public.username_login_attempts (attempt_key, attempt_count, window_started_at, last_seen_at)
    VALUES (normalized_key, 1, now(), now());
    RETURN true;
  END IF;

  IF window_expired THEN
    UPDATE public.username_login_attempts
    SET attempt_count = 1, window_started_at = now(), blocked_until = NULL, last_seen_at = now()
    WHERE attempt_key = normalized_key;
    RETURN true;
  END IF;

  IF current_row.blocked_until IS NOT NULL AND current_row.blocked_until > now() THEN
    UPDATE public.username_login_attempts SET last_seen_at = now() WHERE attempt_key = normalized_key;
    RETURN false;
  END IF;

  UPDATE public.username_login_attempts
  SET attempt_count = attempt_count + 1,
      blocked_until = CASE
        WHEN attempt_count + 1 >= greatest(p_limit, 1)
        THEN now() + make_interval(secs => greatest(p_window_seconds, 60))
        ELSE blocked_until
      END,
      last_seen_at = now()
  WHERE attempt_key = normalized_key;

  RETURN current_row.attempt_count + 1 < greatest(p_limit, 1);
END;
$$;

ALTER FUNCTION public.consume_username_login_attempt(text, integer, integer) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.consume_username_login_attempt(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_username_login_attempt(text, integer, integer) TO service_role;

-- Termenii sunt confirmați server-side, nu acceptăm o dată furnizată de browser.
CREATE OR REPLACE FUNCTION public.set_user_account_terms_server_side()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.terms_version := '2026-08-13';
  NEW.terms_accepted_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_accounts_terms_server_side ON public.user_accounts;
CREATE TRIGGER user_accounts_terms_server_side
BEFORE INSERT ON public.user_accounts
FOR EACH ROW EXECUTE FUNCTION public.set_user_account_terms_server_side();

-- Păstrează indexul activ și elimină indexul istoric duplicat dacă exista.
DROP INDEX IF EXISTS public.shifts_org_discord_created_at_idx;
CREATE INDEX IF NOT EXISTS shifts_active_org_discord_created_at_idx
  ON public.shifts (organization_id, discord_id, created_at DESC)
  WHERE status IN ('active', 'paused');
