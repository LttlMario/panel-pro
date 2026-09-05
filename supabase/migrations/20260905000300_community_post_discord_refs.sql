ALTER TABLE public.community_posts
  ADD COLUMN IF NOT EXISTS discord_message_id text,
  ADD COLUMN IF NOT EXISTS discord_message_ids jsonb NOT NULL DEFAULT '[]'::jsonb;
