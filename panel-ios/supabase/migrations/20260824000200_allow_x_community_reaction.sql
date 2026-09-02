-- Reacția ❌ este folosită în anunțurile comunității și trebuie acceptată
-- de aceeași constrângere ca celelalte reacții disponibile în panel.
ALTER TABLE public.community_reactions
  DROP CONSTRAINT IF EXISTS community_reactions_reaction_check;

ALTER TABLE public.community_reactions
  ADD CONSTRAINT community_reactions_reaction_check
  CHECK (reaction IN ('👍', '❤️', '✅', '🤔', '❌'));
