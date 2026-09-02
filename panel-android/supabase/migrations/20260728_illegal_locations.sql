-- Locații ilegale: tabel, acces pentru cheia anon și migrarea celor 15 locații existente.
create table if not exists public.illegal_locations (
  id text primary key,
  map_key text not null check (map_key in ('ls', 'cayo', 'maldive')),
  category text not null,
  title text not null,
  description text not null default '',
  images jsonb not null default '[]'::jsonb,
  x numeric(6,2) not null check (x between 0 and 100),
  y numeric(6,2) not null check (y between 0 and 100),
  notes text not null default '',
  requirements text not null default '',
  rewards text not null default '',
  last_updated date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists illegal_locations_map_category_idx on public.illegal_locations (map_key, category);
alter table public.illegal_locations enable row level security;
grant select, insert, update, delete on public.illegal_locations to anon;
drop policy if exists "anon_full_access" on public.illegal_locations;
create policy "anon_full_access" on public.illegal_locations for all to anon using (true) with check (true);

with seed(data) as (values ($json$[
{"id":"rulota-murrieta","map":"ls","category":"deliveries","title":"Rulotă Livrat (Murrieta Oil Field)","description":"Punct strategic pentru livrări și activități în zona de est / Murrieta Oil Field.","images":["image_6d67a5.jpg"],"x":57.6,"y":85,"notes":"Atenție la patrulele din zonă.","requirements":"Contract activ de livrare","rewards":"Fonduri și XP","lastUpdated":"2026-07-25"},
{"id":"pescuit-braconier","map":"ls","category":"deliveries","title":"Pescuit Braconier","description":"Zonă maritimă dedicată activităților ilegale de pescuit și recoltare.","images":["image_6d6b63.jpg"],"x":55.4,"y":3.5,"notes":"Necesar echipament de scufundare / barcă.","requirements":"Niciuna","rewards":"Pește și bunuri rare","lastUpdated":"2026-07-25"},
{"id":"cumparare-acetona","map":"ls","category":"suppliers","title":"Cumpărare Acetonă (Humane Labs)","description":"Locația de achiziție a acetonei, situată în perimetrul Humane Labs & Research.","images":["image_6d6bdd.jpg"],"x":74.15,"y":37.34,"notes":"Necesar pentru procesarea cocainei.","requirements":"Bani cash / Licență","rewards":"Acetonă x1","lastUpdated":"2026-07-25"},
{"id":"rulota-vespucci","map":"ls","category":"deliveries","title":"Rulotă Livrat (Vespucci / Magellan Ave)","description":"Punct alternativ de livrare detaliat în zona Vespucci / Magellan Avenue.","images":["image_6d6f9f.jpg"],"x":37.3,"y":77,"notes":"Zonă urbană intens circulata.","requirements":"Contract activ de livrare","rewards":"Fonduri și XP","lastUpdated":"2026-07-25"},
{"id":"rulota-desert","map":"ls","category":"deliveries","title":"Rulotă Livrat (Grand Senora Desert)","description":"Punct de livrare în mediul de deșert, aproape de Harmony.","images":["image_6d6ee2.jpg"],"x":52.9,"y":44.4,"notes":"Acces facil cu autovehicule de teren.","requirements":"Contract activ de livrare","rewards":"Fonduri și XP","lastUpdated":"2026-07-25"},
{"id":"rulota-mirror","map":"ls","category":"deliveries","title":"Rulotă Livrat (Mirror Park)","description":"Traseu și locație de livrare amplasată în zona rezidențială Mirror Park.","images":["image_6d6f06.jpg"],"x":57,"y":73.4,"notes":"Evitați atragerile inutile de atenție.","requirements":"Contract activ de livrare","rewards":"Fonduri și XP","lastUpdated":"2026-07-25"},
{"id":"craftare-arme","map":"cayo","category":"weapons","title":"Craftare Arme","description":"Atelier sau stație specializată pentru fabricarea echipamentului armat.","images":["image_6dc1bb.jpg"],"x":56,"y":54.4,"notes":"Necesită componente de armă și licență.","requirements":"Licență de armurier","rewards":"Arme și accesorii","lastUpdated":"2026-07-25"},
{"id":"procesare-marijuana","map":"cayo","category":"drugs","title":"Procesare Canabin","description":"Centrul de rafinare și procesare a producției de marijuana / canabin.","images":["image_6dc259.jpg"],"x":62.2,"y":49.3,"notes":"Asigurați-vă că aveți materie primă suficientă.","requirements":"Frunze de Cannabis","rewards":"Pachete de Marijuana","lastUpdated":"2026-07-25"},
{"id":"procesare-cocaina","map":"cayo","category":"drugs","title":"Procesare Cocaină","description":"Locația dedicată procesării cocainei (necesită acetonă de la Humane Labs).","images":["image_6dc5bb.jpg"],"x":56.7,"y":46.4,"notes":"Combinație chimică strictă.","requirements":"Frunze de Cocă + Acetonă","rewards":"Cocaină pură","lastUpdated":"2026-07-25"},
{"id":"camera-tortura","map":"ls","category":"weapons","title":"Camera de Tortură","description":"Locație ascunsă pentru interogatorii și activități speciale ale facțiunii.","images":["image_6e3e73.jpg"],"x":46.9,"y":85.2,"notes":"Acces restrictiv membrii autorizați.","requirements":"Rang intern în facțiune","rewards":"Control și informații","lastUpdated":"2026-07-25"},
{"id":"spital-sandy","map":"ls","category":"hospitals","title":"Spital Sandy Shores","description":"Unitate medicală principală din zona de nord / Sandy Shores.","images":["image_6e4c80.jpg"],"x":58.8,"y":38.5,"notes":"Disponibil pentru tratament rapid în nord.","requirements":"Niciuna","rewards":"Refacere completă sănătate","lastUpdated":"2026-07-25"},
{"id":"spital-mirror","map":"ls","category":"hospitals","title":"Spital Mirror","description":"Punct medical localizat în zona estică / Murrieta / Mirror.","images":["image_6e4cfa.jpg"],"x":55.4,"y":77.7,"notes":"Asistență medicală de urgență.","requirements":"Niciuna","rewards":"Refacere completă sănătate","lastUpdated":"2026-07-25"},
{"id":"vanzare-seminte","map":"ls","category":"suppliers","title":"Vânzare Semințe Coca & Canabis","description":"Punct de achiziție semințe pentru cultură situat în zona de nord / Procopio Beach.","images":["image_6e5081.jpg"],"x":57.8,"y":16,"notes":"Stoc limitat per oră.","requirements":"Fonduri cash","rewards":"Semințe de calitate superioară","lastUpdated":"2026-07-25"},
{"id":"cayo-spital-1","map":"cayo","category":"hospitals","title":"Spital Cayo","description":"Punctul medical pe insulă pentru recuperare și tratament.","images":["image_6d687a.jpg","image_6dc214.jpg"],"x":54.3,"y":53.9,"notes":"Niciodată singuri pe Cayo!","requirements":"Niciuna","rewards":"Tratament complet","lastUpdated":"2026-07-25"},
{"id":"cayo-spital-alt-1","map":"cayo","category":"hospitals","title":"Spital Cayo (Alternativ 1 & 2)","description":"Perspectivă apropiată și hartă de orientare spre zona medicală de pe insulă.","images":["image_6e489f.jpg","image_6e491e.jpg"],"x":81.2,"y":51.3,"notes":"Intrare secundară.","requirements":"Niciuna","rewards":"Asistență medicală","lastUpdated":"2026-07-25"}
]$json$::jsonb))
insert into public.illegal_locations (id, map_key, category, title, description, images, x, y, notes, requirements, rewards, last_updated)
select id, map, category, title, description, images, x, y, notes, requirements, rewards, "lastUpdated"
from seed, jsonb_to_recordset(seed.data) as x(id text, map text, category text, title text, description text, images jsonb, x numeric, y numeric, notes text, requirements text, rewards text, "lastUpdated" date)
on conflict (id) do update set map_key=excluded.map_key, category=excluded.category, title=excluded.title, description=excluded.description, images=excluded.images, x=excluded.x, y=excluded.y, notes=excluded.notes, requirements=excluded.requirements, rewards=excluded.rewards, last_updated=excluded.last_updated, updated_at=now();
