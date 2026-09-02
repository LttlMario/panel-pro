-- Separă învoirile pentru Organizație de cele pentru Angajați / Birouri.
ALTER TABLE public.absences
  ADD COLUMN IF NOT EXISTS request_audience text;

ALTER TABLE public.absences
  DROP CONSTRAINT IF EXISTS absences_request_audience_check;

ALTER TABLE public.absences
  ADD CONSTRAINT absences_request_audience_check
  CHECK (request_audience IS NULL OR request_audience IN ('organization', 'departments'));

CREATE INDEX IF NOT EXISTS absences_organization_audience_discord_created_idx
  ON public.absences (organization_id, request_audience, discord_id, created_at DESC);

COMMENT ON COLUMN public.absences.request_audience IS
  'Categoria învoirii: organization sau departments; NULL păstrează compatibilitatea cu învoirile istorice.';
