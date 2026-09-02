-- Feedback public global: sugestii și evaluări vizibile tuturor organizațiilor.
-- Datele sunt citite și modificate exclusiv prin manage-public-feedback, care
-- validează sesiunea Panel Pro înainte de orice operațiune.

CREATE TABLE IF NOT EXISTS public.platform_public_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('suggestion', 'rating')),
  title text NOT NULL DEFAULT '' CHECK (length(btrim(title)) <= 140),
  content text NOT NULL CHECK (length(btrim(content)) BETWEEN 1 AND 4000),
  rating smallint CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
  author_discord_id text NOT NULL CHECK (author_discord_id ~ '^[0-9]{15,22}$'),
  author_name text NOT NULL CHECK (length(btrim(author_name)) BETWEEN 1 AND 120),
  author_organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  author_organization_name text NOT NULL DEFAULT '' CHECK (length(author_organization_name) <= 160),
  discord_message_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT platform_public_posts_rating_kind_check CHECK (
    (kind = 'rating' AND rating IS NOT NULL)
    OR (kind = 'suggestion' AND rating IS NULL)
  )
);

CREATE TABLE IF NOT EXISTS public.platform_public_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.platform_public_posts(id) ON DELETE CASCADE,
  user_discord_id text NOT NULL CHECK (user_discord_id ~ '^[0-9]{15,22}$'),
  reaction text NOT NULL CHECK (reaction IN ('👍', '❤️', '✅', '🤔', '❌')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_discord_id, reaction)
);

CREATE INDEX IF NOT EXISTS platform_public_posts_kind_created_idx
  ON public.platform_public_posts (kind, created_at DESC);
CREATE INDEX IF NOT EXISTS platform_public_reactions_post_idx
  ON public.platform_public_reactions (post_id, reaction);

ALTER TABLE public.platform_public_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_public_reactions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_public_posts FROM anon, authenticated;
REVOKE ALL ON public.platform_public_reactions FROM anon, authenticated;
GRANT ALL ON public.platform_public_posts TO service_role;
GRANT ALL ON public.platform_public_reactions TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'platform_public_posts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.platform_public_posts;
  END IF;
END $$;

-- Cele două webhookuri sunt secrete de platformă, nu setări ale unei organizații.
CREATE OR REPLACE FUNCTION public.get_panel_platform_secret_status()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, vault, pg_temp
AS $$
  WITH allowed(name, label) AS (
    VALUES
      ('project_url', 'URL Supabase'),
      ('publishable_key', 'Cheie publică Supabase'),
      ('cron_secret', 'Secret cron'),
      ('discord_bot_token', 'Token bot Discord'),
      ('platform_owner_discord_ids', 'ID-uri administratori globali'),
      ('status_live_cron_secret', 'Secret cron Status Live'),
      ('discord_pontaj_webhook_url', 'Webhook pontaj de rezervă'),
      ('public_community_webhook_primary', 'Webhook global feedback · Discord principal'),
      ('public_community_webhook_secondary', 'Webhook global feedback · Discord secundar')
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'name', allowed.name,
    'label', allowed.label,
    'configured', secrets.id IS NOT NULL AND secrets.secret IS NOT NULL,
    'updated_at', secrets.updated_at
  ) ORDER BY allowed.name), '[]'::jsonb)
  FROM allowed
  LEFT JOIN vault.secrets AS secrets ON secrets.name = allowed.name;
$$;

CREATE OR REPLACE FUNCTION public.set_panel_platform_secret(secret_name text, secret_value text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, pg_temp
AS $$
DECLARE
  secret_id uuid;
BEGIN
  IF secret_name NOT IN (
    'project_url', 'publishable_key', 'cron_secret', 'discord_bot_token',
    'platform_owner_discord_ids', 'status_live_cron_secret',
    'discord_pontaj_webhook_url', 'public_community_webhook_primary',
    'public_community_webhook_secondary'
  ) THEN
    RAISE EXCEPTION 'Secret nepermis.' USING ERRCODE = '22023';
  END IF;
  IF NULLIF(btrim(secret_value), '') IS NULL THEN
    RAISE EXCEPTION 'Valoarea secretului nu poate fi goală.' USING ERRCODE = '22023';
  END IF;
  IF length(secret_value) > 10000 THEN
    RAISE EXCEPTION 'Valoarea secretului este prea lungă.' USING ERRCODE = '22023';
  END IF;

  SELECT id INTO secret_id FROM vault.secrets WHERE name = secret_name LIMIT 1;
  IF secret_id IS NULL THEN
    PERFORM vault.create_secret(secret_value, secret_name, 'Secret administrat din Panel Pro');
  ELSE
    PERFORM vault.update_secret(secret_id, secret_value, secret_name, 'Secret administrat din Panel Pro');
  END IF;
  RETURN jsonb_build_object('ok', true, 'name', secret_name, 'configured', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_panel_platform_secret_status() TO service_role;
GRANT EXECUTE ON FUNCTION public.set_panel_platform_secret(text, text) TO service_role;
