# Constructorul de pagini Panel Pro

## Flux recomandat

1. Intră în `administrare-module.html` ca administrator global.
2. Alege **Constructor pagini**, nu Constructor Discord.
3. Scrie ce vrei să creezi sau selectează un șablon.
4. Verifică categoria, accesul, layout-ul și tema.
5. Folosește previzualizarea Desktop/Mobil.
6. Reordonează sau duplică blocurile din editorul vizual.
7. Salvează un draft sau apasă **Publică pagina**.

Asistentul reține local ultimele preferințe de categorie, acces, layout și temă. Pentru cereri neclare oferă acțiuni rapide, iar intenții precum creare, publicare, editare, duplicare sau gestionare sunt detectate automat. Poți cere direct o pagină cu formular, galerie, cronologie/timeline sau calculator; blocurile apar atât în previzualizare, cât și în editorul vizual.

În panoul **Permisiuni pe acțiuni** poți folosi preseturi sau identificatori expliciți: `role:ID`, `user:ID` și `org:UUID`. Regulile pot fi separate pentru citire, scriere, editare, aprobare, publicare, arhivare și ștergere și pot avea o dată de expirare.

Pentru verificarea unui draft fără publicare, deschide **Preview privat**, generează tokenul, salvează pagina și copiază linkul. Tokenul este verificat de funcția Supabase și nu schimbă vizibilitatea publică a paginii.

## Ce se întâmplă la publicare

- pagina este salvată cu starea `published`;
- meniul Panel Pro o poate încărca automat;
- `organizatii.html` reîncarcă selectorii de permisiuni fără refresh manual când este deschis în alt tab;
- pagina este acceptată în `page_permissions` la salvarea organizației;
- se păstrează versiunea anterioară și se scrie auditul administratorului;
- pagina poate fi depublicată, arhivată, restaurată sau ștearsă din manager.
- managerul permite filtrare, căutare, sortare, paginare, export/import, duplicare și acțiuni în lot pentru publicare sau arhivare;
- editorul acceptă blocuri de formular, galerie, timeline și calculator, pe lângă carduri, FAQ, statistici, tabele și liste.
- paginile pot fi limitate la audiențe și reguli de citire individuale, iar backend-ul filtrează aceste reguli înainte de livrare.

## Siguranță și compatibilitate

Paginile publice pot fi citite fără sesiune. Paginile pentru utilizatori autentificați necesită sesiune Panel Pro, iar paginile administratorului global nu sunt livrate prin lista publică. Conținutul este curățat server-side înainte de salvare. Constructorul Discord rămâne separat și nu schimbă fluxurile modulelor existente.

Formularele paginilor sunt validate din nou în Supabase la trimitere, inclusiv accesul publicului țintă și calea blocului din grupuri. Cererile sunt salvate în `platform_page_submissions`, pot fi consultate din manager și marcate ca gestionate; limita de trimitere și câmpul honeypot se aplică înainte de inserare.

Pentru modulele Discord, testarea configurației este fără publicare. La publicare, publicația existentă este reutilizată când modulul, organizația, ținta și canalul embed coincid, iar mesajul este editat. Un mesaj nou este creat doar dacă mesajul vechi nu mai există în Discord; schimbarea canalului este raportată separat și nu suprascrie mesajul din canalul anterior.

## Verificare înainte de deploy

```text
node tools/validate-page-studio.mjs
node tools/validate-panel.mjs
node --check js/platform-assistant-workbench.js
node --check js/custom-page.js
git diff --check
```
