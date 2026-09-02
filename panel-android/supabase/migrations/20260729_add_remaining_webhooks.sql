alter table public.discord_panel_config
  add column if not exists illegal_locations_webhook_url text,
  add column if not exists admin_actions_webhook_url text;
