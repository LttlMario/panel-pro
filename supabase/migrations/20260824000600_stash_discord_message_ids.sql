-- Păstrează mesajele Discord asociate fiecărui articol, cereri și donații Stash.
-- Cheile obiectului sunt primary/secondary (sau legacy), iar valorile sunt message IDs Discord.

ALTER TABLE public.organization_stash_items
  ADD COLUMN IF NOT EXISTS discord_message_ids jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.organization_stash_requests
  ADD COLUMN IF NOT EXISTS discord_message_ids jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.organization_stash_donations
  ADD COLUMN IF NOT EXISTS discord_message_ids jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.organization_stash_items.discord_message_ids IS 'Mesajele Discord per webhook pentru embedul acestui articol.';
COMMENT ON COLUMN public.organization_stash_requests.discord_message_ids IS 'Mesajele Discord per webhook pentru embedul acestei cereri.';
COMMENT ON COLUMN public.organization_stash_donations.discord_message_ids IS 'Mesajele Discord per webhook pentru embedul acestei donații.';
