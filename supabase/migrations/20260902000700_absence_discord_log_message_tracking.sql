-- Păstrează mesajele Discord ale unei învoiri pentru ca editările ulterioare
-- să actualizeze același embed din logul categoriei sale.
ALTER TABLE public.absences
  ADD COLUMN IF NOT EXISTS discord_log_message_ids jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.absences.discord_log_message_ids IS
  'ID-urile mesajelor Discord pentru logul învoirii, mapate pe target (primary/secondary).';
