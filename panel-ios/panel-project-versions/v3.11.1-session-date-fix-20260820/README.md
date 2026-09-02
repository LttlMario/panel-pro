# Panel v3.11.1 — Sesiune și prelungire prin voucher

Data: 20 august 2026  
Proiect Supabase: `vkvsabbbawyiurnaiugo`  
Commit funcțional: `e4651e36d3c8b00dcd51c5de3a35fa96100dab99`

## Ce conține versiunea

- repararea interpretării expirării sesiunii atât pentru date ISO, cât și pentru timestamp numeric;
- corectarea indicatorului „Sesiune” din meniul utilizatorului;
- corectarea verificării sesiunii din pagina „Verificare sistem”;
- adăugarea accesului direct la „Prelungire organizație cu voucher” în meniul utilizatorului;
- cache-busting pentru paginile care folosesc fișierele actualizate;
- backup complet al sursei web, funcțiilor Supabase, migrațiilor SQL, configurației Supabase și automatizărilor de deploy.

## Conținutul backupului

- `source/` — pagini HTML, CSS, JavaScript, imagini, vendor și fișierele proiectului;
- `functions/` — toate funcțiile Supabase și fișierele comune;
- `sql/` — toate migrațiile SQL și scripturile SQL manuale;
- `supabase/` — configurația și scripturile de deploy Supabase;
- `automation/` — workflow-urile GitHub și instrumentele de validare.

## Rollback

1. Verifică `manifest.json` și commit-ul funcțional indicat.
2. Pentru cod, revino printr-un PR separat la commit-ul anterior sau la commit-ul din manifest.
3. Nu șterge migrațiile SQL existente; această actualizare nu necesită o migrare nouă.
4. Dacă este necesară restaurarea completă, folosește folderele `source/`, `functions/` și `sql/` împreună.
