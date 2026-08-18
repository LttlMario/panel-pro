// Bază de cunoștințe locală. Nu conține chei, webhook-uri sau informații externe.
window.PANEL_ASSISTANT_KNOWLEDGE = [
    {
        title: 'Ce este Asistentul intern',
        category: 'asistent', page: '',
        keywords: ['asistent', 'ai', 'robot', 'cine esti', 'ce poti', 'ajutor'],
        answer: 'Sunt asistentul local al panelului. Caut exclusiv în informațiile proiectului și îți arăt pagina potrivită. Nu caut pe internet și nu trimit conversația către un API AI.'
    },
    {
        title: 'Căutarea în Panel',
        category: 'navigare', page: '',
        keywords: ['cautare', 'search', 'searchbar', 'bara cautare', 'gasesc ceva', 'unde gasesc', 'cauta pagina'],
        answer: 'Folosește bara de căutare din header. Căutarea verifică paginile și conținutul permis rolului tău și te poate trimite direct către modulul potrivit.'
    },
    {
        title: 'Dashboard',
        category: 'navigare', page: 'index.html',
        keywords: ['dashboard', 'acasa', 'pagina principala', 'rezumat', 'tura curenta'],
        answer: 'Dashboard-ul afișează turele de astăzi, timpul lucrat, starea pontajului, următoarea învoire și acces rapid către secțiunile uzuale.'
    },
    {
        title: 'Pornirea pontajului',
        category: 'pontaj', page: 'pontaj.html',
        keywords: ['start pontaj', 'pornesc pontaj', 'incep tura', 'tura zi', 'tura noapte'],
        answer: 'În Pontaj alegi mai întâi tipul turei — Zi sau Noapte — apoi apeși Start Pontaj. Tura de noapte poate fi pornită între 20:00 și 22:59, iar sistemul nu permite două ture active pentru același utilizator.'
    },
    {
        title: 'Pontajul după refresh sau schimbarea paginii',
        category: 'pontaj', page: 'pontaj.html',
        keywords: ['refresh', 'ies din pagina', 'inchid browser', 'continua timer', 'se reseteaza', 'restaurare tura'],
        answer: 'Tura activă este salvată în Supabase. Dacă schimbi pagina, dai refresh sau revii după închiderea browserului, pontajul activ și cronometrul sunt restaurate.'
    },
    {
        title: 'Pauza din pontaj',
        category: 'pontaj', page: 'pontaj.html',
        keywords: ['pauza', 'pun pauza', 'reiau tura', 'timp pauza'],
        answer: 'Butonul Pauză salvează starea în baza de date. La revenirea în pagină se restaurează și pauza, iar timpul de pauză poate fi exclus din durata lucrată.'
    },
    {
        title: 'Oprirea manuală a pontajului',
        category: 'pontaj', page: 'pontaj.html',
        keywords: ['stop pontaj', 'opresc tura', 'inchei tura', 'durata'],
        answer: 'Apasă Stop Pontaj pentru a închide tura. Sistemul calculează durata, actualizează Supabase și trimite notificarea configurată pentru pontaj.'
    },
    {
        title: 'Închiderea automată a turelor',
        category: 'pontaj', page: 'pontaj.html',
        keywords: ['ora limita', 'oprire automata', 'inchidere automata', '19 59', '23 00', 'program maxim'],
        answer: 'Conform configurației implicite, turele de zi se închid automat la 19:59, iar cele de noapte la 23:00, ora României. Administratorii pot modifica orele din Panoul Admin.'
    },
    {
        title: 'Trimiterea unei învoiri',
        category: 'invoiri', page: 'cereri.html',
        keywords: ['invoire', 'cerere', 'absenta', 'concediu', 'medicala', 'indisponibilitate', 'schimb tura'],
        answer: 'În Cereri / Absențe alegi tipul înștiințării, completezi începutul, sfârșitul și motivul, apoi trimiți formularul. Dovada prin link este opțională, iar data de sfârșit trebuie să fie după început. Tipurile disponibile sunt Învoire, Concediu, Absență medicală, Schimb de tură și Indisponibilitate.'
    },
    {
        title: 'Modificarea unei învoiri',
        category: 'invoiri', page: 'cereri.html',
        keywords: ['editez invoirea', 'modific cererea', 'sterg cererea', 'istoric invoiri'],
        answer: 'În Istoricul meu de înștiințări găsești cererile tale și opțiunile disponibile pentru modificare sau gestionare.'
    },
    {
        title: 'Craft Mecanic',
        category: 'craft', page: 'craftmecanics.html',
        keywords: ['craft', 'reteta', 'unelte', 'masa lucru', 'kit reparatii', 'limitator viteza'],
        answer: 'Craft Mecanic conține galeria locală de rețete și echipamente. Poți căuta după numele obiectului, al uneltei, al setului de roți sau al modelului de jantă.'
    },
    {
        title: 'Set roți Runflat',
        category: 'craft', page: 'craftmecanics.html?search=Set%20ro%C8%9Bi%20Runflat',
        keywords: ['runflat', 'roti runflat', 'set roti', 'pana'],
        answer: 'Setul de roți Runflat este prezent în Craft Mecanic și este descris ca un set special care permite rularea în caz de pană. Deschide pagina pentru captura și detaliile rețetei.'
    },
    {
        title: 'Marketplace intern',
        category: 'marketplace', page: 'marketplace.html',
        keywords: ['marketplace', 'anunt', 'vanzare', 'cumparare', 'servicii', 'vehicule', 'case', 'bunuri'],
        answer: 'Marketplace-ul intern permite anunțuri de Vânzare, Cumpărare sau Servicii, pentru categorii precum Case, Vehicule și Bunuri. Prețul este obligatoriu, poți adăuga maximum 5 imagini, iar anunțurile pot fi filtrate din aceeași pagină.'
    },
    {
        title: 'Calculatorul ilegal',
        category: 'ilegal', page: 'calculatorilegal.html',
        keywords: ['calculator ilegal', 'arme', 'munitie', 'plicuri', 'cocaina', 'marijuana', 'ciuperci', 'materiale'],
        answer: 'Calculatorul ilegal calculează componentele și materialele necesare pentru arme, muniții, plicuri de cocaină, marijuana și ciuperci. Introdu cantitățile dorite în pagina Calculator Ilegal.'
    },
    {
        title: 'Navy Pistol',
        category: 'ilegal', page: 'calculatorilegal.html',
        keywords: ['navy', 'navy pistol', 'cum fac navy', 'cum fac un navy', 'craft navy pistol', 'arma navy'],
        answer: 'Pentru 1 Navy Pistol în Calculator Ilegal ai nevoie de 1 Blueprint, 6 piese de armă, 1 Țeavă Rifle și 1 Corp Pistol. Echivalentul materialelor brute este 5 Arc, 5 Oțel, 5 Plastic și 10 Scrap. Deschide Calculator Ilegal și introdu cantitatea la Navy Pistol pentru calcul automat.'
    },
    {
        title: 'Combat MG',
        category: 'ilegal', page: 'calculatorilegal.html',
        keywords: ['combat mg', 'cum fac combat mg', 'arma combat mg'],
        answer: 'Pentru 1 Combat MG ai nevoie de 1 Blueprint, 4 piese de armă, 1 Țeavă Rifle, 1 Corp Rifle și 1 Butstock. Echivalentul materialelor brute este 6 Arc, 6 Oțel, 6 Plastic și 12 Scrap.'
    },
    {
        title: 'Assault SMG',
        category: 'ilegal', page: 'calculatorilegal.html',
        keywords: ['assault smg', 'cum fac assault smg', 'arma smg'],
        answer: 'Pentru 1 Assault SMG ai nevoie de 1 Blueprint, 4 piese de armă, 1 Țeavă SMG, 1 Corp Rifle și 1 Butstock. Echivalentul materialelor brute este 6 Arc, 6 Oțel, 6 Plastic și 12 Scrap.'
    },
    {
        title: 'Gadget Pistol',
        category: 'ilegal', page: 'calculatorilegal.html',
        keywords: ['gadget pistol', 'cum fac gadget pistol'],
        answer: 'Pentru 1 Gadget Pistol ai nevoie de 1 Blueprint, 20 piese de armă, 1 Țeavă Rifle, 1 Corp Pistol, 10 Aur, 2 Diamante, 2 Rubine și 2 Smaralde. Echivalentul materialelor brute este 12 Arc, 12 Oțel, 12 Plastic și 24 Scrap.'
    },
    {
        title: 'Shotgun',
        category: 'ilegal', page: 'calculatorilegal.html',
        keywords: ['shotgun', 'cum fac shotgun'],
        answer: 'Pentru 1 Shotgun ai nevoie de 4 piese de armă, 1 Țeavă SMG și 1 Corp Pistol. Echivalentul materialelor brute este 4 Arc, 4 Oțel, 4 Plastic și 8 Scrap.'
    },
    {
        title: 'Raport materiale piesă brută',
        category: 'ilegal', page: 'calculatorilegal.html',
        keywords: ['piesa bruta', 'arc', 'otel', 'plastic', 'scrap', 'raport materiale arma'],
        answer: 'Pentru o piesă brută, calculatorul folosește raportul: 1 arc, 1 oțel, 1 plastic și 2 scrap.'
    },
    {
        title: 'Raport cocaină și marijuana',
        category: 'ilegal', page: 'calculatorilegal.html',
        keywords: ['100 plicuri cocaina', 'frunze coca', 'tavi', 'ape', 'brichete', 'joint', 'foita', 'frunze cannabis'],
        answer: 'Pentru 100 de plicuri de cocaină sunt calculate 1000 frunze, 50 tăvi, 50 ape, 50 brichete și 100 plicuri goale. Pentru un joint sunt necesare 20 frunze de cannabis și o foiță.'
    },
    {
        title: 'Locații ilegale',
        category: 'ilegal', page: 'locatiiilegale.html',
        keywords: ['locatii ilegale', 'harta', 'los santos', 'cayo', 'maldive', 'droguri', 'arme', 'rulote', 'topitorie'],
        answer: 'Pagina Locații ilegale afișează hărțile Los Santos, Cayo Perico și Maldive. Locațiile pot fi căutate, filtrate după categorie și salvate la favorite.'
    },
    {
        title: 'Procesarea cocainei și cumpărarea acetonei',
        category: 'ilegal', page: 'locatiiilegale.html',
        keywords: ['unde procesez cocaina', 'procesare cocaina', 'cumpar acetona', 'humane labs', 'cayo'],
        answer: 'Procesarea cocainei se află pe Cayo și folosește frunze de coca plus acetonă. Punctul de cumpărare a acetonei este la Humane Labs, în Los Santos.'
    },
    {
        title: 'Black Market',
        category: 'ilegal', page: 'marketplace-ilegal.html',
        keywords: ['black market', 'piata neagra', 'anunt ilegal', 'arme', 'munitie', 'jointuri', 'piese arma'],
        answer: 'Black Market este marketplace-ul pentru rolurile Familia și superioare. Include anunțuri pentru Arme, Muniție, Plicuri, Jointuri, Piese de armă și Servicii. Prețul este obligatoriu și sunt permise maximum 5 imagini.'
    },
    {
        title: 'TEC-9 / TEC',
        category: 'ilegal', page: 'marketplace-ilegal.html',
        keywords: ['tec', 'tec9', 'tec 9', 'tec-9', 'arma tec', 'pistol tec', 'vand tec', 'cumpar tec', 'black market tec'],
        answer: 'Pentru TEC sau TEC-9 mergi în Black Market. Acolo poți căuta anunțuri de vânzare, cumpărare sau servicii pentru această armă. Folosește căutarea din pagină cu „TEC” sau „TEC-9”.'
    },
    {
        title: 'Rapoarte și pontaje active',
        category: 'manager', page: 'rapoarte.html',
        keywords: ['rapoarte', 'pontaje active', 'mecanici activi', 'filtru tura', 'export csv', 'discord'],
        answer: 'În Rapoarte, managerii pot vedea pontajele active în timp real, filtra istoricul după perioadă, tip de tură sau mecanic și exporta datele în CSV ori trimite raportul selectat pe Discord.'
    },
    {
        title: 'Gestionarea pontajului de către manager',
        category: 'manager', page: 'rapoarte.html',
        keywords: ['manager opreste pontaj', 'editeaza pontaj', 'sterge pontaj', 'scoate mecanic din tura'],
        answer: 'Managerii pot edita un pontaj activ, schimba tipul, începutul sau starea și pot opri tura unui mecanic. Istoricul permite și editarea sau ștergerea înregistrărilor, conform permisiunilor.'
    },
    {
        title: 'Gestionarea învoirilor de către manager',
        category: 'manager', page: 'rapoarte.html',
        keywords: ['manager invoiri', 'editeaza absenta', 'sterge absenta', 'administrare cereri'],
        answer: 'Secțiunea managerială din Rapoarte permite vizualizarea, editarea și ștergerea învoirilor și absențelor personalului.'
    },
    {
        title: 'Contracte',
        category: 'manager', page: 'contracte.html',
        keywords: ['contract', 'angajez', 'manager contract', 'cnp', 'functie mecanic', 'tip contract'],
        answer: 'Pagina Contracte este disponibilă managerilor. Completezi managerul, angajatul, CNP-ul, telefonul, funcția, salariul, programul și data începerii, apoi poți genera, previzualiza, copia sau trimite contractul pe Discord și îi poți atașa imaginile necesare.'
    }
];

window.PANEL_ASSISTANT_PAGES = [
    { file: 'index.html', label: 'Dashboard' },
    { file: 'pontaj.html', label: 'Pontaj' },
    { file: 'bucatarie.html', label: 'Bucătărie' },
    { file: 'anunturi.html', label: 'Anunțuri și sondaje' },
    { file: 'cereri.html', label: 'Cereri / Absențe' },
    { file: 'craftmecanics.html', label: 'Craft Mecanic' },
    { file: 'marketplace.html', label: 'Marketplace' },
    { file: 'calculator.html', label: 'Calculator' },
    { file: 'calculatorilegal.html', label: 'Calculator Ilegal' },
    { file: 'locatiiilegale.html', label: 'Locații Ilegale' },
    { file: 'marketplace-ilegal.html', label: 'Black Market' },
    { file: 'rapoarte.html', label: 'Rapoarte' },
    { file: 'contracte.html', label: 'Contracte' },
    { file: 'asistent.html', label: 'Asistent' },
    { file: 'status-live.html', label: 'Status live' },
    { file: 'admin.html', label: 'Panou Admin' },
    { file: 'logs.html', label: 'Loguri' },
    { file: 'diagnostic.html', label: 'Diagnostic' },
    { file: 'discord-configurare.html', label: 'Configurare Discord' },
    { file: 'organizatii.html', label: 'Organizații' },
    { file: 'vouchere.html', label: 'Vouchere' },
    { file: 'developer.html', label: 'Developer' },
    { file: 'administrare-organizatie.html', label: 'Administrare organizație' }
];
