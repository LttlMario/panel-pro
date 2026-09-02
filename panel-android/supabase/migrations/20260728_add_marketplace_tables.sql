-- Adaugă marketplace-ul legal și ilegal în baza Supabase actuală.
-- Rulează o singură dată în Supabase > SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.marketplace (
  id uuid primary key default gen_random_uuid(),
  nume text not null,
  display_name text,
  telefon text,
  tip_actiune text not null,
  categorie text,
  produse text,
  pret text,
  imagini_json text,
  imagine_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketplace_ilegal (
  id uuid primary key default gen_random_uuid(),
  nume text not null,
  telefon text,
  tip_actiune text not null,
  categorie text,
  subcategorie text,
  produse text,
  pret text,
  imagini_json text,
  imagine_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Completează tabelele dacă existau deja într-o formă mai veche.
alter table public.marketplace add column if not exists display_name text;
alter table public.marketplace add column if not exists imagini_json text;
alter table public.marketplace add column if not exists imagine_url text;
alter table public.marketplace add column if not exists updated_at timestamptz not null default now();
alter table public.marketplace add column if not exists created_by_discord_id text;
alter table public.marketplace_ilegal add column if not exists subcategorie text;
alter table public.marketplace_ilegal add column if not exists imagini_json text;
alter table public.marketplace_ilegal add column if not exists imagine_url text;
alter table public.marketplace_ilegal add column if not exists updated_at timestamptz not null default now();
alter table public.marketplace_ilegal add column if not exists created_by_discord_id text;

create index if not exists marketplace_created_at_idx on public.marketplace (created_at desc);
create index if not exists marketplace_ilegal_created_at_idx on public.marketplace_ilegal (created_at desc);

alter table public.marketplace enable row level security;
alter table public.marketplace_ilegal enable row level security;
