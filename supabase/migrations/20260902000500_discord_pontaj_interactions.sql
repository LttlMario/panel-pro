-- Stochează temporar alegerea turei pentru butoanele Discord Pontaj.
-- Datele sunt per organizație și utilizator și sunt înlocuite la următoarea alegere.
CREATE TABLE IF NOT EXISTS public.discord_pontaj_selections (
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  discord_id text NOT NULL,
  shift_type text NOT NULL CHECK (shift_type IN ('zi', 'noapte')),
  selected_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, discord_id)
);

CREATE INDEX IF NOT EXISTS discord_pontaj_selections_selected_at_idx
  ON public.discord_pontaj_selections (selected_at DESC);

REVOKE ALL ON TABLE public.discord_pontaj_selections FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.discord_pontaj_selections TO service_role;
