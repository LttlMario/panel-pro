-- Accelerează istoricul personal de pontaj, filtrat pe organizație și Discord ID.
-- Indexul este aditiv și nu schimbă datele sau regulile RLS existente.
CREATE INDEX IF NOT EXISTS shifts_organization_discord_created_at_idx
    ON public.shifts (organization_id, discord_id, created_at DESC);
