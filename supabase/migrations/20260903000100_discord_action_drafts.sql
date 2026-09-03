-- Schițe temporare pentru selectorul Discord de participanți la Acțiuni.
-- Sunt șterse la finalizare și devin invalide după 15 minute.
CREATE TABLE IF NOT EXISTS public.discord_action_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  guild_id text NOT NULL CHECK (guild_id ~ '^[0-9]{15,22}$'),
  created_by_discord_id text NOT NULL CHECK (created_by_discord_id ~ '^[0-9]{15,22}$'),
  created_by_name text NOT NULL DEFAULT '',
  action_type text NOT NULL CHECK (length(btrim(action_type)) BETWEEN 2 AND 40),
  action_label text NOT NULL CHECK (length(btrim(action_label)) BETWEEN 2 AND 120),
  description text NOT NULL DEFAULT '' CHECK (length(description) <= 4000),
  notes text NOT NULL DEFAULT '' CHECK (length(notes) <= 4000),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS discord_action_drafts_expiry_idx
  ON public.discord_action_drafts (expires_at);

ALTER TABLE public.discord_action_drafts ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.discord_action_drafts TO service_role;
