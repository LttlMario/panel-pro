-- Normalizează audiențele istorice ale anunțurilor înainte ca aplicațiile
-- actuale să le filtreze. Valorile vechi rămân compatibile cu aceeași logică:
-- family -> organizație, mechanics -> birouri / angajați.

ALTER TABLE public.community_posts
  ADD COLUMN IF NOT EXISTS audience text;

UPDATE public.community_posts
SET audience = CASE lower(btrim(COALESCE(audience, '')))
  WHEN 'mechanics' THEN 'departments'
  WHEN 'departments' THEN 'departments'
  WHEN 'family' THEN 'organization'
  WHEN 'organization' THEN 'organization'
  ELSE 'organization'
END
WHERE audience IS NULL
   OR lower(btrim(audience)) NOT IN ('organization', 'departments');

ALTER TABLE public.community_posts
  ALTER COLUMN audience SET DEFAULT 'organization',
  ALTER COLUMN audience SET NOT NULL;

DO $$
DECLARE
  constraint_row record;
BEGIN
  FOR constraint_row IN
    SELECT con.conname
    FROM pg_constraint AS con
    WHERE con.conrelid = 'public.community_posts'::regclass
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%audience%'
  LOOP
    EXECUTE format('ALTER TABLE public.community_posts DROP CONSTRAINT %I', constraint_row.conname);
  END LOOP;
END $$;

ALTER TABLE public.community_posts
  ADD CONSTRAINT community_posts_audience_check
  CHECK (audience IN ('organization', 'departments'));
