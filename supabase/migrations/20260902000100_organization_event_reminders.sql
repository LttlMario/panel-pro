-- Evenimentele organizației rămân în istoric pentru verificări și dovezi.
-- Reminderul Discord este idempotent pentru fiecare eveniment și zi.

CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE TABLE IF NOT EXISTS public.organization_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(trim(title)) BETWEEN 2 AND 160),
  event_type text NOT NULL DEFAULT 'other',
  event_date date NOT NULL,
  details text NOT NULL DEFAULT '' CHECK (char_length(details) <= 5000),
  evidence_url text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
  created_by_discord_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);

ALTER TABLE public.organization_events
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS event_type text NOT NULL DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS event_date date,
  ADD COLUMN IF NOT EXISTS details text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS evidence_url text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS created_by_discord_id text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE INDEX IF NOT EXISTS organization_events_history_idx
  ON public.organization_events (organization_id, event_date DESC, created_at DESC);

CREATE TABLE IF NOT EXISTS public.organization_event_reminder_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.organization_events(id) ON DELETE CASCADE,
  reminder_date date NOT NULL,
  days_remaining integer NOT NULL CHECK (days_remaining BETWEEN 0 AND 14),
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'sent', 'failed')),
  error text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, reminder_date)
);

CREATE INDEX IF NOT EXISTS organization_event_reminder_runs_org_idx
  ON public.organization_event_reminder_runs (organization_id, reminder_date DESC);

ALTER TABLE public.organization_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_event_reminder_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.organization_events, public.organization_event_reminder_runs FROM anon, authenticated;
GRANT ALL ON TABLE public.organization_events, public.organization_event_reminder_runs TO service_role;

SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'invoke-organization-event-reminders';

SELECT cron.schedule(
  'invoke-organization-event-reminders',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/send-organization-event-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'publishable_key'),
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
