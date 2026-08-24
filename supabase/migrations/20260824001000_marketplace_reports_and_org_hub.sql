-- Instrumente organizație: raportări de marketplace, păstrate separat per organizație.
CREATE TABLE IF NOT EXISTS public.marketplace_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  marketplace_table text NOT NULL CHECK (marketplace_table IN ('marketplace', 'marketplace_ilegal')),
  marketplace_id uuid NOT NULL,
  reporter_discord_id text NOT NULL,
  reporter_name text NOT NULL,
  reason text NOT NULL CHECK (char_length(trim(reason)) BETWEEN 3 AND 500),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'dismissed')),
  resolved_by_discord_id text,
  resolution_note text NOT NULL DEFAULT '' CHECK (char_length(resolution_note) <= 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX IF NOT EXISTS marketplace_reports_org_status_idx
  ON public.marketplace_reports (organization_id, status, created_at DESC);

ALTER TABLE public.marketplace_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.marketplace_reports FROM anon, authenticated;
GRANT ALL ON TABLE public.marketplace_reports TO service_role;
