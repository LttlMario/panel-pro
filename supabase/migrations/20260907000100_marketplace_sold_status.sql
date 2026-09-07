ALTER TABLE public.marketplace
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS sold_at timestamptz,
  ADD COLUMN IF NOT EXISTS sold_by_discord_id text;

ALTER TABLE public.marketplace_ilegal
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS sold_at timestamptz,
  ADD COLUMN IF NOT EXISTS sold_by_discord_id text;

ALTER TABLE public.marketplace
  DROP CONSTRAINT IF EXISTS marketplace_status_check;
ALTER TABLE public.marketplace
  ADD CONSTRAINT marketplace_status_check CHECK (status IN ('active', 'sold'));
ALTER TABLE public.marketplace_ilegal
  DROP CONSTRAINT IF EXISTS marketplace_ilegal_status_check;
ALTER TABLE public.marketplace_ilegal
  ADD CONSTRAINT marketplace_ilegal_status_check CHECK (status IN ('active', 'sold'));

CREATE OR REPLACE VIEW public.marketplace_feed
WITH (security_invoker = true)
AS
SELECT m.id, m.nume, m.display_name, m.telefon, m.tip_actiune, m.categorie, m.produse, m.pret,
       m.imagini_json, m.imagine_url, m.created_at, m.updated_at, m.created_by_discord_id,
       m.organization_id, o.name AS organization_name, m.status, m.sold_at, m.sold_by_discord_id
FROM public.marketplace m
LEFT JOIN public.organizations o ON o.id = m.organization_id
WHERE public.current_panel_permission_level() >= 1;

CREATE OR REPLACE VIEW public.marketplace_ilegal_feed
WITH (security_invoker = true)
AS
SELECT m.id, m.nume, m.telefon, m.tip_actiune, m.categorie, m.subcategorie, m.produse, m.pret,
       m.imagini_json, m.imagine_url, m.created_at, m.updated_at, m.created_by_discord_id,
       m.organization_id, o.name AS organization_name, o.illegal_name AS organization_illegal_name,
       m.status, m.sold_at, m.sold_by_discord_id
FROM public.marketplace_ilegal m
LEFT JOIN public.organizations o ON o.id = m.organization_id
WHERE m.organization_id IS NULL OR m.organization_id = public.current_panel_organization_id();
