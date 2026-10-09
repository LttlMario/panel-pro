CREATE TABLE IF NOT EXISTS public.community_post_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_discord_id text NOT NULL,
  display_name text NOT NULL DEFAULT '',
  confirmed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_discord_id)
);

CREATE INDEX IF NOT EXISTS community_post_reads_post_idx
  ON public.community_post_reads (organization_id, post_id, confirmed_at);

ALTER TABLE public.community_post_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS community_post_reads_select ON public.community_post_reads;
CREATE POLICY community_post_reads_select ON public.community_post_reads
  FOR SELECT TO anon, authenticated
  USING (organization_id = public.current_panel_organization_id());
