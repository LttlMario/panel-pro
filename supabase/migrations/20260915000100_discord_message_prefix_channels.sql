-- Canalele Discord în care botul prefixează mesajele cu numele autorului.
-- Lista este configurată separat de rutele de publicare ale Panel Pro.
ALTER TABLE public.organization_settings
  ADD COLUMN IF NOT EXISTS discord_message_prefix_channels jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.organization_settings.discord_message_prefix_channels IS
  'Canale monitorizate de bot pentru prefixarea mesajelor: [{guild_id,channel_id,channel_name,guild_name,enabled}]';
