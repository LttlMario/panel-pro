CREATE TABLE IF NOT EXISTS public.platform_administrators (
  discord_id text PRIMARY KEY CHECK (discord_id ~ '^[0-9]{15,22}$'),
  display_name text,
  active boolean NOT NULL DEFAULT true,
  added_by_discord_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.platform_user_bans (
  discord_id text PRIMARY KEY CHECK (discord_id ~ '^[0-9]{15,22}$'),
  reason text NOT NULL DEFAULT 'Blocat de administrator',
  active boolean NOT NULL DEFAULT true,
  banned_by_discord_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS platform_administrators_active_idx
  ON public.platform_administrators (active, created_at DESC);

CREATE INDEX IF NOT EXISTS platform_user_bans_active_idx
  ON public.platform_user_bans (active, created_at DESC);

ALTER TABLE public.platform_administrators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_user_bans ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.platform_administrators FROM anon, authenticated;
REVOKE ALL ON TABLE public.platform_user_bans FROM anon, authenticated;

