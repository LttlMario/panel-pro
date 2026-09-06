# Module Panel Pro și pagini administrative

## Domeniu

Constructorul din `administrare-module.html`, asistentul din `asistent.html` și funcțiile `manage-platform-pages`, `manage-panel-modules` și `sync-discord-commands` aparțin exclusiv proiectului Panel Pro și botului Panel Pro. Nu modifică botul Discovery, `bot.panel-pro.ro` sau baza lor de date.

Accesul la constructor, șabloane, publicații, sincronizarea slash și creatorul de pagini este rezervat administratorului global. Ownerul organizației nu vede și nu poate apela aceste funcții; el configurează doar setările obișnuite ale organizației și canalele standard.

## Fluxul unui modul

1. Administratorul global creează un șablon `custom_*`.
2. Adaugă vizual butoanele și câmpurile modalului, apoi configurează cooldown-ul și limita de cereri.
3. Salvează o publicație draft pentru organizație, server și destinație.
4. Publicarea trimite embedul în canalul embed. Rezultatele acțiunilor sunt trimise în canalul de rezultate configurat.
5. `repair` actualizează mesajul existent sau îl recreează dacă a fost șters/creat de alt bot.
6. Opțional, administratorul sincronizează comenzile slash pentru serverul ales.

Rolurile „poate folosi” și „poate aproba / respinge” se aleg în zona publicației, după selectarea organizației și a serverului. Sunt salvate per publicație, deoarece ID-urile rolurilor diferă între servere.

## SQL și publicare

Migrarea `20260906000300_panel_pro_custom_module_runtime.sql` trebuie aplicată în Supabase Panel Pro înainte de testarea publicațiilor, submissions, aprobărilor, rapoartelor și limitelor.

După aplicarea migrării, funcțiile din `supabase/deploy-functions.ps1` trebuie publicate în proiectul Panel Pro. Nu se publică nimic în Discovery.

## Pagini custom

Asistentul creează pagini JSON sigure, fără HTML arbitrar. Administratorul alege ruta, titlul, iconița, zona sidebarului și ordinea. Pagina este randată de `custom-page.html`, iar intrarea este adăugată automat în sidebar la următoarea încărcare.

## Acțiuni disponibile

`open_form`, `save_submission`, `send_log`, `approve`, `reject`, `report`, `update_message` și `notify_submitter`. Butoanele de aprobare/respingere afișează mai întâi cererile în așteptare, apoi aplică decizia pe cererea aleasă. Modalurile acceptă text scurt, text lung și URL. Atașamentele Discord nu sunt acceptate direct în modal; se folosește un URL valid.

## Ce intră în commit și publicare

Commitul trebuie să includă paginile `administrare-module.html` și `custom-page.html`, fișierele `js/administrare-module.js`, `js/asistent-page-builder.js` și `js/custom-page.js`, actualizările de sidebar/permisiuni, cele trei funcții Edge și migrarea `20260906000300_panel_pro_custom_module_runtime.sql`. Scriptul `supabase/deploy-functions.ps1` include deja funcțiile noi.

Ordinea de activare este: aplică migrarea SQL în proiectul Supabase Panel Pro, publică funcțiile Edge din script, verifică secretul `DISCORD_BOT_TOKEN`, apoi fă publicarea GitHub a frontendului. Discovery și `bot.panel-pro.ro` nu se ating.

## Verificare locală

`npm run check:panel` verifică paginile și referințele principale. Verificările JavaScript se fac cu `node --check` pentru fișierele noi și modificate. Testul funcțional final trebuie să acopere: creare modul, publicare embed, formular, trimitere rezultat în canalul configurat, aprobare/respingere, raport, reparare mesaj și sincronizare slash.
