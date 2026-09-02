ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS tutorial_read boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.users.tutorial_read IS
  'True after the user completes or skips the first-login panel tutorial.';