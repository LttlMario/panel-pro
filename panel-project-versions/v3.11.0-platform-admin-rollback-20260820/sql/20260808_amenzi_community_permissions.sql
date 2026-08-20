-- Amenzi folosesc aceeași infrastructură izolată pe organizație ca Anunțurile.
ALTER TABLE public.community_posts
  DROP CONSTRAINT IF EXISTS community_posts_post_type_check;

ALTER TABLE public.community_posts
  ADD CONSTRAINT community_posts_post_type_check
  CHECK (post_type = ANY (ARRAY['announcement'::text, 'question'::text, 'poll'::text, 'fine'::text]));

ALTER TABLE public.marketplace
  ADD COLUMN IF NOT EXISTS discord_message_ids jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.marketplace_ilegal
  ADD COLUMN IF NOT EXISTS discord_message_ids jsonb NOT NULL DEFAULT '[]'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'community_posts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.community_posts;
  END IF;
END $$;
