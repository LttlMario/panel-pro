-- Păstrează mesajele Discord ale unei ture pentru ca Start/Pauză/Stop
-- să actualizeze același embed din canalul Log pontaj.
ALTER TABLE public.shifts
  ADD COLUMN IF NOT EXISTS discord_log_message_ids jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.shifts.discord_log_message_ids IS
  'ID-urile mesajelor Discord pentru logul turei, mapate pe target (primary/secondary).';
