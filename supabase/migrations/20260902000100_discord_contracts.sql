-- Datele contractelor create din Discord. URL-urile sunt cele ale
-- atașamentelor Discord păstrate în mesajul din canalul de log.
alter table public.organization_contracts
  add column if not exists id_card_url text,
  add column if not exists signed_contract_url text,
  add column if not exists discord_message_id text,
  add column if not exists discord_message_ids jsonb not null default '{}'::jsonb;

create index if not exists organization_contracts_discord_message_idx
  on public.organization_contracts (organization_id, discord_message_id)
  where discord_message_id is not null;
