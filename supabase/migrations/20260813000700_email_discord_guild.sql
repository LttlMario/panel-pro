-- Serverul Discord ales la conectarea unui cont email.
-- Rolurile nu sunt salvate ca acces permanent: ele sunt reverificate live prin bot.

ALTER TABLE public.user_accounts
  ADD COLUMN IF NOT EXISTS discord_guild_id text;

CREATE INDEX IF NOT EXISTS user_accounts_discord_guild_id_idx
  ON public.user_accounts (discord_guild_id);

GRANT SELECT ON TABLE public.user_accounts TO authenticated;
