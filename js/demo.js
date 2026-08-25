const demoScreens = {
  dashboard: {
    title: 'Bun venit în demo', subtitle: 'Explorează modulele din meniul lateral. Fiecare ecran îți arată ce poate face organizația ta în varianta reală.', tag: 'PRIVIRE DE ANSAMBLU',
    guide: ['Cum folosești această simulare', 'Apasă pe un modul din stânga. Vei primi instrucțiuni despre pașii obișnuiți și poți testa doar interacțiuni locale, fără salvare sau trimitere externă.'],
    body: `<div class="screen-head"><div><p class="panel-eyebrow">DASHBOARD ORGANIZAȚIE</p><h2>Activitatea de astăzi</h2><p>O privire rapidă asupra echipei și operațiunilor.</p></div><span class="screen-tag">ACTIVĂ</span></div><div class="screen-grid"><div class="screen-stat"><span>Prezență azi</span><strong>86%</strong><small class="positive">+4% față de ieri</small></div><div class="screen-stat"><span>Cereri procesate</span><strong>24</strong><small class="positive">18 finalizate</small></div><div class="screen-stat"><span>Activitate totală</span><strong>92%</strong><small class="positive">Organizație stabilă</small></div></div><div class="activity-list"><div class="activity-item"><span><b>Alexandru Pop</b><small>A început o tură de zi · acum 12 min</small></span><strong class="activity-value">ACTIV</strong></div><div class="activity-item"><span><b>Maria Ionescu</b><small>A trimis o cerere de învoire · acum 28 min</small></span><strong class="activity-value">NOU</strong></div><div class="activity-item"><span><b>Radu Matei</b><small>A actualizat un contract · acum 45 min</small></span><strong class="activity-value">FINALIZAT</strong></div></div>`
  },
  pontaj: { title:'Pontaj și activitate', subtitle:'Înregistrează turele, pauzele și orele lucrate ale membrilor, apoi urmărește rezultatele în rapoarte.', tag:'FUNCȚIE SIMULATĂ', guide:['Ce faci în Pontaj','Exact ca în panelul real: alegi Tură de Zi sau Tură de Noapte, pornești pontajul, pui pauză și oprești pontajul. În demo cronometrul este local și nu se salvează.'], body:`<div class="screen-head"><div><p class="panel-eyebrow">PONTAJ · TURA CURENTĂ</p><h2>Selectare Tip Tură</h2><p>Alege tura dorită respectând intervalul orar permis.</p></div><span class="screen-tag" id="shift-demo-badge">OPRIT</span></div><div class="shift-type-row"><button class="demo-action secondary shift-type-btn is-selected" data-action="select-shift" data-shift-type="zi">☀️ Tură de Zi</button><button class="demo-action secondary shift-type-btn" data-action="select-shift" data-shift-type="noapte">🌙 Tură de Noapte</button></div><div class="shift-control"><div><span class="panel-eyebrow">TIMP SCURS ÎN TURA CURENTĂ</span><strong id="demo-shift-timer">00:00:00</strong><small id="shift-status">Tură de zi / Oprită</small></div><div class="composer-actions"><button class="demo-action" data-action="start-shift">▶️ Start Pontaj</button><button class="demo-action warning-action" data-action="pause-shift">⏸️ Pauză</button><button class="demo-action danger-action" data-action="stop-shift">⏹️ Stop Pontaj</button></div></div><div class="feature-layout"><div class="feature-box"><h3>Istoric Detaliat Ture</h3><div class="compact-history"><div><b>Astăzi · tură de zi</b><small>09:00 – 13:12 · 4h 12m</small></div><div><b>Ieri · tură de noapte</b><small>20:00 – 23:18 · 3h 18m</small></div></div></div><div class="feature-box"><h3>Total Ore Lucrate pe Zile</h3><p>Luni <b>7h 42m</b><br>Marți <b>6h 18m</b><br>Miercuri <b>4h 12m</b></p></div></div>` },
  cereri: { title:'Cereri / Absențe', subtitle:'Trimite o înștiințare nouă și gestionează istoricul propriilor cereri, exact ca în panelul actual.', tag:'CERERI DEMO', guide:['Ce faci în Cereri / Absențe','Completezi tipul, intervalul, dovada opțională și motivul. În demo poți trimite, edita și șterge local; datele dispar la refresh.'], body:`<div class="screen-head"><div><p class="panel-eyebrow">FORMULAR CERERE</p><h2>Trimite o Înștiințare Nouă</h2><p>Înregistrează o înștiințare pentru Sediu.</p></div><span class="screen-tag">LOCAL</span></div><div class="demo-form-grid"><label>Tip Înștiințare<select id="request-type" class="demo-input"><option>Învoire</option><option>Concediu</option><option>Absență medicală</option><option>Schimb de tură</option><option>Indisponibilitate</option></select></label><label>Început interval<input id="request-start" class="demo-input" type="datetime-local"></label><label>Sfârșit interval<input id="request-end" class="demo-input" type="datetime-local"></label><label>Dovadă / document<input id="request-proof" class="demo-input" type="url" placeholder="https://..."></label><label class="full-field">Motiv / mențiuni<textarea id="request-reason" class="demo-input demo-textarea" placeholder="Explică pe scurt situația..."></textarea></label></div><button class="demo-action" data-action="create-request">📤 Trimite Înștiințarea</button><div class="section-divider"></div><div class="screen-head compact-head"><div><p class="panel-eyebrow">ISTORICUL MEU</p><h2>Înștiințări trimise</h2></div><span class="screen-tag">DATE FICTIVE</span></div><div id="request-list" class="activity-list"><div class="activity-item"><span><b>Învoire · Maria Ionescu</b><small>12–13 august · motiv personal</small></span><strong class="warning">ÎN AȘTEPTARE</strong></div><div class="activity-item"><span><b>Concediu · Elena Stan</b><small>20–22 august · aprobat</small></span><strong class="activity-value">APROBAT</strong></div></div>` },
  contracte: { title:'Contracte și documente', subtitle:'Completează formularul de contract și generează previzualizarea, exact ca în panelul original.', tag:'CONTRACT DEMO', guide:['Ce faci în Contracte','Completezi datele angajatorului și ale angajatului, generezi contractul, îl copiezi sau îl resetezi. Imaginile pot fi lipite cu Ctrl + V, dar trimiterea Discord este doar simulată.'], body:`<div class="screen-head"><div><p class="panel-eyebrow">CONTRACT INDIVIDUAL DE MUNCĂ</p><h2>Generator Contract</h2><p>Formular complet, cu date fictive pentru prezentare.</p></div><span class="screen-tag">FĂRĂ DISCORD</span></div><div class="contract-demo-layout"><div class="demo-form-grid"><label>Companie<input id="contract-company" class="demo-input" value="S.C. Familia Es Todo S.R.L."></label><label>Manager<input id="contract-manager" class="demo-input" placeholder="Introduceți numele managerului"></label><label>Nume și Prenume<input id="contract-employee" class="demo-input" placeholder="Nume și Prenume"></label><label>Cod Numeric Personal<input id="contract-cnp" class="demo-input" placeholder="Cod Numeric Personal"></label><label>Număr de telefon<input id="contract-phone" class="demo-input" placeholder="Număr de telefon"></label><label>Funcție / Poziție<select id="contract-position" class="demo-input"><option>Angajat</option><option>Manager</option><option>HR</option></select></label><label>Salariu<input id="contract-salary" class="demo-input" value="100 lei/lună"></label><label>Program de Lucru<input id="contract-schedule" class="demo-input" value="20:00-23:00"></label><label>Data Începerii<input id="contract-start" class="demo-input" placeholder="DD.MM.YYYY"></label></div><div class="contract-actions"><button class="demo-action" data-action="generate-contract">Generează Contract</button><button class="demo-action" data-action="copy-contract">Copiază Contract</button><button class="demo-action secondary" data-action="reset-contract">Resetează Formularul</button></div></div><div class="contract-preview"><div class="screen-head compact-head"><div><p class="panel-eyebrow">PREVIZUALIZARE CONTRACT</p><h2 id="contract-preview-status">Așteptare generare...</h2></div><span class="screen-tag">DATE DEMO</span></div><pre id="contract-preview">Completați formularul și apăsați „Generează Contract” pentru a vizualiza documentul final.</pre></div><div class="contract-attachments"><div class="section-divider"></div><p class="panel-eyebrow">ATAȘARE IMAGINI · CTRL + V</p><div class="feature-layout"><div><label class="paste-label">Imagine Buletin</label><div id="contract-paste-zone-1" class="paste-zone" tabindex="0"><span class="paste-icon">⌁</span><span>Click &amp; dă Paste (Ctrl + V)</span></div></div><div><label class="paste-label">Imagine Contract</label><div id="contract-paste-zone-2" class="paste-zone" tabindex="0"><span class="paste-icon">⌁</span><span>Click &amp; dă Paste (Ctrl + V)</span></div></div></div><button class="demo-action warning-action" data-action="send-discord">Trimite Raportul pe Discord</button></div>` },
  rapoarte: { title:'Rapoarte și activitate', subtitle:'Folosește filtrele, turele și rapoartele fictive ca în pagina reală, fără acces la date reale.', tag:'ANALIZĂ DEMO', guide:['Ce faci în Rapoarte','Alegi perioada, tipul turei și mecanicul, aplici filtrele, verifici turele active și absențele, apoi poți simula trimiterea raportului. Totul este local.'], body:`<div class="screen-head"><div><p class="panel-eyebrow">RAPOARTE ORGANIZAȚIE</p><h2>Activitatea organizației</h2><p>Date fictive pentru 01–07 august 2026.</p></div><span class="screen-tag">DATE DEMO</span></div><div class="report-tools"><label>Perioadă<select id="report-period" class="demo-input"><option>Această săptămână</option><option>Luna aceasta</option><option>Ultimele 30 zile</option></select></label><label>Tip tură<select id="report-shift-type" class="demo-input"><option>Toate</option><option>Zi</option><option>Noapte</option></select></label><label>Nume sau Discord ID<input id="report-mechanic" class="demo-input" placeholder="Caută membru..."></label><button class="demo-action" data-action="report-filter">Aplică filtre</button><button class="demo-action secondary" data-action="report-reset">Resetează</button></div><div class="shift-control"><div><span class="panel-eyebrow">PONTAJ RAPID</span><strong id="demo-shift-timer">00:00:00</strong><small id="shift-status">Tură de zi / Oprită</small></div><div class="composer-actions"><button class="demo-action" data-action="select-shift" data-shift-type="zi">☀️ Zi</button><button class="demo-action" data-action="start-shift">▶️ Start</button><button class="demo-action warning-action" data-action="pause-shift">⏸️ Pauză</button><button class="demo-action danger-action" data-action="stop-shift">⏹️ Oprește</button></div></div><div class="screen-grid"><div class="screen-stat"><span>Ore lucrate</span><strong>186h</strong><small class="positive">+8%</small></div><div class="screen-stat"><span>Prezență medie</span><strong>86%</strong><small class="positive">+4%</small></div><div class="screen-stat"><span>Cereri aprobate</span><strong>31</strong><small>din 38 cereri</small></div></div><div class="feature-layout"><div class="feature-box"><h3>Ture active</h3><div class="compact-history"><div><b>Alexandru Pop · Zi</b><small>Început 09:00 · ACTIV</small></div><div><b>Maria Ionescu · Noapte</b><small>În pauză · 02:18 lucrate</small></div></div><button class="demo-action secondary" data-action="report-refresh">↻ Actualizează</button></div><div class="feature-box"><h3>Înștiințări / Absențe</h3><div class="compact-history"><div><b>Elena Stan · Concediu</b><small>20–22 august · aprobat</small></div><div><b>Radu Matei · Învoire</b><small>12 august · în așteptare</small></div></div><button class="demo-action secondary" data-action="report-refresh">↻ Actualizează</button></div></div><div class="report-footer-actions"><button class="demo-action" data-action="report-send">Trimite raportul pe Discord</button><small>În demo acțiunea este blocată și nu părăsește pagina.</small></div>` },
  marketplace: { title:'Marketplace', subtitle:'Completează și publică un anunț exact după fluxul Marketplace-ului real, dar numai în memoria demo-ului.', tag:'POSTARE TEMPORARĂ', guide:['Ce faci în Marketplace','Completezi numele, telefonul, tipul acțiunii, categoria, produsele, prețul și imaginile. Poți posta și lipi imagini demo; totul dispare la refresh sau la ieșirea din pagină.'], body:`<div class="screen-head"><div><p class="panel-eyebrow">ADĂUGĂ ANUNȚ NOU</p><h2>Marketplace</h2><p>Același formular ca în panelul normal, cu date fictive.</p></div><span class="screen-tag">FĂRĂ SALVARE</span></div><div class="market-form-grid"><label>Nume<input id="market-name" class="demo-input" placeholder="Nume afișat"></label><label>Nr. tel.<input id="market-phone" class="demo-input" placeholder="Număr de telefon"></label><label>Tip Acțiune<select id="market-action-type" class="demo-input"><option>Vânzare</option><option>Cumpărare</option><option>Servicii</option></select></label><label>Categorie<select id="market-category" class="demo-input"><option>CASE</option><option>VEHICULE</option><option>BUNURI</option></select></label><label class="full-field">Produse<textarea id="market-products" class="demo-input demo-textarea" placeholder="- Produs 1&#10;- Produs 2"></textarea></label><label class="full-field market-services-field">Detalii servicii<textarea id="market-services" class="demo-input demo-textarea" placeholder="Descrie serviciul pe care îl oferi sau îl soliciți..."></textarea></label><label>Preț<input id="market-price" class="demo-input" placeholder="1500 / 10000 / Negociabil"></label><label>Link Direct Imagine<input id="market-image-url" class="demo-input" type="url" placeholder="https://..."></label></div><div id="market-paste-zone" class="paste-zone" tabindex="0"><span class="paste-icon">⌁</span><div><b>📋 Apasă aici, apoi Ctrl + V pentru imagini</b><small>Maxim 5 imagini demo. Nu se încarcă nicăieri.</small></div></div><button class="demo-action" data-action="post-marketplace">Publică Anunțul</button><div class="section-divider"></div><div class="screen-head compact-head"><div><p class="panel-eyebrow">ANUNȚURI ACTIVE</p><h2>Filtrează Anunțurile</h2></div><select id="market-filter" class="demo-input filter-input"><option>TOATE</option><option>CASE</option><option>VEHICULE</option><option>BUNURI</option><option>SERVICII</option></select></div><div class="feature-layout"><div class="feature-box"><h3>Kit reparații avansat</h3><p>Nume: Alexandru Pop<br>Tip: Vânzare · CASE<br>Preț: <b>$12.500</b></p></div><div class="feature-box"><h3>Servicii mecanică</h3><p>Nume: Radu Matei<br>Tip: Servicii<br>Preț: <b>Negociabil</b></p></div></div><div id="marketplace-demo-posts" class="activity-list"></div>` },
  calculator: { title:'Calculator', subtitle:'Folosește calculatorul de crafting cu categoriile și rezultatele din panelul actual, doar cu valori locale fictive.', tag:'CALCUL LOCAL', guide:['Ce faci în Calculator','Alegi categoria, obiectul și cantitatea. Panelul calculează materialele directe și materiile prime. În demo rezultatele se modifică local și nu se salvează.'], body:`<div class="screen-head"><div><p class="panel-eyebrow">CALCULATOR CRAFTING</p><h2>Calculator resurse</h2><p>Caută obiect, material sau rețetă și completează cantitatea.</p></div><span class="screen-tag">FĂRĂ SALVARE</span></div><input id="calc-search" class="demo-input" placeholder="Caută obiect, material sau rețetă..."><div class="calculator-category"><button class="category-header-demo" data-action="toggle-category">🛠️ Masă Crafting <span>⌄</span></button><div class="category-content-demo"><label>Obiect<select id="calc-craft-item" class="demo-input"><option>Set reparații</option><option>Masă de lucru Mecanic</option><option>Limitator de viteză</option><option>Jante Addon 80</option></select></label><label>Variantă<select id="calc-craft-variant" class="demo-input"><option>Standard</option><option>Avansat</option></select></label><label>Cantitate<input id="calc-craft-qty" class="demo-input" type="number" min="0" value="1"></label></div></div><div class="calculator-category"><button class="category-header-demo" data-action="toggle-category">🧵 Croitorie <span>⌄</span></button><div class="category-content-demo"><label>Obiect<select id="calc-tailor-item" class="demo-input"><option>Uniformă simplă</option><option>Vestă tactică</option><option>Geantă utilitară</option></select></label><label>Cantitate<input id="calc-tailor-qty" class="demo-input" type="number" min="0" value="0"></label></div></div><button class="demo-action secondary" data-action="reset-calculator">Resetează Totul</button><div class="section-divider"></div><div class="screen-head compact-head"><div><p class="panel-eyebrow">REZULTATE CALCUL</p><h2>Materii prime necesare</h2></div><span class="screen-tag">LOCAL</span></div><div id="calc-results" class="results-grid-demo"><div><span>Plastic</span><b id="calc-plastic">12</b></div><div><span>Fier</span><b id="calc-iron">8</b></div><div><span>Cauciuc</span><b id="calc-rubber">4</b></div><div><span>Scrap Metal</span><b id="calc-scrap">6</b></div><div><span>Aluminiu</span><b id="calc-aluminium">3</b></div><div><span>Total obiecte</span><b id="calc-total">1</b></div></div><button class="demo-action" data-action="calculate">Calculează local</button>` },
  bucatarie: { title:'Bucătărie', subtitle:'Vezi aceeași galerie și funcție de căutare ca în panelul actual, cu date și imagini de prezentare.', tag:'INFORMAȚII DEMO', guide:['Ce găsești în Bucătărie','În varianta reală, cauți și deschizi elementele din galeria de bucătărie. Demo-ul păstrează doar navigarea, căutarea și previzualizarea imaginilor; nu există producție sau consum.'], body:`<div class="screen-head"><div><p class="panel-eyebrow">GALERIE BUCĂTĂRIE</p><h2>Elemente disponibile</h2><p>29 elemente fictive din galeria modulului.</p></div><span class="screen-tag">DOAR INFORMAȚII</span></div><input id="gallery-search" class="demo-input" placeholder="Caută elemente în bucătărie..."><div class="feature-layout info-six-grid"><div class="feature-box"><span class="info-index">01</span><h3>Rețete</h3><p>Lista rețetelor și detaliile fiecărui preparat.</p></div><div class="feature-box"><span class="info-index">02</span><h3>Ingrediente</h3><p>Ingredientele necesare pentru rețete.</p></div><div class="feature-box"><span class="info-index">03</span><h3>Stocuri</h3><p>Cantități și elemente cu stoc redus.</p></div><div class="feature-box"><span class="info-index">04</span><h3>Producție</h3><p>Informații despre pregătirea produselor.</p></div><div class="feature-box"><span class="info-index">05</span><h3>Porții</h3><p>Porții planificate pentru organizație.</p></div><div class="feature-box"><span class="info-index">06</span><h3>Istoric</h3><p>Activitate anterioară în varianta reală.</p></div></div><div id="asset-gallery" class="asset-gallery"></div>` },
  craft: { title:'Craft Mecanic', subtitle:'Vezi aceeași galerie, căutare și previzualizare ca în modulul actual de mecanic.', tag:'INFORMAȚII DEMO', guide:['Ce găsești în Craft Mecanic','În varianta reală, cauți unelte, piese, jante sau echipamente și deschizi detaliile. Demo-ul păstrează galeria și zoom-ul, fără crafting sau consum de resurse.'], body:`<div class="screen-head"><div><p class="panel-eyebrow">GALERIE CRAFT MECANIC</p><h2>Echipamente și obiecte</h2><p>16 elemente fictive din galeria modulului.</p></div><span class="screen-tag">DOAR INFORMAȚII</span></div><input id="gallery-search" class="demo-input" placeholder="Caută rețetă, unealtă sau jantă..."><div class="feature-layout info-six-grid"><div class="feature-box"><span class="info-index">01</span><h3>Echipamente</h3><p>Uneltele și echipamentele disponibile.</p></div><div class="feature-box"><span class="info-index">02</span><h3>Materiale</h3><p>Materiale necesare pentru operațiuni.</p></div><div class="feature-box"><span class="info-index">03</span><h3>Obiecte</h3><p>Obiectele urmărite în modulul mecanic.</p></div><div class="feature-box"><span class="info-index">04</span><h3>Timp de lucru</h3><p>Durata estimată pentru operațiuni.</p></div><div class="feature-box"><span class="info-index">05</span><h3>Stoc</h3><p>Cantitățile disponibile.</p></div><div class="feature-box"><span class="info-index">06</span><h3>Inventar</h3><p>Istoricul obiectelor în varianta reală.</p></div></div><div id="asset-gallery" class="asset-gallery"></div>` },
  anunturi: { title:'Anunțuri & Sondaje', subtitle:'Vezi fluxul real de creare a unui anunț, întrebări sau sondaje, cu audiență și postări temporare.', tag:'COMUNICARE TEMPORARĂ', guide:['Ce faci în Anunțuri & Sondaje','Alegi tipul, completezi titlul și conținutul, adaugi opțiuni dacă este sondaj, apoi alegi audiența. În demo postarea este vizibilă local și dispare la refresh.'], body:`<div class="screen-head"><div><p class="panel-eyebrow">ANUNȚURI & SONDAJE</p><h2>Comunicare pentru Organizație</h2><p>Postările sunt fictive și nu pleacă pe Discord.</p></div><span class="screen-tag">FĂRĂ DISCORD</span></div><div class="demo-composer"><label>Tip<select id="announcement-type" class="demo-input"><option value="announcement">Anunț</option><option value="question">Întrebare</option><option value="poll">Sondaj</option></select></label><label>Titlu<input id="announcement-title" class="demo-input" maxlength="140" placeholder="Titlul postării"></label><label>Conținut<textarea id="announcement-text" class="demo-input demo-textarea" maxlength="4000" placeholder="Scrie conținutul postării..."></textarea></label><div id="poll-options-demo" class="poll-options-demo" hidden><label>Opțiuni sondaj</label><input id="poll-option-1" class="demo-input" placeholder="Opțiunea 1"><input id="poll-option-2" class="demo-input" placeholder="Opțiunea 2"><button class="demo-action secondary" data-action="add-poll-option">+ Opțiune</button></div><div class="composer-actions"><button class="demo-action" data-action="announcement-audience">Continuă</button></div><div id="audience-demo" class="audience-demo" hidden><small>Unde publici?</small><button class="demo-action secondary" data-action="post-announcement" data-audience="organization">👥 Organizație</button><button class="demo-action secondary" data-action="post-announcement" data-audience="departments">🔧 Birouri / Angajați</button></div><small>Postările demo sunt șterse automat la refresh sau la ieșirea din pagină.</small></div><div class="tabs-demo"><button class="filter-tab is-active" data-action="announcement-filter">Toate</button><button class="filter-tab" data-action="announcement-filter">Organizație</button><button class="filter-tab" data-action="announcement-filter">Birouri / Angajați</button><button class="filter-tab" data-action="announcement-filter">Sondaje</button></div><div class="activity-list"><div class="activity-item"><span><b>Program actualizat pentru weekend</b><small>Anunț · Organizație · acum 2 ore</small></span><strong class="activity-value">ACTIV</strong></div><div class="activity-item"><span><b>Verificarea contractelor</b><small>Anunț · Birouri / Angajați · ieri</small></span><strong class="activity-value">ACTIV</strong></div></div><div id="announcement-demo-posts" class="activity-list"></div>` },
  administrare: { title:'Administrare organizație', subtitle:'Configurează identitatea, membrii, rolurile, paginile și permisiunile organizației.', tag:'ACCES ADMIN', guide:['Ce faci în Administrare','În varianta reală, administratorii configurează organizația și decid ce poate vedea fiecare rol. În demo vezi structura, fără modificări persistente.'], body:`<div class="screen-head"><div><p class="panel-eyebrow">SETĂRI ORGANIZAȚIE</p><h2>Structură și permisiuni</h2><p>Exemplu de configurare pentru o organizație activă.</p></div><span class="screen-tag">ADMIN</span></div><div class="feature-layout"><div class="feature-box"><h3>Identitate</h3><p>Nume: <b>Little Mario Community</b><br>Cod: <b>LMC-248</b><br>Status: <span class="positive">Activă</span></p></div><div class="feature-box"><h3>Roluri configurate</h3><p>Administrator · 2 membri<br>Supervizor · 6 membri<br>Mecanic · 24 membri</p></div><div class="feature-box"><h3>Pagini permise</h3><p>Dashboard · Pontaj · Cereri<br>Resurse · Anunțuri · Rapoarte</p></div><div class="feature-box"><h3>Modificare acces</h3><p>În varianta reală, acest pas cere permisiune de administrator.</p><button class="demo-action secondary" data-action="blocked">Simulează modificarea</button></div></div>` },
};

demoScreens.asistent = { title:'Asistent Panel', subtitle:'Primește îndrumare rapidă despre funcțiile panelului și pașii potriviți pentru fiecare situație.', tag:'ASISTENT DEMO', guide:['Ce faci în Asistent','În varianta reală, pui o întrebare despre panel, iar asistentul îți explică modulul sau îți indică următorul pas. Răspunsurile din demo sunt locale.'], body:`<div class="screen-head"><div><p class="panel-eyebrow">ASISTENT PANEL</p><h2>Cu ce te pot ajuta?</h2><p>Exemple de întrebări pe care le poți pune.</p></div><span class="screen-tag">LOCAL</span></div><div class="activity-list"><div class="activity-item"><span><b>Cum pornesc un pontaj?</b><small>Vezi pașii pentru o tură de zi sau de noapte.</small></span><strong class="activity-value">INFO</strong></div><div class="activity-item"><span><b>Cine poate aproba o cerere?</b><small>Verifică rolurile și permisiunile configurate.</small></span><strong class="activity-value">INFO</strong></div></div><button class="demo-action" data-action="blocked">Simulează o întrebare</button>` };
demoScreens.blackmarket = { title:'Black Market', subtitle:'Completează și publică un anunț exact după fluxul Black Market-ului real, dar fără salvare sau tranzacție.', tag:'POSTARE TEMPORARĂ', guide:['Ce faci în Black Market','Completezi numele, telefonul, tipul acțiunii, categoria, subcategoria, produsele, prețul și imaginile. Postarea rămâne doar în această sesiune demo.'], body:`<div class="screen-head"><div><p class="panel-eyebrow">ADĂUGĂ ANUNȚ ILEGAL</p><h2>Black Market</h2><p>Formularul real, cu opțiuni fictive și fără backend.</p></div><span class="screen-tag">FĂRĂ SALVARE</span></div><div class="market-form-grid"><label>Nume<input id="black-name" class="demo-input" placeholder="Nume afișat"></label><label>Nr. tel.<input id="black-phone" class="demo-input" placeholder="Număr de telefon"></label><label>Tip Acțiune<select id="black-action-type" class="demo-input"><option>Vânzare</option><option>Cumpărare</option><option>Servicii</option></select></label><label>Categorie<select id="black-category" class="demo-input"><option>Arme</option><option>Muniție</option><option>Plicuri coca</option><option>Plicuri ciuperci</option><option>Jointuri</option><option>Piese de armă</option></select></label><label>Element specific<select id="black-subcategory" class="demo-input"><option>Navy Pistol</option><option>Combat MG</option><option>Assault SMG</option><option>9MM PBM</option><option>7.62MM</option></select></label><label>Preț<input id="black-price" class="demo-input" placeholder="1500 / Negociabil"></label><label class="full-field">Produse / Descriere<textarea id="black-products" class="demo-input demo-textarea" placeholder="- Detaliu 1&#10;- Detaliu 2"></textarea></label><label>Link Direct Imagine<input id="black-image-url" class="demo-input" type="url" placeholder="https://..."></label></div><div id="black-paste-zone" class="paste-zone" tabindex="0"><span class="paste-icon">⌁</span><div><b>📋 Ctrl + V pentru imagini demo</b><small>Maxim 5 imagini. Nu se salvează.</small></div></div><button class="demo-action warning-action" data-action="post-blackmarket">Publică Anunțul</button><div class="section-divider"></div><div class="screen-head compact-head"><div><p class="panel-eyebrow">ANUNȚURI ACTIVE</p><h2>Filtrare</h2></div><select id="black-filter" class="demo-input filter-input"><option>TOATE</option><option>Arme</option><option>Muniție</option><option>Plicuri coca</option><option>Jointuri</option></select></div><div class="feature-layout"><div class="feature-box"><h3>Resursă specială A</h3><p>Categorie: Piese de armă<br>Preț: <b>$4.500</b></p></div><div class="feature-box"><h3>Resursă specială B</h3><p>Categorie: Muniție<br>Preț: <b>Negociabil</b></p></div></div><div id="blackmarket-demo-posts" class="activity-list"></div>` };
demoScreens['calculator-ilegal'] = { title:'Calculator ilegal', subtitle:'Folosește categoriile din Calculatorul Ilegal cu materiale și rezultate fictive, fără salvare.', tag:'MODUL AVANSAT', guide:['Ce faci în Calculator ilegal','Alegi categoria — Arme, Piese Armă, Muniție, Plicuri, Weed sau Mushrooms — și introduci cantitățile. Rezultatul este calculat doar local.'], body:`<div class="screen-head"><div><p class="panel-eyebrow">CALCULATOR ILEGAL</p><h2>Materii prime și producție</h2><p>Structura reală a calculatorului, în variantă demonstrativă.</p></div><span class="screen-tag">LOCAL</span></div><div class="calculator-category"><button class="category-header-demo" data-action="toggle-category">🔫 Arme <span>⌄</span></button><div class="category-content-demo"><label>Armă<select id="illegal-weapon" class="demo-input"><option>Navy Pistol</option><option>Combat MG</option><option>Assault SMG</option><option>Gadget Pistol</option></select></label><label>Cantitate<input id="illegal-weapon-qty" class="demo-input" type="number" value="1" min="0"></label></div></div><div class="calculator-category"><button class="category-header-demo" data-action="toggle-category">🧩 Piese Armă <span>⌄</span></button><div class="category-content-demo"><label>Țeavă Pistol<input id="illegal-parts-barrel" class="demo-input" type="number" value="0" min="0"></label><label>Corp Pistol<input id="illegal-parts-body" class="demo-input" type="number" value="0" min="0"></label></div></div><div class="calculator-category"><button class="category-header-demo" data-action="toggle-category">💥 Muniție <span>⌄</span></button><div class="category-content-demo"><label>Tip muniție<select id="illegal-ammo" class="demo-input"><option>.9MM PBM</option><option>7.62MM</option><option>.44 Marlin</option></select></label><label>Cantitate<input id="illegal-ammo-qty" class="demo-input" type="number" value="0" min="0"></label></div></div><div class="calculator-category"><button class="category-header-demo" data-action="toggle-category">🧪 Plicuri / Weed / Mushrooms <span>⌄</span></button><div class="category-content-demo"><label>Resursă<select id="illegal-resource" class="demo-input"><option>Plicuri coca</option><option>Jointuri</option><option>Pink Light</option><option>Psilocybe</option></select></label><label>Cantitate<input id="illegal-resource-qty" class="demo-input" type="number" value="0" min="0"></label></div></div><div class="section-divider"></div><div class="screen-head compact-head"><div><p class="panel-eyebrow">REZULTATE CALCUL</p><h2>Rezultate fictive</h2></div><span class="screen-tag">FĂRĂ SALVARE</span></div><div class="results-grid-demo"><div><span>Total piese armă</span><b id="illegal-total-parts">2</b></div><div><span>Aur</span><b id="illegal-gold">1</b></div><div><span>Diamante</span><b id="illegal-diamonds">0</b></div><div><span>Total greutate</span><b id="illegal-weight">0.5 KG</b></div><div><span>Profit estimat</span><b id="illegal-profit">1.250 $</b></div></div><button class="demo-action secondary" data-action="calculate-illegal">Calculează local</button>` };
demoScreens.locatii = { title:'Locații ilegale', subtitle:'Păstrează hărțile și fluxul de navigare al panelului, dar ascunde complet locațiile concrete în demo.', tag:'HĂRȚI DEMO', guide:['Ce găsești în Locații Ilegale','În panelul real există hărți Los Santos, Cayo și Maldive, filtre și detalii pe locații. În demo poți schimba doar harta de fundal; nu afișăm pinuri, nume sau coordonate.'], body:`<div class="screen-head"><div><p class="panel-eyebrow">HĂRȚI & LOCAȚII ILEGALE</p><h2>Selectare Hartă</h2><p>Centrare standard și favoritele rămân doar vizuale în demo.</p></div><span class="screen-tag">FĂRĂ LOCAȚII</span></div><div class="map-tabs-demo"><button class="map-tab is-active" data-action="select-map" data-map="ls">Los Santos</button><button class="map-tab" data-action="select-map" data-map="cayo">Cayo</button><button class="map-tab" data-action="select-map" data-map="maldive">Maldive</button></div><div class="map-gallery"><div class="map-card map-one active-map" data-map-view="ls"><span>Los Santos & Blaine County</span><small>Hartă de fundal · fără locații</small></div><div class="map-card map-two" data-map-view="cayo"><span>Cayo Perico</span><small>Hartă de fundal · fără locații</small></div><div class="map-card map-three" data-map-view="maldive"><span>Maldive</span><small>Hartă de fundal · fără locații</small></div></div><div class="map-tools-demo"><button class="demo-action secondary" data-action="map-center">🎯 Centrare Standard</button><button class="demo-action secondary" data-action="map-favorites">Favorite Salvate <b>0</b></button></div><div class="map-explanation"><span class="info-index">INFO</span><p><b>Ce ar putea fi aici în panelul real?</b><br>În funcție de rol, aici ar putea apărea o locație, categoria ei, descrierea, cerințele, recompensele și imaginile asociate. Demo-ul păstrează intenționat doar harta de fundal.</p></div>` };
// Prezentarea publică păstrează doar operațiunile, resursele normale și administrația.
delete demoScreens.blackmarket;
delete demoScreens['calculator-ilegal'];
delete demoScreens.locatii;

const titleEl = document.getElementById('demo-title');
const subtitleEl = document.getElementById('demo-subtitle');
const guideTitleEl = document.querySelector('#demo-guide b');
const guideTextEl = document.querySelector('#demo-guide p');
const panelEl = document.getElementById('demo-panel-main');
const toastEl = document.getElementById('demo-toast');
const headerTitleEl = document.getElementById('demo-header-title');
const demoSidebarEl = document.querySelector('.demo-sidebar');
const mobileToggleEl = document.getElementById('demo-mobile-toggle');
const mobileCloseEl = document.getElementById('demo-mobile-close');
const mobileBackdropEl = document.getElementById('demo-mobile-backdrop');
let toastTimer;
let currentDemoKey = 'dashboard';
const transientDemoItems = { marketplace: [], blackmarket: [], anunturi: [], requests: [], contractImages1: [], contractImages2: [], marketImages: [], blackImages: [] };
const demoState = { shiftType: 'zi', shiftStatus: 'stopped', shiftSeconds: 0, shiftTimer: null };
const craftGallery = [
  ['Unelte x 10', 'Set de unelte demonstrativ pentru activitățile de mecanică.', '⚙️'],
  ['Masă de lucru Mecanic', 'Stație demonstrativă pentru unelte și piese auto.', '🛠️'],
  ['Limitator de viteză', 'Modul fictiv pentru reglarea vitezei maxime.', '◈'],
  ['Set cauciucuri', 'Set demonstrativ de anvelope pentru înlocuire.', '◉'],
  ['Kit de reparații avansat', 'Echipament fictiv pentru reparații capitale.', '🔧'],
  ['Jante Addon 80', 'Model demonstrativ de jantă addon.', '◌'],
  ['Jante Addon 85', 'Model demonstrativ de jantă addon.', '◌'],
  ['Jante Addon 68', 'Model demonstrativ de jantă addon.', '◌'],
  ['Jante Addon 69', 'Model demonstrativ de jantă addon.', '◌'],
  ['Jante Addon 70', 'Model demonstrativ de jantă addon.', '◌'],
  ['Jante Addon 71', 'Model demonstrativ de jantă addon.', '◌'],
  ['Jante Addon 72', 'Model demonstrativ de jantă addon.', '◌'],
  ['Jante Addon 92', 'Model demonstrativ de jantă addon.', '◌'],
  ['Set roți', 'Pachet fictiv de roți pregătit pentru montaj.', '◎'],
  ['Set roți Runflat', 'Set demonstrativ de roți cu tehnologie Runflat.', '◎'],
  ['Jante Addon 79', 'Model demonstrativ de jantă addon.', '◌']
];

function renderAssetGallery(key) {
  const gallery = document.getElementById('asset-gallery');
  const search = document.getElementById('gallery-search');
  if (!gallery || !search) return;
  const assets = key === 'craft' ? craftGallery : Array.from({ length: 29 }, (_, index) => [`Bucătărie ${index + 1}`, `Element demonstrativ ${index + 1} din galeria de bucătărie.`, '♨️']);
  const draw = (query = '') => {
    const value = query.toLocaleLowerCase('ro-RO');
    gallery.innerHTML = assets.filter(([title, description]) => `${title} ${description}`.toLocaleLowerCase('ro-RO').includes(value)).map(([title, description, icon]) => `<article class="asset-card"><div class="asset-placeholder" role="img" aria-label="${escapeHtml(title)}">${escapeHtml(icon)}</div><div><b>${escapeHtml(title)}</b><small>${escapeHtml(description)}</small></div></article>`).join('');
    gallery.querySelectorAll('.asset-placeholder').forEach((placeholder) => placeholder.addEventListener('click', () => showToast(`${placeholder.getAttribute('aria-label')} — previzualizare demo, fără acțiuni.`)));
  };
  search.addEventListener('input', () => draw(search.value));
  draw();
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>'"]/g, (character) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[character]));
}

function renderTransientContent(key) {
  const containers = { marketplace:'marketplace-demo-posts', blackmarket:'blackmarket-demo-posts', anunturi:'announcement-demo-posts' };
  const container = document.getElementById(containers[key]);
  if (container) {
    container.innerHTML = transientDemoItems[key].map((item) => `<div class="activity-item transient-item"><span><b>${escapeHtml(item.title)}</b><small>${escapeHtml(item.details)}</small></span><strong class="activity-value">DEMO</strong></div>`).join('');
  }
  const requestList = document.getElementById('request-list');
  if (requestList && transientDemoItems.requests.length) {
    requestList.insertAdjacentHTML('afterbegin', transientDemoItems.requests.map((item, index) => `<div class="activity-item transient-item"><span><b>${escapeHtml(item.title)}</b><small>${escapeHtml(item.details)}</small></span><span class="item-actions"><strong class="activity-value">DEMO</strong><button class="mini-action" data-action="edit-request" data-request-index="${index}">Editează</button><button class="mini-action" data-action="delete-request" data-request-index="${index}">Șterge</button></span></div>`).join(''));
  }
  const imageZones = [
    ['contract-paste-zone-1', transientDemoItems.contractImages1],
    ['contract-paste-zone-2', transientDemoItems.contractImages2],
    ['market-paste-zone', transientDemoItems.marketImages, 'market'],
    ['black-paste-zone', transientDemoItems.blackImages, 'black']
  ];
  imageZones.forEach(([id, images]) => {
    const zone = document.getElementById(id);
    if (!zone || !images.length) return;
    zone.classList.add('has-image');
    zone.insertAdjacentHTML('beforeend', images.map((url) => `<img data-demo-image src="${url}" alt="Imagine lipită în demo">`).join(''));
  });
}

function clearTransientDemo() {
  transientDemoItems.marketplace.length = 0;
  transientDemoItems.blackmarket.length = 0;
  transientDemoItems.anunturi.length = 0;
  transientDemoItems.requests.length = 0;
  transientDemoItems.contractImages1.forEach((url) => URL.revokeObjectURL(url));
  transientDemoItems.contractImages2.forEach((url) => URL.revokeObjectURL(url));
  transientDemoItems.marketImages.forEach((url) => URL.revokeObjectURL(url));
  transientDemoItems.blackImages.forEach((url) => URL.revokeObjectURL(url));
  transientDemoItems.contractImages1.length = 0;
  transientDemoItems.contractImages2.length = 0;
  transientDemoItems.marketImages.length = 0;
  transientDemoItems.blackImages.length = 0;
  clearInterval(demoState.shiftTimer);
  demoState.shiftTimer = null;
  demoState.shiftStatus = 'stopped';
  demoState.shiftSeconds = 0;
}

function closeDemoMenu() {
  demoSidebarEl?.classList.remove('is-open');
  mobileBackdropEl?.classList.remove('is-open');
  mobileToggleEl?.setAttribute('aria-expanded', 'false');
  document.body.classList.remove('demo-menu-open');
}

function openDemoMenu() {
  demoSidebarEl?.classList.add('is-open');
  mobileBackdropEl?.classList.add('is-open');
  mobileToggleEl?.setAttribute('aria-expanded', 'true');
  document.body.classList.add('demo-menu-open');
}

function initDemoShell() {
  if (!demoSidebarEl) return;
  document.querySelectorAll('.demo-brand,.demo-mode,.back-link').forEach((element) => element.remove());
  demoSidebarEl.querySelector('.demo-sidebar-head')?.remove();
  demoSidebarEl.querySelector('.sidebar-heading')?.remove();
  const demoNav = demoSidebarEl.querySelector('.demo-nav');
  if (demoNav) {
    demoNav.innerHTML = `<p class="nav-label">Operațiuni</p>
      <button class="demo-nav-item is-active" data-demo="dashboard"><span class="nav-icon">▣</span> Dashboard</button>
      <button class="demo-nav-item" data-demo="anunturi"><span class="nav-icon">▰</span> Anunțuri &amp; Sondaje</button>
      <button class="demo-nav-item" data-demo="asistent"><span class="nav-icon">✦</span> Asistent Panel</button>
      <button class="demo-nav-item" data-demo="pontaj"><span class="nav-icon">◷</span> Pontaj</button>
      <button class="demo-nav-item" data-demo="cereri"><span class="nav-icon">▱</span> Cereri / Absențe</button>
      <button class="demo-nav-item" data-demo="contracte"><span class="nav-icon">▤</span> Contracte</button>
      <button class="demo-nav-item" data-demo="rapoarte"><span class="nav-icon">▥</span> Rapoarte</button>
      <p class="nav-label">Resurse</p>
      <button class="demo-nav-item" data-demo="marketplace"><span class="nav-icon">◇</span> Marketplace</button>
      <button class="demo-nav-item" data-demo="calculator"><span class="nav-icon">⊞</span> Calculator</button>
      <button class="demo-nav-item" data-demo="bucatarie"><span class="nav-icon">♨</span> Bucătărie</button>
      <button class="demo-nav-item" data-demo="craft"><span class="nav-icon">⌁</span> Craft Mecanic</button>
      <p class="nav-label">Administrație</p>
      <button class="demo-nav-item" data-demo="administrare"><span class="nav-icon">⚙</span> Administrare organizație</button>`;
  }
  const sidebarBrand = document.createElement('div');
  sidebarBrand.className = 'demo-panel-brand';
  sidebarBrand.innerHTML = '<img src="img/logo-192.png" alt="Logo organizație demo"><button class="demo-mobile-close" id="demo-mobile-close-runtime" type="button" aria-label="Închide meniul">×</button>';
  demoNav?.before(sidebarBrand);
  sidebarBrand.querySelector('.demo-mobile-close')?.addEventListener('click', closeDemoMenu);
  const sidebarBottom = demoSidebarEl.querySelector('.sidebar-bottom');
  if (sidebarBottom) {
    sidebarBottom.innerHTML = '<div class="demo-user"><span class="demo-user-avatar">LM</span><div><b>Little Mario</b><small>Administrator · DEMO</small></div></div><button class="demo-logout" type="button">Logout</button>';
  }
  sidebarBottom?.querySelector('.demo-logout')?.addEventListener('click', () => showToast('Logout-ul este simulat în demo și nu închide o sesiune reală.'));
  let themeButton = document.getElementById('demo-theme-toggle');
  if (!themeButton && sidebarBottom) {
    themeButton = document.createElement('button');
    themeButton.id = 'demo-theme-toggle';
    themeButton.className = 'demo-theme-toggle';
    themeButton.type = 'button';
    themeButton.textContent = '◐';
    themeButton.setAttribute('aria-label', 'Schimbă tema demo');
    themeButton.title = 'Schimbă tema';
    sidebarBottom.appendChild(themeButton);
  }
  mobileToggleEl?.addEventListener('click', openDemoMenu);
  mobileCloseEl?.addEventListener('click', closeDemoMenu);
  mobileBackdropEl?.addEventListener('click', closeDemoMenu);
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeDemoMenu(); });
  themeButton?.addEventListener('click', () => {
    const light = document.documentElement.dataset.demoTheme === 'light';
    document.documentElement.dataset.demoTheme = light ? 'dark' : 'light';
    themeButton.textContent = light ? '◐' : '☼';
    showToast(light ? 'Tema întunecată a fost activată în demo.' : 'Tema normală a fost activată în demo.');
  });
  document.querySelector('[data-demo="administrare"]')?.replaceChildren(Object.assign(document.createElement('span'), { className: 'nav-icon', textContent: '⚙' }), document.createTextNode(' Administrare organizație'));
  document.getElementById('demo-global-search')?.addEventListener('input', (event) => {
    const query = event.target.value.trim().toLocaleLowerCase('ro-RO');
    panelEl.querySelectorAll('.activity-item,.feature-box,.asset-card,.calculator-category,.map-card').forEach((item) => {
      item.hidden = Boolean(query) && !item.textContent.toLocaleLowerCase('ro-RO').includes(query);
    });
  });
}

function configurePontajDemo() {
  if (currentDemoKey !== 'pontaj') return;
  demoState.shiftType = 'noapte';
  const dayButton = panelEl.querySelector('[data-shift-type="zi"]');
  const nightButton = panelEl.querySelector('[data-shift-type="noapte"]');
  dayButton?.classList.add('policy-disabled');
  if (dayButton) { dayButton.disabled = true; dayButton.title = 'Organizația demo folosește exclusiv programul de noapte.'; }
  nightButton?.classList.add('is-selected');
  const shiftRow = panelEl.querySelector('.shift-type-row');
  if (shiftRow && !panelEl.querySelector('.night-policy-note')) {
    shiftRow.insertAdjacentHTML('afterend', '<div class="night-policy-note"><b>Program strict de noapte</b><br>În panelul real, organizația poate folosi un interval de noapte configurat de administratori. Pentru această prezentare folosim exemplul 20:00–23:00. Pontajul de mai jos este doar un cronometru local, fără salvare sau trimitere externă.</div>');
  }
  updateShiftDemoUI();
}

function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('is-visible'), 3300);
}

function updateShiftDemoUI() {
  const timer = document.getElementById('demo-shift-timer');
  const status = document.getElementById('shift-status');
  const badge = document.getElementById('shift-demo-badge');
  if (!timer || !status) return;
  const seconds = demoState.shiftSeconds;
  timer.textContent = [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60].map((value) => String(value).padStart(2, '0')).join(':');
  const label = demoState.shiftType === 'zi' ? 'zi' : 'noapte';
  status.textContent = demoState.shiftStatus === 'active' ? `Tură de ${label} / Activă` : demoState.shiftStatus === 'paused' ? `Tură de ${label} / În pauză` : `Tură de ${label} / Oprită`;
  if (badge) badge.textContent = demoState.shiftStatus === 'active' ? 'ACTIV' : demoState.shiftStatus === 'paused' ? 'PAUZĂ' : 'OPRIT';
}

function startDemoShift() {
  demoState.shiftStatus = 'active';
  clearInterval(demoState.shiftTimer);
  demoState.shiftTimer = setInterval(() => { demoState.shiftSeconds += 1; updateShiftDemoUI(); }, 1000);
  updateShiftDemoUI();
  showToast('Start Pontaj executat local. Nu se salvează nimic.');
}

function bindScreenActions() {
  panelEl.querySelectorAll('[data-action]').forEach((button) => button.addEventListener('click', () => {
    const action = button.dataset.action;
    if (action === 'select-shift') {
      demoState.shiftType = button.dataset.shiftType || 'zi';
      panelEl.querySelectorAll('.shift-type-btn').forEach((item) => item.classList.toggle('is-selected', item === button));
      updateShiftDemoUI();
      showToast(`Ai selectat tura de ${demoState.shiftType}.`);
      return;
    }
    if (action === 'start-shift') { startDemoShift(); return; }
    if (action === 'pause-shift') {
      if (demoState.shiftStatus === 'active') { demoState.shiftStatus = 'paused'; clearInterval(demoState.shiftTimer); showToast('Pauza a fost activată doar în demo.'); }
      else if (demoState.shiftStatus === 'paused') startDemoShift();
      else showToast('Pornește întâi pontajul demo.');
      updateShiftDemoUI();
      return;
    }
    if (action === 'stop-shift') {
      if (demoState.shiftStatus === 'stopped') { showToast('Nu există o tură demo activă.'); return; }
      demoState.shiftStatus = 'stopped'; clearInterval(demoState.shiftTimer); updateShiftDemoUI(); showToast('Stop Pontaj executat local. Tura nu este salvată.'); return;
    }
    if (action === 'blocked') { showToast('Această modificare este disponibilă doar în panelul real; aici este păstrată ca simulare.'); return; }
    if (action === 'report-filter') { showToast('Filtre aplicate pe raportul fictiv.'); return; }
    if (action === 'report-reset') { panelEl.querySelectorAll('#report-mechanic').forEach((input) => { input.value = ''; }); showToast('Filtre resetate local.'); return; }
    if (action === 'report-refresh') { showToast('Datele fictive au fost reîmprospătate.'); return; }
    if (action === 'report-send') { showToast('Trimiterea pe Discord este dezactivată în demo.'); return; }
    if (action === 'calculate') {
      const qty = Number(document.getElementById('calc-craft-qty')?.value || 0) + Number(document.getElementById('calc-tailor-qty')?.value || 0);
      const total = Math.max(0, qty || 1);
      const values = { 'calc-plastic': total * 12, 'calc-iron': total * 8, 'calc-rubber': total * 4, 'calc-scrap': total * 6, 'calc-aluminium': total * 3, 'calc-total': total };
      Object.entries(values).forEach(([id, value]) => { const element = document.getElementById(id); if (element) element.textContent = value; });
      showToast('Calcul efectuat local. Rezultatul nu este salvat.');
      return;
    }
    if (action === 'calculate-illegal') {
      const weaponQty = Number(document.getElementById('illegal-weapon-qty')?.value || 0);
      const ammoQty = Number(document.getElementById('illegal-ammo-qty')?.value || 0);
      const resourceQty = Number(document.getElementById('illegal-resource-qty')?.value || 0);
      const values = { 'illegal-total-parts': Math.max(2, weaponQty * 2), 'illegal-gold': weaponQty, 'illegal-diamonds': Math.floor(weaponQty / 2), 'illegal-weight': `${(ammoQty * 0.1 + resourceQty * 0.25).toFixed(1)} KG`, 'illegal-profit': `${(1250 + resourceQty * 100).toLocaleString('ro-RO')} $` };
      Object.entries(values).forEach(([id, value]) => { const element = document.getElementById(id); if (element) element.textContent = value; });
      showToast('Calculator ilegal actualizat local.');
      return;
    }
    if (action === 'toggle-category') { button.closest('.calculator-category')?.classList.toggle('is-collapsed'); return; }
    if (action === 'reset-calculator') { panelEl.querySelectorAll('input[type="number"]').forEach((input) => { input.value = input.id.includes('qty') ? '0' : '0'; }); showToast('Calculator resetat doar în demo.'); return; }
    if (action === 'create-request') {
      const reason = document.getElementById('request-reason')?.value.trim();
      if (!reason) { showToast('Completează motivul / mențiunile.'); return; }
      const type = document.getElementById('request-type')?.value || 'Învoire';
      const start = document.getElementById('request-start')?.value || '12 august, 09:00';
      const end = document.getElementById('request-end')?.value || '13 august, 18:00';
      transientDemoItems.requests.unshift({ title: `${type} · Little Mario`, details: `${start} – ${end} · ${reason}` });
      renderDemo(currentDemoKey); showToast('Înștiințarea a fost adăugată local în demo.'); return;
    }
    if (action === 'edit-request') { const item = transientDemoItems.requests[Number(button.dataset.requestIndex)]; if (item) { const reason = document.getElementById('request-reason'); if (reason) reason.value = item.details; document.getElementById('request-type').value = item.title.split(' · ')[0] || 'Învoire'; showToast('Cererea a fost încărcată în formular pentru editare locală.'); } return; }
    if (action === 'delete-request') { transientDemoItems.requests.splice(Number(button.dataset.requestIndex), 1); renderDemo(currentDemoKey); showToast('Înștiințarea demo a fost ștearsă.'); return; }
    if (action === 'generate-contract') {
      const values = { company: document.getElementById('contract-company')?.value, manager: document.getElementById('contract-manager')?.value || 'Manager Demo', employee: document.getElementById('contract-employee')?.value || 'Angajat Demo', cnp: document.getElementById('contract-cnp')?.value || '0000000000000', phone: document.getElementById('contract-phone')?.value || '07xx xxx xxx', position: document.getElementById('contract-position')?.value, salary: document.getElementById('contract-salary')?.value, schedule: document.getElementById('contract-schedule')?.value, start: document.getElementById('contract-start')?.value || '12.08.2026' };
      const preview = document.getElementById('contract-preview');
      const status = document.getElementById('contract-preview-status');
      if (preview) preview.textContent = `CONTRACT INDIVIDUAL DE MUNCĂ\n\nAngajator: ${values.company}\nManager: ${values.manager}\n\nAngajat: ${values.employee}\nCNP: ${values.cnp}\nTelefon: ${values.phone}\nFuncție: ${values.position}\nSalariu: ${values.salary}\nProgram: ${values.schedule}\nData începerii: ${values.start}\n\nDOCUMENT DEMO — NU ARE VALOARE CONTRACTUALĂ`;
      if (status) status.textContent = 'Generat local';
      showToast('Contract generat în previzualizare.'); return;
    }
    if (action === 'copy-contract') { const preview = document.getElementById('contract-preview')?.textContent || ''; navigator.clipboard?.writeText(preview); showToast('Contract copiat local în clipboard.'); return; }
    if (action === 'reset-contract') { renderDemo('contracte'); showToast('Formularul demo a fost resetat.'); return; }
    if (action === 'send-discord') { showToast('În demo, trimiterea pe Discord este dezactivată.'); return; }
    if (action === 'post-marketplace' || action === 'post-blackmarket') {
      const isMarket = action === 'post-marketplace';
      const prefix = isMarket ? 'market' : 'black';
      const title = document.getElementById(`${prefix}-name`)?.value.trim();
      const marketIsServices = isMarket && document.getElementById('market-action-type')?.value === 'Servicii';
      const details = document.getElementById(marketIsServices ? 'market-services' : isMarket ? 'market-products' : 'black-products')?.value.trim();
      const price = document.getElementById(`${prefix}-price`)?.value.trim();
      const phone = document.getElementById(`${prefix}-phone`)?.value.trim();
      if (!title || !phone || !details || !price) { showToast('Completează numele, telefonul, descrierea și prețul.'); return; }
      const category = document.getElementById(`${prefix}-category`)?.value || '';
      transientDemoItems[isMarket ? 'marketplace' : 'blackmarket'].push({ title: `${title} · ${category}`, details: `${details} · ${price} · postare demo` });
      renderDemo(currentDemoKey); showToast('Anunț adăugat local. Va dispărea la refresh sau la ieșire.'); return;
    }
    if (action === 'announcement-audience') { const title = document.getElementById('announcement-title')?.value.trim(); const text = document.getElementById('announcement-text')?.value.trim(); if (!title || !text) { showToast('Completează titlul și conținutul.'); return; } document.getElementById('audience-demo')?.removeAttribute('hidden'); showToast('Alege audiența, ca în panelul real.'); return; }
    if (action === 'add-poll-option') { const wrap = document.getElementById('poll-options-demo'); const count = wrap?.querySelectorAll('input').length || 0; if (wrap && count < 5) wrap.insertAdjacentHTML('beforeend', `<input class="demo-input" placeholder="Opțiunea ${count + 1}">`); return; }
    if (action === 'post-announcement') { const title = document.getElementById('announcement-title')?.value.trim(); const text = document.getElementById('announcement-text')?.value.trim(); if (!title || !text) { showToast('Completează titlul și conținutul.'); return; } const type = document.getElementById('announcement-type')?.value === 'poll' ? 'Sondaj' : document.getElementById('announcement-type')?.value === 'question' ? 'Întrebare' : 'Anunț'; transientDemoItems.anunturi.push({ title: `${type} · ${title}`, details: `${text} · ${button.dataset.audience === 'departments' ? 'Birouri / Angajați' : 'Organizație'}` }); renderDemo(currentDemoKey); showToast(`${type} adăugat temporar. Nu se postează pe Discord.`); return; }
    if (action === 'announcement-filter') { panelEl.querySelectorAll('.filter-tab').forEach((item) => item.classList.toggle('is-active', item === button)); showToast('Filtrul demo a fost aplicat local.'); return; }
    if (action === 'select-map') { panelEl.querySelectorAll('.map-tab').forEach((item) => item.classList.toggle('is-active', item === button)); panelEl.querySelectorAll('[data-map-view]').forEach((item) => item.classList.toggle('active-map', item.dataset.mapView === button.dataset.map)); showToast(`Harta ${button.textContent.trim()} afișată fără locații.`); return; }
    if (action === 'map-center') { showToast('Harta a fost recentrată în demo.'); return; }
    if (action === 'map-favorites') { showToast('Nu există favorite salvate în demo.'); return; }
    showToast('Acțiune disponibilă în varianta reală, simulată fără salvare aici.');
  }));
  panelEl.querySelector('#announcement-type')?.addEventListener('change', (event) => { const poll = event.target.value === 'poll'; const options = document.getElementById('poll-options-demo'); if (options) options.hidden = !poll; });
  const marketActionType = panelEl.querySelector('#market-action-type');
  if (marketActionType) {
    const updateMarketFields = () => { const services = marketActionType.value === 'Servicii'; panelEl.querySelector('.market-services-field')?.classList.toggle('hidden-demo', !services); panelEl.querySelector('#market-products')?.closest('label')?.classList.toggle('hidden-demo', services); };
    marketActionType.addEventListener('change', updateMarketFields);
    updateMarketFields();
  }
  updateShiftDemoUI();
}

function renderDemo(key) {
  const screen = demoScreens[key] || demoScreens.dashboard;
  currentDemoKey = key;
  titleEl.textContent = screen.title;
  const headerLabel = (document.querySelector(`[data-demo="${key}"]`)?.textContent || screen.title).replace(/^[^\p{L}\p{N}]+/u, '').trim();
  if (headerTitleEl) headerTitleEl.querySelector('h2')?.replaceChildren(document.createTextNode(headerLabel));
  subtitleEl.textContent = screen.subtitle;
  guideTitleEl.textContent = screen.guide[0];
  guideTextEl.textContent = screen.guide[1];
  panelEl.innerHTML = screen.body;
  renderTransientContent(key);
  renderAssetGallery(key);
  configurePontajDemo();
  bindScreenActions();
  document.querySelectorAll('.demo-nav-item').forEach((item) => item.classList.toggle('is-active', item.dataset.demo === key));
}

initDemoShell();
document.querySelectorAll('.demo-nav-item').forEach((item) => item.addEventListener('click', () => { closeDemoMenu(); renderDemo(item.dataset.demo); }));
document.addEventListener('paste', (event) => {
  const activeElement = document.activeElement;
  const pasteZone = activeElement?.closest?.('.paste-zone') || panelEl.querySelector('.paste-zone');
  if (!pasteZone) return;
  const imageItem = Array.from(event.clipboardData?.items || []).find((item) => item.type.startsWith('image/'));
  if (!imageItem) return;
  const file = imageItem.getAsFile();
  if (!file) return;
  event.preventDefault();
  const url = URL.createObjectURL(file);
  const bucket = pasteZone.id.startsWith('market-') ? transientDemoItems.marketImages : pasteZone.id.startsWith('black-') ? transientDemoItems.blackImages : pasteZone.id.endsWith('-1') ? transientDemoItems.contractImages1 : transientDemoItems.contractImages2;
  bucket.push(url);
  pasteZone.classList.add('has-image');
  pasteZone.insertAdjacentHTML('beforeend', `<img data-demo-image src="${url}" alt="Imagine lipită în demo">`);
  showToast('Imagine lipită în demo. Nu se încarcă și nu se salvează.');
});
window.addEventListener('pagehide', clearTransientDemo);
window.addEventListener('beforeunload', clearTransientDemo);
renderDemo('dashboard');
