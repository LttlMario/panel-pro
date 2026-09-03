-- Discord Premium: acces pe server, separat de organizațiile administrate prin web.
-- Organizațiile existente rămân în modul web; doar cele marcate discord_only
-- sunt verificate prin entitlements Discord și folosesc interacțiunile botului.

BEGIN;

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS access_mode text NOT NULL DEFAULT 'web'
    CHECK (access_mode IN ('web', 'discord_only'));

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS discord_premium_guild_id text;

CREATE UNIQUE INDEX IF NOT EXISTS organizations_discord_premium_guild_uidx
  ON public.organizations (discord_premium_guild_id)
  WHERE access_mode = 'discord_only' AND discord_premium_guild_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.discord_guild_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id text NOT NULL CHECK (guild_id ~ '^[0-9]{15,22}$'),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  sku_id text NOT NULL CHECK (sku_id ~ '^[0-9]{15,22}$'),
  entitlement_id text UNIQUE CHECK (entitlement_id IS NULL OR entitlement_id ~ '^[0-9]{15,22}$'),
  purchaser_user_id text CHECK (purchaser_user_id IS NULL OR purchaser_user_id ~ '^[0-9]{15,22}$'),
  owner_type smallint NOT NULL DEFAULT 1 CHECK (owner_type IN (1, 2)),
  active boolean NOT NULL DEFAULT true,
  starts_at timestamptz,
  ends_at timestamptz,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  raw_entitlement jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS discord_guild_entitlements_active_guild_uidx
  ON public.discord_guild_entitlements (guild_id)
  WHERE active = true;

CREATE INDEX IF NOT EXISTS discord_guild_entitlements_guild_idx
  ON public.discord_guild_entitlements (guild_id, active, ends_at);

CREATE INDEX IF NOT EXISTS discord_guild_entitlements_organization_idx
  ON public.discord_guild_entitlements (organization_id, active);

ALTER TABLE public.discord_guild_entitlements ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.discord_guild_entitlements FROM anon, authenticated;
GRANT ALL ON public.discord_guild_entitlements TO service_role;

COMMIT;
