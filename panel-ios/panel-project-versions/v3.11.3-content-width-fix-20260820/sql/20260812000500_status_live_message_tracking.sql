-- Păstrează mesajul Discord Status Live pentru actualizări ulterioare.
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS live_status_message_id text,
  ADD COLUMN IF NOT EXISTS live_status_last_update timestamptz;
