# Panel v3.11.2 — Reparare layout verificare sistem și loguri

Data: 20 august 2026  
Proiect Supabase: `vkvsabbbawyiurnaiugo`  
Commit funcțional: `99a98d6`

## Ce conține versiunea

- repararea structurii paginii „Verificare sistem”, astfel încât conținutul să rămână în zona principală a panelului;
- repararea structurii paginii „Loguri”, astfel încât statisticile, filtrele și lista de evenimente să fie vizibile lângă sidebar;
- afișare corectă pe desktop și pe ecrane înguste;
- actualizarea versiunii la `v3.11.2` și cache-busting pentru fișierele HTML;
- backup complet al sursei web, funcțiilor Supabase, migrațiilor SQL, configurației Supabase și automatizărilor de deploy.

## Conținutul backupului

- `source/` — pagini HTML, CSS, JavaScript, imagini, vendor și fișierele proiectului;
- `functions/` — toate funcțiile Supabase și fișierele comune;
- `sql/` — toate migrațiile SQL și scripturile SQL manuale;
- `supabase/` — configurația și scripturile de deploy Supabase;
- `automation/` — workflow-urile GitHub și instrumentele de validare.

## Deploy și rollback

Această versiune schimbă doar frontendul și metadata de release; nu necesită migrare SQL sau redeployarea funcțiilor Supabase.

Pentru rollback, folosește commit-ul funcțional indicat și păstrează migrațiile SQL existente. Pentru restaurare completă, folosește împreună folderele `source/`, `functions/` și `sql/`.
