-- Delegated platform administrators are managed by the platform owner.
-- The immutable owner list remains in the PLATFORM_OWNER_DISCORD_IDS secret.
BEGIN;

CREATE TABLE IF NOT EXISTS public.platform_administrators (
  discord_id text PRIMARY KEY,
  display_name text,
  active boolean NOT NULL DEFAULT true,
  created_by_discord_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  CONSTRAINT platform_administrators_discord_id_format
    CHECK (discord_id ~ '^[0-9]{15,22}$')
);

CREATE INDEX IF NOT EXISTS platform_administrators_active_idx
  ON public.platform_administrators (active, revoked_at);

ALTER TABLE public.platform_administrators ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.platform_administrators FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.platform_administrators TO service_role;

COMMIT;
