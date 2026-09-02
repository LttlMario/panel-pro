-- Setările Fast Connect folosesc deja profilul public.users.
-- Această migrare face suportul pentru avatar explicit și indexează căutarea după Discord ID.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS avatar_url text;

CREATE INDEX IF NOT EXISTS users_discord_id_idx
  ON public.users (discord_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_avatar_url_length'
      AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_avatar_url_length
      CHECK (avatar_url IS NULL OR char_length(avatar_url) <= 500);
  END IF;
END $$;
