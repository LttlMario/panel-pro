CREATE TABLE IF NOT EXISTS public.wheel_timers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  discord_id text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  completes_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  completed_at timestamptz,
  notification_sent_at timestamptz,
  notification_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS wheel_timers_one_active_per_user_idx
  ON public.wheel_timers (organization_id, discord_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS wheel_timers_due_idx
  ON public.wheel_timers (status, completes_at);

ALTER TABLE public.wheel_timers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.wheel_timers FROM anon, authenticated;
GRANT ALL ON TABLE public.wheel_timers TO service_role;

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-wheel-timers') THEN
    PERFORM cron.unschedule('process-wheel-timers');
  END IF;
END $$;

SELECT cron.schedule(
  'process-wheel-timers',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/wheel-timer',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'publishable_key'),
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
    ),
    body := jsonb_build_object('action', 'process')
  );
  $$
);
