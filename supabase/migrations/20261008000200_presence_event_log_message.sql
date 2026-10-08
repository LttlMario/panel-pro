alter table public.platform_presence_events
  add column if not exists log_message_id text;
