BEGIN;

CREATE TABLE IF NOT EXISTS public.discord_bot_installations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id text NOT NULL CHECK (guild_id ~ '^[0-9]{15,22}$'),
  guild_name text,
  authorized_by_discord_id text CHECK (authorized_by_discord_id IS NULL OR authorized_by_discord_id ~ '^[0-9]{15,22}$'),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  integration_type smallint CHECK (integration_type IS NULL OR integration_type IN (0, 1)),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'removed')),
  installed_at timestamptz NOT NULL DEFAULT now(),
  removed_at timestamptz,
  last_event_at timestamptz NOT NULL DEFAULT now(),
  raw_event jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS discord_bot_installations_guild_uidx
  ON public.discord_bot_installations (guild_id);
CREATE INDEX IF NOT EXISTS discord_bot_installations_status_idx
  ON public.discord_bot_installations (status, last_event_at DESC);

ALTER TABLE public.discord_bot_installations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.discord_bot_installations FROM anon, authenticated;
GRANT ALL ON public.discord_bot_installations TO service_role;

COMMIT;
