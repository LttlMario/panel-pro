-- Destinațiile Discord ale botului. Webhook-urile din webhook_routes rămân
-- intacte și sunt folosite automat ca fallback dacă trimiterea prin bot eșuează.
ALTER TABLE public.organization_settings
  ADD COLUMN IF NOT EXISTS discord_channel_routes jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.organization_settings.discord_channel_routes IS
  'Rute Discord trimise prin bot: route -> primary/secondary -> channel_id. Webhook-urile rămân fallback în webhook_routes.';
