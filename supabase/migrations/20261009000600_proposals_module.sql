CREATE TABLE IF NOT EXISTS public.community_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  audience text NOT NULL CHECK (audience IN ('organization', 'departments')),
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  author_discord_id text NOT NULL,
  author_name text NOT NULL DEFAULT '',
  proposal_status text NOT NULL DEFAULT 'new' CHECK (proposal_status IN ('new', 'review', 'accepted', 'rejected')),
  proposal_decision_note text NOT NULL DEFAULT '',
  discord_message_id text,
  discord_message_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS community_proposals_org_audience_idx ON public.community_proposals (organization_id, audience, created_at DESC);

CREATE TABLE IF NOT EXISTS public.community_proposal_votes_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  proposal_id uuid NOT NULL REFERENCES public.community_proposals(id) ON DELETE CASCADE,
  user_discord_id text NOT NULL,
  display_name text NOT NULL DEFAULT '',
  vote text NOT NULL CHECK (vote IN ('support', 'against')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (proposal_id, user_discord_id)
);

CREATE INDEX IF NOT EXISTS community_proposal_votes_v2_idx ON public.community_proposal_votes_v2 (organization_id, proposal_id, vote);

ALTER TABLE public.community_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_proposal_votes_v2 ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.community_proposals, public.community_proposal_votes_v2 TO anon, authenticated;
GRANT ALL ON public.community_proposals, public.community_proposal_votes_v2 TO service_role;

DROP POLICY IF EXISTS community_proposals_select ON public.community_proposals;
CREATE POLICY community_proposals_select ON public.community_proposals FOR SELECT TO anon, authenticated USING (organization_id = public.current_panel_organization_id());
DROP POLICY IF EXISTS community_proposal_votes_v2_select ON public.community_proposal_votes_v2;
CREATE POLICY community_proposal_votes_v2_select ON public.community_proposal_votes_v2 FOR SELECT TO anon, authenticated USING (organization_id = public.current_panel_organization_id());

-- Copiază propunerile vechi create în community_posts înainte de separarea modulului.
INSERT INTO public.community_proposals (id, organization_id, audience, title, content, author_discord_id, author_name, proposal_status, proposal_decision_note, discord_message_id, discord_message_ids, created_at, updated_at)
SELECT id, organization_id, audience, title, content, author_discord_id, author_name, COALESCE(proposal_status, 'new'), COALESCE(proposal_decision_note, ''), discord_message_id, COALESCE(discord_message_ids, '[]'::jsonb), created_at, updated_at
FROM public.community_posts
WHERE post_type = 'proposal'
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.community_posts
  DROP CONSTRAINT IF EXISTS community_posts_post_type_check;

ALTER TABLE public.community_posts
  ADD CONSTRAINT community_posts_post_type_check
  CHECK (post_type IN ('announcement', 'question', 'poll', 'fine', 'proposal'));

CREATE TABLE IF NOT EXISTS public.community_proposal_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_discord_id text NOT NULL,
  display_name text NOT NULL DEFAULT '',
  vote text NOT NULL CHECK (vote IN ('support', 'against')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_discord_id)
);

CREATE INDEX IF NOT EXISTS community_proposal_votes_post_idx
  ON public.community_proposal_votes (organization_id, post_id, vote);

ALTER TABLE public.community_proposal_votes ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.community_proposal_votes TO anon, authenticated;
GRANT ALL ON public.community_proposal_votes TO service_role;

DROP POLICY IF EXISTS community_proposal_votes_select ON public.community_proposal_votes;
CREATE POLICY community_proposal_votes_select ON public.community_proposal_votes
  FOR SELECT TO anon, authenticated
  USING (organization_id = public.current_panel_organization_id());
