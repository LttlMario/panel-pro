# Panel v3.11.0 — Administrare platformă și rollback

Data: 20 august 2026  
Proiect Supabase: `vkvsabbbawyiurnaiugo`  
PR GitHub: #132  
Status deploy: funcțiile Supabase și GitHub Pages publicate cu succes

## Ce conține versiunea

- administratori platformă suplimentari, cu adăugare și eliminare din panoul admin;
- ban/unban global, revocare sesiuni și blocarea autentificării;
- buton Ban panel în lista utilizatorilor;
- secțiuni pliabile în pagina de administrare;
- protecție server-side pentru administratorii adăugați;
- sursele web modificate în `source/`;
- toate funcțiile Supabase în `functions/`;
- toate migrațiile SQL în `sql/`.
- verificarea GitHub Actions folosită la publicare în `automation/`.

## Rollback

1. Verifică `manifest.json` și commit-ul indicat.
2. Pentru cod, revino la commit-ul anterior printr-un PR separat.
3. Nu șterge tabelele `platform_administrators` și `platform_user_bans` la rollback; funcțiile vechi le pot ignora fără să afecteze datele existente.
4. Dacă rollback-ul revine la o schemă fără aceste tabele, păstrează migrarea în baza de date până la confirmarea că nu mai există funcții care le interoghează.

## SQL relevant

Migrarea principală pentru această actualizare este:

`sql/20260820000100_platform_admins_and_bans.sql`
