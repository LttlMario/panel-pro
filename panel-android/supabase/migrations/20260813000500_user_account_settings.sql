-- Setari persistente pentru conturile email.
-- Avatarul este actualizat numai prin Edge Function, nu prin UPDATE direct din browser.

ALTER TABLE public.user_accounts
  ADD COLUMN IF NOT EXISTS avatar_url text;

ALTER TABLE public.user_accounts
  DROP CONSTRAINT IF EXISTS user_accounts_avatar_url_length;

ALTER TABLE public.user_accounts
  ADD CONSTRAINT user_accounts_avatar_url_length
  CHECK (avatar_url IS NULL OR char_length(avatar_url) <= 500);

GRANT SELECT ON TABLE public.user_accounts TO authenticated;
