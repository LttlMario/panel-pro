-- Elimină accesul privilegiat al view-ului Blackmarket.
-- RLS-ul și permisiunile utilizatorului care interoghează view-ul se aplică normal.

ALTER VIEW public.marketplace_ilegal_feed
SET (security_invoker = true);
