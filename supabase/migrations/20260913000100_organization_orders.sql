CREATE TABLE IF NOT EXISTS public.organization_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  order_type text NOT NULL CHECK (char_length(order_type) BETWEEN 2 AND 80),
  item_name text NOT NULL CHECK (char_length(item_name) BETWEEN 2 AND 160),
  quantity numeric(12,2) NOT NULL CHECK (quantity > 0 AND quantity <= 100000),
  notes text NOT NULL DEFAULT '' CHECK (char_length(notes) <= 4000),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_by_discord_id text NOT NULL,
  requested_by_name text NOT NULL,
  reviewed_by_discord_id text,
  reviewed_by_name text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS organization_orders_org_status_idx
  ON public.organization_orders (organization_id, status, created_at DESC);

ALTER TABLE public.organization_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organization_orders_service_role ON public.organization_orders;
CREATE POLICY organization_orders_service_role ON public.organization_orders
  FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT ALL ON public.organization_orders TO service_role;
