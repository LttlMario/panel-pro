-- Rate limiting server-side pentru fluxurile care pot crea organizații.
-- Cheile sunt hash-uite în funcție, astfel încât IP-urile/identificatorii nu sunt stocați în clar.

CREATE TABLE IF NOT EXISTS public.panel_rate_limits (
  rate_key text PRIMARY KEY,
  hit_count integer NOT NULL DEFAULT 0,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  blocked_until timestamptz,
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.panel_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.panel_rate_limits FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.panel_rate_limits TO service_role;

CREATE OR REPLACE FUNCTION public.consume_panel_rate_limit(
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
  current_row public.panel_rate_limits%ROWTYPE;
  window_expired boolean;
  effective_limit integer := greatest(coalesce(p_limit, 10), 1);
  effective_window integer := greatest(coalesce(p_window_seconds, 900), 60);
BEGIN
  SELECT * INTO current_row
  FROM public.panel_rate_limits
  WHERE rate_key = normalized_key
  FOR UPDATE;

  window_expired := current_row.rate_key IS NULL
    OR current_row.window_started_at + make_interval(secs => effective_window) <= now();

  IF current_row.rate_key IS NULL THEN
    INSERT INTO public.panel_rate_limits (rate_key, hit_count, window_started_at, last_seen_at)
    VALUES (normalized_key, 1, now(), now());
    RETURN true;
  END IF;

  IF window_expired THEN
    UPDATE public.panel_rate_limits
    SET hit_count = 1, window_started_at = now(), blocked_until = NULL, last_seen_at = now()
    WHERE rate_key = normalized_key;
    RETURN true;
  END IF;

  IF current_row.blocked_until IS NOT NULL AND current_row.blocked_until > now() THEN
    UPDATE public.panel_rate_limits SET last_seen_at = now() WHERE rate_key = normalized_key;
    RETURN false;
  END IF;

  UPDATE public.panel_rate_limits
  SET hit_count = hit_count + 1,
      blocked_until = CASE
        WHEN hit_count + 1 >= effective_limit
        THEN now() + make_interval(secs => effective_window)
        ELSE blocked_until
      END,
      last_seen_at = now()
  WHERE rate_key = normalized_key;

  RETURN current_row.hit_count + 1 < effective_limit;
END;
$$;

ALTER FUNCTION public.consume_panel_rate_limit(text, integer, integer) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.consume_panel_rate_limit(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_panel_rate_limit(text, integer, integer) TO service_role;

-- Voucherele nu trebuie să poată fi duplicate. Migrarea se oprește intenționat dacă
-- există duplicate reale, pentru a nu șterge automat datele existente.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.organization_vouchers
    GROUP BY code
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'organization_vouchers conține coduri duplicate; curăță-le înainte de aplicarea indexului unic.';
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS organization_vouchers_code_unique_idx
  ON public.organization_vouchers (code);
