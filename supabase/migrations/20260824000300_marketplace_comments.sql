-- Comentarii comune pentru anunțurile din Marketplace și Black Market.
-- Accesul și operațiunile sunt controlate prin manage-community-posts,
-- folosind sesiunea securizată a panelului și permisiunile paginii.
CREATE TABLE IF NOT EXISTS public.marketplace_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  marketplace_table text NOT NULL CHECK (marketplace_table IN ('marketplace', 'marketplace_ilegal')),
  marketplace_id uuid NOT NULL,
  author_discord_id text NOT NULL,
  author_name text NOT NULL,
  content text NOT NULL CHECK (char_length(trim(content)) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS marketplace_comments_item_idx
  ON public.marketplace_comments (marketplace_table, marketplace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS marketplace_comments_author_idx
  ON public.marketplace_comments (author_discord_id, created_at DESC);

ALTER TABLE public.marketplace_comments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.marketplace_comments FROM anon, authenticated;
GRANT ALL ON TABLE public.marketplace_comments TO service_role;
