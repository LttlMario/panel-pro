-- Tipul evenimentului este folosit în istoric și în embedurile Discord.
ALTER TABLE public.organization_events
  ADD COLUMN IF NOT EXISTS event_type text NOT NULL DEFAULT 'other';
