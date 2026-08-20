CREATE INDEX IF NOT EXISTS shifts_org_discord_created_at_idx
  ON public.shifts (organization_id, discord_id, created_at DESC);
