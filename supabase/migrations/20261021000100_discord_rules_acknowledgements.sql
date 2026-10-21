CREATE TABLE IF NOT EXISTS public.discord_rules_acknowledgements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  guild_id text NOT NULL CHECK (guild_id ~ '^[0-9]{15,22}$'),
  discord_user_id text NOT NULL CHECK (discord_user_id ~ '^[0-9]{15,22}$'),
  channel_id text CHECK (channel_id IS NULL OR channel_id ~ '^[0-9]{15,22}$'),
  message_id text CHECK (message_id IS NULL OR message_id ~ '^[0-9]{15,22}$'),
  acknowledged_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, guild_id, discord_user_id)
);

CREATE INDEX IF NOT EXISTS discord_rules_ack_org_guild_idx
  ON public.discord_rules_acknowledgements (organization_id, guild_id, acknowledged_at DESC);

COMMENT ON TABLE public.discord_rules_acknowledgements IS
  'Confirmări Discord că un membru a citit regulamentul organizației.';
