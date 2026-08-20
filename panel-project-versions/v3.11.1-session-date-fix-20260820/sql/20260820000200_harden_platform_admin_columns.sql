ALTER TABLE IF EXISTS public.platform_administrators
  ADD COLUMN IF NOT EXISTS added_by_discord_id text;

ALTER TABLE IF EXISTS public.platform_user_bans
  ADD COLUMN IF NOT EXISTS banned_by_discord_id text;
