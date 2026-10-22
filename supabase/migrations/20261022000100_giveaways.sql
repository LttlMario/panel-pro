BEGIN;

CREATE TABLE IF NOT EXISTS public.discord_giveaways (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  guild_id text NOT NULL CHECK (guild_id ~ '^[0-9]{15,22}$'),
  target text NOT NULL DEFAULT 'primary' CHECK (target IN ('primary', 'secondary')),
  channel_id text NOT NULL CHECK (channel_id ~ '^[0-9]{15,22}$'),
  message_id text CHECK (message_id IS NULL OR message_id ~ '^[0-9]{15,22}$'),
  creator_discord_id text NOT NULL CHECK (creator_discord_id ~ '^[0-9]{15,22}$'),
  creator_name text NOT NULL DEFAULT '',
  title text NOT NULL,
  prize text NOT NULL,
  details text NOT NULL DEFAULT '',
  ends_at timestamptz NOT NULL,
  winner_count integer NOT NULL DEFAULT 1 CHECK (winner_count BETWEEN 1 AND 25),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed', 'cancelled')),
  winners jsonb NOT NULL DEFAULT '[]'::jsonb,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.discord_giveaway_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  giveaway_id uuid NOT NULL REFERENCES public.discord_giveaways(id) ON DELETE CASCADE,
  discord_id text NOT NULL CHECK (discord_id ~ '^[0-9]{15,22}$'),
  display_name text NOT NULL DEFAULT '',
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (giveaway_id, discord_id)
);

CREATE INDEX IF NOT EXISTS discord_giveaways_active_idx
  ON public.discord_giveaways (status, ends_at);
CREATE INDEX IF NOT EXISTS discord_giveaway_participants_idx
  ON public.discord_giveaway_participants (giveaway_id, joined_at);

ALTER TABLE public.discord_giveaways ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discord_giveaway_participants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.discord_giveaways FROM anon, authenticated;
REVOKE ALL ON public.discord_giveaway_participants FROM anon, authenticated;
GRANT ALL ON public.discord_giveaways TO service_role;
GRANT ALL ON public.discord_giveaway_participants TO service_role;

COMMIT;
