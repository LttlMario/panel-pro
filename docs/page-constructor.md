# Constructorul de pagini Panel Pro

## Flux recomandat

1. Intră în `administrare-module.html` ca administrator global.
2. Alege **Constructor pagini**, nu Constructor Discord.
3. Folosește **Creare rapidă** pentru un punct de pornire sau scrie ce vrei să creezi.
4. Dacă repeți tipul de pagină, salvează draftul ca **șablon personalizat**; va apărea ulterior în „Șabloanele mele”.
5. Verifică categoria, accesul, layout-ul și tema.
6. Urmează pașii afișați: descriere, ajustare, verificare și publicare.
7. Folosește previzualizarea Desktop/Mobil.
8. Reordonează sau duplică blocurile din editorul vizual.
9. Salvează un draft sau apasă **Publică pagina**.

Programarea poate fi unică, zilnică, săptămânală sau lunară. Pentru repetări, data publicării este ancora ciclului, iar „Repetare până la” oprește automat ciclurile după termen. Dacă există și „Expiră la”, durata dintre publicare și expirare devine fereastra activă a fiecărui ciclu.

Asistentul reține local ultimele preferințe de categorie, acces, layout și temă. Pentru cereri neclare oferă acțiuni rapide, iar intenții precum creare, publicare, editare, duplicare sau gestionare sunt detectate automat. Poți cere direct o pagină cu formular, galerie, cronologie/timeline sau calculator; blocurile apar atât în previzualizare, cât și în editorul vizual.

Zona **Creare rapidă** include profiluri pentru pagini legale, ilegale sau mixte, precum și tipuri uzuale precum recrutare, anunțuri, dashboard, FAQ, galerie, formular și tutorial. Înainte de salvare sau publicare este afișat un rezumat al verificărilor, inclusiv detectarea rutelor deja folosite.

Constructorul păstrează o zonă de stare compactă pentru draft: indică dacă pagina a fost salvată local și ora ultimei salvări. Butonul **🧪 Audit complet** verifică separat identitatea paginii, conținutul, accesul, categoria, aspectul, programarea, formularele și integritatea structurii.

Asistentul recunoaște și publicarea programată. Dacă cererea spune „publică mai târziu” fără o dată și oră, afișează opțiuni rapide sau cere un moment explicit; expresii precum „mâine la 18:30”, „peste 7 zile la 12:00”, „poimâine la 09:00” și „20.09.2026 la 18:30” sunt transformate automat în programarea draftului.

Preview-ul afișează acum un indicator vizibil cu data și ora publicării programate, astfel încât momentul să poată fi verificat înainte de salvare sau publicare.

În zona de ajustări rapide există și preseturi pentru „Mâine la 18:00”, „Peste 7 zile la 12:00” și eliminarea programării, fără să fie necesară deschiderea setărilor avansate.

Recuperarea unui backup afișează înainte de înlocuire titlul, ruta și numărul de blocuri, iar confirmarea este cerută doar când există deja un draft activ.

Într-un draft existent, asistentul acceptă și comenzi de programare precum „programează pagina mâine la 18:00”, „publică pe 20.09.2026 la 18:30” sau „elimină programarea”; schimbarea se reflectă imediat în preview și în salvarea locală.

La publicarea unei pagini programate, constructorul cere confirmarea datei și orei exacte înainte să trimită cererea către server.

Indicatorul de stare din constructor arată separat dacă draftul este sincronizat, salvat local, în așteptarea retrimiterii, cu eroare de autosave sau programat pentru un moment viitor.

Dacă ruta este invalidă sau duplicată, confirmarea oferă butonul **🛠️ Repară ruta**, care creează automat o adresă validă și unică pe baza titlului.

În „Aspect vizual al paginii” poți copia stilul unei pagini existente, fără să copiezi blocurile, accesul, categoria sau permisiunile.

Editorul de blocuri afișează progresul `x/40` și blochează adăugarea când limita sigură pe nivel este atinsă; blocurile din grupuri rămân gestionate separat.

Indicatorul listează și utilizarea grupurilor imbricate, de exemplu `1.2: 4/40`, pentru ca structura internă să rămână ușor de verificat.

Când nu există niciun bloc, editorul afișează o explicație și un buton pentru adăugarea primului bloc de conținut.

Filtrul tipurilor de bloc afișează numărul de potriviri și anunță clar când căutarea nu găsește niciun tip.

Rezultatul filtrului are `aria-live`, iar Escape golește căutarea și readuce imediat toate tipurile de bloc.

Editorul memorează local ultimele cinci tipuri de bloc folosite și le afișează într-o zonă „Recente”, pentru adăugare rapidă.

Lista „Recente” include și butonul „Curăță”, care elimină doar preferința locală, nu și blocurile deja adăugate în pagină.

Selectorul de șabloane memorează local ultimele cinci șabloane folosite și le afișează ca butoane „Recente” pentru pornire rapidă.

Zona include și „Curăță”, care elimină doar istoricul local al selecțiilor.

Feedbackul căutării de șabloane este accesibil (`aria-live`), iar Escape golește instantaneu textul căutării.

Enter pe căutarea șabloanelor selectează și încarcă primul rezultat; dacă nu există rezultate, constructorul afișează un mesaj explicit.

Managerul paginilor include filtrul **⏰ Doar programate**, care arată instantaneu numai paginile cu publicare viitoare și se reaplică după reîncărcarea catalogului.

Preferința filtrului programat este memorată local și revine automat când redeschizi managerul.

Dacă filtrul nu găsește pagini, managerul afișează un mesaj dedicat și oferă direct butonul „Creează pagină”.

Din aceeași stare poți apăsa „Arată toate paginile” pentru a reveni instantaneu la catalogul complet.

Backupurile locale pot fi și șterse individual, cu confirmare, din lista de recuperare.

Dacă vrei să eliberezi rapid memoria locală, poți șterge toate backupurile dintr-o singură acțiune; draftul curent rămâne neschimbat.

Fiecare backup poate fi exportat separat ca JSON, pentru arhivare sau transfer pe alt dispozitiv.

Poți exporta și toate backupurile într-un singur fișier `panel-pro-backups.json`.

La importul unei astfel de arhive, constructorul cere numărul backupului dorit și încarcă doar varianta aleasă.

Backupurile pot fi deschise rapid cu **Ctrl+Shift+B**.

Bara de navigare afișează discret câte backupuri locale sunt disponibile și deschide lista la apăsare.

Indicatorul se sincronizează și între taburi deschise ale browserului.

Managerul afișează și un rezumat al filtrelor active, astfel încât rezultatele restrânse să fie ușor de înțeles.

Rezumatul include și „Curăță filtrele”, pentru resetarea tuturor filtrelor dintr-un singur click.

Butonul „↻ Reîmprospătează” reîncarcă manual catalogul fără refresh complet al paginii.

În caz de eroare, mesajul este afișat în status, iar butonul se reactivează automat pentru o nouă încercare.

După o actualizare reușită este afișată și ora ultimei reîmprospătări.

„🔗 Copiază filtrarea” generează un link reutilizabil cu căutarea, starea, categoria, accesul, sortarea, paginarea și filtrul de programare curente. La deschiderea linkului, aceste setări sunt restaurate automat și memorate local pentru următoarea deschidere a managerului. Auto-refresh-ul managerului poate fi oprit sau repornit din butonul „⏱ Auto-refresh”; alegerea este memorată local. Comutarea rapidă se poate face și cu **Ctrl+Shift+T**. Sincronizările automate actualizează și ora ultimei reîmprospătări afișată în manager. Butoanele de refresh, partajare și auto-refresh includ explicații contextuale și scurtăturile aferente. Copierea linkului de filtrare are și scurtătura **Ctrl+Shift+L**. Dacă încărcarea catalogului eșuează, managerul afișează direct „↻ Încearcă din nou”. În timpul reîncercării, butonul se dezactivează pentru a evita cereri duplicate. La un nou eșec, acțiunea de reîncercare este recreată automat și afișează cauza disponibilă. La apariție, butonul primește automat focus pentru navigare rapidă din tastatură. Controalele managerului includ etichete ARIA explicite pentru refresh, partajare, auto-refresh și retry. În timpul încărcării, refresh-ul și retry-ul comunică și starea busy către tehnologiile asistive. Combinațiile de taste sunt declarate și prin aria-keyshortcuts, pentru a fi descoperite de tehnologiile asistive.

În manager, reîmprospătarea poate fi pornită și cu **Ctrl+Shift+R**.

Când nu editezi un câmp, **Escape** curăță rapid toate filtrele managerului.

Pentru navigare rapidă, apasă **Ctrl+K** și caută o comandă precum „Creează pagină”, „Gestionează pagini”, „Audit draft”, „Salvează draft”, „Publică pagina” sau „Deschide preview”. Paleta se închide cu **Esc**, iar Enter execută prima acțiune filtrată.

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
- în editorul de blocuri poți căuta rapid tipul dorit înainte de adăugare; preset-urile și blocurile reutilizabile sunt afișate separat pentru a păstra lista aerisită.
- dublu-click pe un bloc deschide inspectorul de editare; modificările pot fi aplicate sau anulate, iar structura avansată rămâne disponibilă separat.
- butonul **🕘 Istoric local** permite revenirea la una dintre modificările recente, păstrând varianta curentă în lista de refacere.
- șabloanele personale pot fi exportate într-un fișier JSON și importate ulterior în alt browser sau pe alt calculator; importul verifică structura și limitează fișierul la 30 de șabloane și 2 MB.
- setările dependente se afișează progresiv: filtrele de organizații/roluri/utilizatori apar pentru acces autentificat, dispozitivul nu apare pentru administratorul global, iar termenul repetării apare doar când repetarea este activată.
- asistentul înțelege comenzi naturale pentru schimbarea temei, iconiței, descrierii, dispozitivului, aprobării și repetării; poate adăuga, duplica sau șterge blocuri numerotate fără deschiderea editorului manual.
- secțiunea din meniul organizației poate fi aleasă manual din selectorul **Secțiune meniu**, iar alegerea este salvată în draft și folosită la publicare.
- paginile noi pot genera automat ruta din titlu; pentru editarea unei pagini existente opțiunea este oprită implicit, astfel încât linkul public să nu se schimbe accidental.
- asistentul acceptă și înlocuirea în masă a unui text între ghilimele în toate blocurile paginii.
- audiența are preseturi rapide pentru toți utilizatorii, doar organizații, doar roluri sau curățarea tuturor filtrelor.
- inspectorul blocurilor oferă câmpuri simple pentru liste, FAQ, taburi, acordeoane, galerii, timeline, carduri și formulare; JSON-ul rămâne disponibil doar ca opțiune avansată.
- un draft poate fi duplicat direct din zona de confirmare; copia primește automat o rută unică și rămâne în starea draft.
- paginile pot fi limitate la audiențe și reguli de citire individuale, iar backend-ul filtrează aceste reguli înainte de livrare.
- managerul afișează lângă fiecare pagină dacă este programată, expirată sau repetitivă; verificarea „Stare” arată și termenul repetării.
- managerul afișează și un rezumat compact cu totalul paginilor, stările publicat/draft/arhivat și distribuția pe categorii legală, ilegală și mixtă.
- fiecare indicator din rezumat poate fi apăsat pentru filtrarea imediată a listei.
- editorul vizual adaugă etichete ARIA pentru acțiunile blocurilor, iar Enter sau Space deschide inspectorul blocului focalizat.

## Siguranță și compatibilitate

Managerul include filtrare directă după nivelul de acces: public, membri autentificați sau administratori globali.

Butonul „Curăță filtrele” golește căutarea și readuce toate filtrele managerului la valorile implicite dintr-un singur click.

Filtrele managerului sunt memorate local și sunt restaurate când revii la pagina de administrare.

Memorarea include și sortarea aleasă și numărul de pagini afișate pe ecran.

Acțiunile în lot filtrează automat selecțiile rămase pentru pagini care nu mai există în catalog și afișează un mesaj clar dacă nu mai există nimic disponibil.

Confirmarea acțiunilor în lot afișează primele titluri selectate, nu doar numărul de pagini, pentru a reduce riscul unei publicări sau arhivări greșite.

Selecțiile sunt curățate și la fiecare reîncărcare a catalogului, inclusiv după sincronizarea cu alt tab.

După restaurare, catalogul este reafișat imediat cu filtrele recuperate, fără un click suplimentar.

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

Validatorul constructorului include verificări pentru inspectorul blocurilor, import/export de șabloane, preseturi de audiență, ruta automată, paleta de comenzi, filtrarea managerului, istoricul local și setările condiționale. În pasul de confirmare există și auditul complet de accesibilitate, plus repararea automată a problemelor simple: completarea textelor lipsă din blocurile vizuale, a titlurilor/descripțiilor cardurilor și galeriilor, a etichetelor formularelor și a titlului unui bloc hero. Același pas afișează un progres clar al pregătirii paginii, cu rol ARIA de bară de progres, pentru ca administratorul să vadă imediat ce mai lipsește înainte de publicare. Managerul include și acțiuni „Deschide” și „Copiază link” pentru verificarea imediată a fiecărei pagini. Draftul curent poate fi exportat ca JSON și importat ulterior, cu validarea fișierului și confirmarea înlocuirii. În manager, paginile bifate pot fi exportate separat într-un singur fișier JSON. Inspectorul vizual oferă și editare pe linii pentru tabele, indicatori statistici și calculatoare, iar linkurile cu scheme nesigure sunt neutralizate automat. Confirmarea draftului oferă preseturi pentru adăugarea unui formular sau a unei galerii și pentru schimbarea rapidă a categoriei sau accesului. Lista de șabloane include căutare instantanee, șabloane personalizate importate și buton de curățare a căutării, cu număr de rezultate și mesaj pentru căutări fără potriviri. Datele de bază ale unui draft și metadatele SEO pot fi completate automat înainte de publicare. Metadatele de bază actualizează preview-ul live după o scurtă întârziere, pe măsură ce sunt editate. Ordinea în meniul organizației poate fi stabilită direct din constructor, inclusiv prin preseturi „Mai sus”, „Mai jos” și „Implicit”. Confirmarea include și un audit 360° pentru identitate, conținut, accesibilitate, SEO, responsive, audiență, programare și structură, cu export local al raportului JSON. Draftul poate fi și copiat direct în clipboard ca JSON. Exportul și importul draftului sunt disponibile și prin Ctrl+Shift+E și Ctrl+Shift+I, iar comenzile sunt afișate direct în interfață.
### Acces rapid în constructor

Constructorul oferă preseturi pentru acces, categorie, layout și temă, iar preview-ul live afișează rezumatul configurației de acces înainte de publicare.

Setările secundare sunt pliate implicit și se deschid din „Opțiuni avansate”. Profilurile rapide pot porni pagini pentru portal intern, pagină publică, resurse ilegale, onboarding sau evenimente. Preview-ul oferă copierea rutei și deschiderea directă a paginii, iar Ctrl+Alt+P derulează rapid la preview. Dacă sesiunea este offline, draftul este păstrat local, iar o salvare sau publicare cerută în acel moment se reia automat când conexiunea revine.

Starea draftului diferențiază clar salvarea locală de sincronizarea pe server. Modificările externe ale aceleiași pagini generează o avertizare fără a suprascrie draftul local, iar închiderea accidentală a ferestrei este protejată când există modificări nesincronizate. Preview-ul poate fi și tipărit direct.

Zona SEO afișează și contoare live pentru titlu și descriere, cu avertizare vizuală peste recomandările de 60, respectiv 155 de caractere.

Aspectul vizual are preseturi rapide Panel Pro, Soft, Compact și Alertă, care configurează simultan accentul, fontul, spațierea și forma colțurilor.

Salvarea automată a draftului rulează după o scurtă pauză de la ultima modificare și trimite întotdeauna o salvare de tip draft; nu publică pagina fără apăsarea butonului de publicare. În timpul salvării, statusul rămâne vizibil în zona constructorului, iar modul offline continuă să păstreze backupul local.

Autosave-ul rulează silențios: nu golește acțiunile, nu schimbă etapa de editare și nu înlocuiește butonul de publicare. Salvarea manuală și publicarea păstrează mesajele și acțiunile de confirmare obișnuite.

Autosave-ul poate fi oprit sau pornit din butonul vizibil din bara constructorului. Alegerea se păstrează când draftul este recuperat, iar la dezactivare modificările rămân locale până la salvarea manuală.

Preferința autosave este memorată separat de draft și rămâne activă sau oprită după resetarea constructorului și la următoarea deschidere a paginii.

Când ruta este generată din titlu, constructorul verifică paginile existente și alege automat prima variantă disponibilă, de exemplu `pagina.html`, `pagina-2.html` sau `pagina-3.html`. Rutele scrise manual nu sunt modificate automat.

Acțiunile din preview folosesc automat tokenul privat al paginii atunci când există, astfel încât administratorul să poată verifica un draft sau o pagină protejată fără a o face publică.

Dacă autosave-ul primește o eroare de la server, draftul local rămâne intact, eroarea este afișată în bara constructorului și apare butonul „Reîncearcă autosave”. Nu se fac reîncercări infinite în fundal.

Indicatorul „Pregătire pagină” se recalculează după modificări și reflectă imediat câte elemente sunt pregătite pentru publicare.

Actualizarea indicatorului este idempotentă: dacă scorul nu s-a schimbat, DOM-ul nu este rescris, evitând recalculări repetate și păstrând editorul fluid.

Acțiunile rapide ale asistentului, inclusiv „Fă publică”, marchează draftul ca modificat local și intră în același flux de autosave ca editările manuale.

Validatorul verifică și enumerațiile de configurare ale unui draft importat: categorie, acces, layout, temă și dispozitiv. Valorile neacceptate sunt raportate înainte de salvare sau publicare.

Importul în bloc validează fiecare pagină înainte de prima cerere către server: tipul paginii, titlul, ruta, blocurile și setările principale sunt verificate împreună, iar fișierul este respins integral dacă există o pagină invalidă.

Importul unui singur draft folosește aceeași validare completă ca importul în bloc, astfel încât rutele, setările și structura blocurilor să fie verificate uniform.

Importul șabloanelor aplică aceeași validare comună înainte de a scrie în biblioteca locală și respinge importul dacă există șabloane invalide.

Șabloanele deja salvate local sunt reverificate la citire, astfel încât variantele vechi sau corupte să nu fie afișate și exportate.

La citire se elimină și duplicatele cu același identificator, pentru ca importurile repetate să nu aglomereze selectorul.

Importul șabloanelor verifică și versiunea fișierului; formatele necunoscute sunt refuzate înainte de modificarea bibliotecii.

Validatorul importurilor verifică și dispozitivul țintă, intervalul publicare-expirare și valorile permise pentru publicarea recurentă.

Tipurile de bloc din drafturile și șabloanele importate sunt verificate față de biblioteca suportată; blocurile necunoscute sunt raportate înainte de încărcare.

Verificarea tipurilor este recursivă și acoperă și blocurile din interiorul grupurilor.

Validatorul local respectă și limitele backendului pentru numărul de blocuri, adâncimea grupurilor și dimensiunea totală a conținutului importat.

Limita de blocuri se aplică separat fiecărui nivel, inclusiv grupurilor imbricate.

Importurile verifică și datele minime ale blocurilor complexe; de exemplu, un formular fără câmpuri sau o galerie fără elemente este respinsă local.

Linkurile blocurilor și sursele galeriilor sunt verificate la import cu aceleași reguli de compatibilitate folosite la publicare.

Importurile sunt scanate și pentru scheme periculoase precum `javascript:`, `vbscript:` și `data:text/html`, care sunt respinse înainte de previzualizare sau salvare.

Valorile importate pentru aprobare sunt limitate la „în așteptare”, „aprobat” și „respins”, pentru a nu publica accidental o stare necunoscută.

Când cererea inițială este vagă, asistentul afișează alegeri rapide pentru tipul paginii, audiență și categoria legală/ilegală, astfel încât pagina să fie generată cu intenția corectă din primul pas.

O categorie menționată explicit în cerere are prioritate față de preferința salvată anterior; de exemplu, „pagină legală” nu moștenește o selecție ilegală rămasă dintr-o creare precedentă.

Clarificarea inițială include și preseturi vizibile pentru tema Panel Pro, tema Midnight și layout-ul cu două coloane.

Acțiunile auxiliare care modifică draftul — copierea permisiunilor, ordinea în meniu, generarea tokenului de preview, repararea SEO și undo/redo — marchează consistent starea locală și sunt preluate de autosave.

Comenzile conversaționale ale asistentului folosesc aceeași regulă: orice schimbare de titlu, acces, categorie, layout sau bloc marchează draftul local înainte de salvare.

Dacă o pagină aprobată este modificată, statusul aprobării revine la „în așteptare”; aprobarea veche nu este reutilizată pentru conținut nou.

Salvările de draft și publicările trimit notificări între ferestrele deschise ale constructorului. Managerul se reîmprospătează, iar o pagină editată local afișează avertizare înaintea unei eventuale suprascrieri.

La schimbarea între Constructor pagini, Constructor Discord și Gestionare pagini, dacă există modificări locale nesalvate, constructorul cere confirmare înainte de a părăsi zona curentă.

Butonul „Resetare” are aceeași protecție și cere confirmare când ar șterge un draft local nesalvat.

Preferințele de preview — dispozitivul simulat și audiența — sunt memorate și refolosite la următoarea sesiune.

În Gestionare pagini, „Selectează vizibile” selectează doar rezultatele afișate după filtre și confirmă imediat numărul de pagini selectate, ca operațiile în lot să fie ușor de verificat.

Constructorul include și filtrul vizual „Arată doar”: utilizatorul poate afișa numai setările de bază, acces, aspect sau SEO, ori poate reveni la afișarea completă. Alegerea este memorată local pentru următoarea sesiune.

Bara de filtrare este ascunsă împreună cu opțiunile avansate când nu există un draft activ, astfel încât ecranul inițial rămâne curat.

Auditul rapid oferă butonul „Fixează” pentru fiecare verificare nereușită și deschide direct secțiunea relevantă, reducând pașii necesari pentru corectarea draftului.

Navigarea afișează și progresul draftului în procente, pe baza câmpurilor esențiale, a blocurilor și a validării structurii; indicatorul este ascuns când nu există un draft activ.

Procentul se recalculează imediat când se schimbă o opțiune, nu doar după salvare.

Dacă publicarea este blocată de validare, constructorul deschide automat auditul rapid și opțiunile avansate, astfel încât corectarea poate începe imediat.

Salvarea unui șablon verifică draftul și refuză duplicatele cu același conținut, păstrând biblioteca de șabloane curată.

După publicarea reușită, acțiunile includ atât copierea linkului, cât și deschiderea imediată a paginii live într-o filă nouă.

Operațiile în lot afișează progresul curent (`1/n`, `2/n` etc.) și titlul paginii procesate, astfel încât activitatea rămâne clară și la selecții mari.

Indicatorul procentual al draftului este interactiv: clickul deschide auditul complet și opțiunile avansate.

Butoanele „Editează” și „Duplică” din catalog activează explicit modul de creare, sincronizează navigarea și deschid editorul în starea corectă.

Catalogul afișează etichete pentru categoria paginii și nivelul de acces, pentru identificare rapidă fără deschiderea editorului.

Când filtrul nu returnează pagini, catalogul afișează butonul „Creează pagină”, care te duce direct în fluxul de creare.

În Gestionare pagini, butonul „Șterge căutarea” golește doar textul căutării și păstrează celelalte filtre active.

Lângă căutare este afișat contorul paginilor vizibile, inclusiv totalul atunci când filtrele reduc lista.

Căutarea este debounced la 180 ms pentru liste mari, iar filtrele selectate și textul căutării rămân memorate.

Scurtătura `Ctrl+Shift+F` deschide Gestionare pagini și focalizează direct căutarea.

În căutarea catalogului, `Enter` deschide primul rezultat, iar `Esc` golește doar textul căutării.

Scurtătura `Ctrl+Shift+N` pornește imediat un draft nou.

Scurtăturile care schimbă zona sau resetează constructorul cer confirmare când există modificări locale nesalvate.

În Gestionare pagini, `PageUp` și `PageDown` schimbă pagina de rezultate atunci când există paginare.

Scurtăturile folosesc aceleași controale de paginare ca interfața vizuală, astfel încât starea și dezactivarea butoanelor rămân sincronizate.

`Home` și `End` sar direct la prima sau ultima pagină de rezultate.

Navigarea de paginare nu interceptează aceste taste când utilizatorul scrie într-un câmp sau editează conținut.

Dacă `Enter` este apăsat fără rezultate, constructorul afișează explicit căutarea nu a returnat pagini.

Reluarea din localStorage și backup verifică aceeași structură și aceleași scheme sigure ca importul de drafturi; datele corupte sunt refuzate.

Backupurile invalide sunt filtrate înainte de afișarea listei de recuperare, nu doar în momentul apăsării butonului.

La citirea listei, intrările invalide sunt curățate și din stocarea locală pentru a preveni acumularea lor.

Butonul de ștergere a căutării reflectă starea câmpului și rămâne dezactivat când nu există text de eliminat.

Contorul reflectă doar paginile vizibile pe pagina curentă, nu și rezultatele ascunse de paginare, și este anunțat accesibil prin `aria-live`.

Când există filtre active, contorul separă explicit rezultatele filtrate de totalul general al paginilor.
