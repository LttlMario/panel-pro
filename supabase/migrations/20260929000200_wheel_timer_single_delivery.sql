-- Previne notificările Discord duplicate pentru același timer expirat.
ALTER TABLE public.wheel_timers
  ADD COLUMN IF NOT EXISTS notification_claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS notification_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notification_next_attempt_at timestamptz;

CREATE INDEX IF NOT EXISTS wheel_timers_notification_due_idx
  ON public.wheel_timers (notification_sent_at, notification_next_attempt_at, notification_claimed_at);
