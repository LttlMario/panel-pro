-- Jurnal pentru retragerile din Stash și actualizarea embedului cu distribuirea recentă.
CREATE TABLE IF NOT EXISTS public.organization_stash_withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  stash_item_id uuid NOT NULL REFERENCES public.organization_stash_items(id) ON DELETE CASCADE,
  quantity numeric(14, 2) NOT NULL CHECK (quantity > 0),
  recipient_discord_id text,
  recipient_name text NOT NULL CHECK (length(btrim(recipient_name)) BETWEEN 2 AND 160),
  note text NOT NULL DEFAULT '' CHECK (length(note) <= 2000),
  withdrawn_by_discord_id text NOT NULL,
  withdrawn_by_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS organization_stash_withdrawals_item_idx
  ON public.organization_stash_withdrawals (organization_id, stash_item_id, created_at DESC);

ALTER TABLE public.organization_stash_withdrawals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS organization_stash_withdrawals_read ON public.organization_stash_withdrawals;
DROP POLICY IF EXISTS organization_stash_withdrawals_write ON public.organization_stash_withdrawals;

CREATE POLICY organization_stash_withdrawals_read ON public.organization_stash_withdrawals
  FOR SELECT TO anon, authenticated
  USING (organization_id = public.current_panel_organization_id()
    AND public.current_panel_has_stash_access('read'));
CREATE POLICY organization_stash_withdrawals_write ON public.organization_stash_withdrawals
  FOR INSERT TO anon, authenticated
  WITH CHECK (organization_id = public.current_panel_organization_id()
    AND public.current_panel_has_stash_access('write'));

GRANT SELECT, INSERT ON public.organization_stash_withdrawals TO anon, authenticated;
GRANT ALL ON public.organization_stash_withdrawals TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'organization_stash_withdrawals'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.organization_stash_withdrawals;
  END IF;
END $$;
