-- Notificările de expirare sunt idempotente pentru fiecare organizație,
-- termen de expirare și prag (7, 3 sau 1 zi).
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE TABLE IF NOT EXISTS public.organization_expiration_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  expires_at timestamptz,
  threshold_days integer CHECK (threshold_days IN (7, 3, 1)),
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'sent', 'skipped', 'failed')),
  error text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, expires_at, threshold_days)
);

-- Poate fi rulat și dacă o încercare anterioară a creat deja tabelul incomplet.
ALTER TABLE public.organization_expiration_notifications
  ADD COLUMN IF NOT EXISTS organization_id uuid,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS threshold_days integer,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'processing',
  ADD COLUMN IF NOT EXISTS error text,
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS organization_expiration_notifications_identity_idx
  ON public.organization_expiration_notifications (organization_id, expires_at, threshold_days);

CREATE INDEX IF NOT EXISTS organization_expiration_notifications_org_idx
  ON public.organization_expiration_notifications (organization_id, expires_at DESC);

ALTER TABLE public.organization_expiration_notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.organization_expiration_notifications FROM anon, authenticated;

SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'invoke-organization-expiry-notifications';

SELECT cron.schedule(
  'invoke-organization-expiry-notifications',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/send-organization-expiry-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'publishable_key'),
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
