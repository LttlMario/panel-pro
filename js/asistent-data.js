// Bază de cunoștințe locală. Nu conține chei, webhook-uri sau informații externe.
window.PANEL_ASSISTANT_KNOWLEDGE = [
    {
        title: 'Ce este Asistentul intern',
        category: 'asistent', role: 1, page: '',
        keywords: ['asistent', 'ai', 'robot', 'cine esti', 'ce poti', 'ajutor'],
        answer: 'Sunt asistentul local al panelului. Caut exclusiv în informațiile proiectului și îți arăt pagina potrivită. Nu caut pe internet și nu trimit conversația către un API AI.'
    },
    {
        title: 'Dashboard',
        category: 'navigare', role: 1, page: 'index.html',
        keywords: ['dashboard', 'acasa', 'pagina principala', 'rezumat', 'tura curenta'],
        answer: 'Dashboard-ul afișează turele de astăzi, timpul lucrat, starea pontajului, următoarea învoire și acces rapid către secțiunile uzuale.'
    },
    {
        title: 'Pornirea pontajului',
        category: 'pontaj', role: 1, page: 'pontaj.html',
        keywords: ['start pontaj', 'pornesc pontaj', 'incep tura', 'tura zi', 'tura noapte'],
        answer: 'În Pontaj alegi mai întâi tipul turei — Zi sau Noapte — apoi apeși Start Pontaj. Tura de noapte poate fi pornită între 20:00 și 22:59, iar sistemul nu permite două ture active pentru același utilizator.'
    },
    {
        title: 'Pontajul după refresh sau schimbarea paginii',
        category: 'pontaj', role: 1, page: 'pontaj.html',
        keywords: ['refresh', 'ies din pagina', 'inchid browser', 'continua timer', 'se reseteaza', 'restaurare tura'],
        answer: 'Tura activă este salvată în Supabase. Dacă schimbi pagina, dai refresh sau revii după închiderea browserului, pontajul activ și cronometrul sunt restaurate.'
    },
    {
        title: 'Pauza din pontaj',
        category: 'pontaj', role: 1, page: 'pontaj.html',
        keywords: ['pauza', 'pun pauza', 'reiau tura', 'timp pauza'],
        answer: 'Butonul Pauză salvează starea în baza de date. La revenirea în pagină se restaurează și pauza, iar timpul de pauză poate fi exclus din durata lucrată.'
    },
    {
        title: 'Oprirea manuală a pontajului',
        category: 'pontaj', role: 1, page: 'pontaj.html',
        keywords: ['stop pontaj', 'opresc tura', 'inchei tura', 'durata'],
        answer: 'Apasă Stop Pontaj pentru a închide tura. Sistemul calculează durata, actualizează Supabase și trimite notificarea configurată pentru pontaj.'
    },
    {
        title: 'Închiderea automată a turelor',
        category: 'pontaj', role: 1, page: 'pontaj.html',
        keywords: ['ora limita', 'oprire automata', 'inchidere automata', '19 59', '23 00', 'program maxim'],
        answer: 'Conform configurației implicite, turele de zi se închid automat la 19:59, iar cele de noapte la 23:00, ora României. Administratorii pot modifica orele din Panoul Admin.'
    },
    {
        title: 'Trimiterea unei învoiri',
        category: 'invoiri', role: 1, page: 'cereri.html',
        keywords: ['invoire', 'cerere', 'absenta', 'concediu', 'medicala', 'indisponibilitate', 'schimb tura'],
        answer: 'În Cereri / Absențe alegi tipul înștiințării, completezi începutul, sfârșitul și motivul, apoi trimiți formularul. Dovada prin link este opțională, iar data de sfârșit trebuie să fie după început. Tipurile disponibile sunt Învoire, Concediu, Absență medicală, Schimb de tură și Indisponibilitate.'
    },
    {
        title: 'Modificarea unei învoiri',
        category: 'invoiri', role: 1, page: 'cereri.html',
        keywords: ['editez invoirea', 'modific cererea', 'sterg cererea', 'istoric invoiri'],
        answer: 'În Istoricul meu de înștiințări găsești cererile tale și opțiunile disponibile pentru modificare sau gestionare.'
    },
    {
        title: 'Craft Mecanics',
        category: 'craft', role: 1, page: 'craftmecanics.html',
        keywords: ['craft', 'reteta', 'unelte', 'masa lucru', 'kit reparatii', 'limitator viteza'],
        answer: 'Craft Mecanics conține galeria locală de rețete și echipamente. Poți căuta după numele obiectului, al uneltei, al setului de roți sau al modelului de jantă.'
    },
    {
        title: 'Set roți Runflat',
        category: 'craft', role: 1, page: 'craftmecanics.html?search=Set%20ro%C8%9Bi%20Runflat',
        keywords: ['runflat', 'roti runflat', 'set roti', 'pana'],
        answer: 'Setul de roți Runflat este prezent în Craft Mecanics și este descris ca un set special care permite rularea în caz de pană. Deschide pagina pentru captura și detaliile rețetei.'
    },
    {
        title: 'Marketplace intern',
        category: 'marketplace', role: 1, page: 'marketplace.html',
        keywords: ['marketplace', 'anunt', 'vanzare', 'cumparare', 'servicii', 'vehicule', 'case', 'bunuri'],
        answer: 'Marketplace-ul intern permite anunțuri de Vânzare, Cumpărare sau Servicii, pentru categorii precum Case, Vehicule și Bunuri. Prețul este obligatoriu, poți adăuga maximum 5 imagini, iar anunțurile pot fi filtrate din aceeași pagină.'
    },
    {
        title: 'Calculatorul ilegal',
        category: 'ilegal', role: 3, page: 'calculatorilegal.html',
        keywords: ['calculator ilegal', 'arme', 'munitie', 'plicuri', 'cocaina', 'marijuana', 'ciuperci', 'materiale'],
        answer: 'Calculatorul ilegal calculează componentele și materialele necesare pentru arme, muniții, plicuri de cocaină, marijuana și ciuperci. Introdu cantitățile dorite în pagina Calculator Ilegal.'
    },
    {
        title: 'Raport materiale piesă brută',
        category: 'ilegal', role: 3, page: 'calculatorilegal.html',
        keywords: ['piesa bruta', 'arc', 'otel', 'plastic', 'scrap', 'raport materiale arma'],
        answer: 'Pentru o piesă brută, calculatorul folosește raportul: 1 arc, 1 oțel, 1 plastic și 2 scrap.'
    },
    {
        title: 'Raport cocaină și marijuana',
        category: 'ilegal', role: 3, page: 'calculatorilegal.html',
        keywords: ['100 plicuri cocaina', 'frunze coca', 'tavi', 'ape', 'brichete', 'joint', 'foita', 'frunze cannabis'],
        answer: 'Pentru 100 de plicuri de cocaină sunt calculate 1000 frunze, 50 tăvi, 50 ape, 50 brichete și 100 plicuri goale. Pentru un joint sunt necesare 20 frunze de cannabis și o foiță.'
    },
    {
        title: 'Locații ilegale',
        category: 'ilegal', role: 3, page: 'locatiiilegale.html',
        keywords: ['locatii ilegale', 'harta', 'los santos', 'cayo', 'maldive', 'droguri', 'arme', 'rulote', 'topitorie'],
        answer: 'Pagina Locații ilegale afișează hărțile Los Santos, Cayo Perico și Maldive. Locațiile pot fi căutate, filtrate după categorie și salvate la favorite.'
    },
    {
        title: 'Procesarea cocainei și cumpărarea acetonei',
        category: 'ilegal', role: 3, page: 'locatiiilegale.html',
        keywords: ['unde procesez cocaina', 'procesare cocaina', 'cumpar acetona', 'humane labs', 'cayo'],
        answer: 'Procesarea cocainei se află pe Cayo și folosește frunze de coca plus acetonă. Punctul de cumpărare a acetonei este la Humane Labs, în Los Santos.'
    },
    {
        title: 'Black Market',
        category: 'ilegal', role: 3, page: 'marketplace-ilegal.html',
        keywords: ['black market', 'piata neagra', 'anunt ilegal', 'arme', 'munitie', 'jointuri', 'piese arma'],
        answer: 'Black Market este marketplace-ul pentru rolurile Familia și superioare. Include anunțuri pentru Arme, Muniție, Plicuri, Jointuri, Piese de armă și Servicii. Prețul este obligatoriu și sunt permise maximum 5 imagini.'
    },
    {
        title: 'Rapoarte și pontaje active',
        category: 'manager', role: 4, page: 'rapoarte.html',
        keywords: ['rapoarte', 'pontaje active', 'mecanici activi', 'filtru tura', 'export csv', 'discord'],
        answer: 'În Rapoarte, managerii pot vedea pontajele active în timp real, filtra istoricul după perioadă, tip de tură sau mecanic și exporta datele în CSV ori trimite raportul selectat pe Discord.'
    },
    {
        title: 'Gestionarea pontajului de către manager',
        category: 'manager', role: 4, page: 'rapoarte.html',
        keywords: ['manager opreste pontaj', 'editeaza pontaj', 'sterge pontaj', 'scoate mecanic din tura'],
        answer: 'Managerii pot edita un pontaj activ, schimba tipul, începutul sau starea și pot opri tura unui mecanic. Istoricul permite și editarea sau ștergerea înregistrărilor, conform permisiunilor.'
    },
    {
        title: 'Gestionarea învoirilor de către manager',
        category: 'manager', role: 4, page: 'rapoarte.html',
        keywords: ['manager invoiri', 'editeaza absenta', 'sterge absenta', 'administrare cereri'],
        answer: 'Secțiunea managerială din Rapoarte permite vizualizarea, editarea și ștergerea învoirilor și absențelor personalului.'
    },
    {
        title: 'Contracte',
        category: 'manager', role: 4, page: 'contracte.html',
        keywords: ['contract', 'angajez', 'manager contract', 'cnp', 'functie mecanic', 'tip contract'],
        answer: 'Pagina Contracte este disponibilă managerilor. Completezi managerul, angajatul, CNP-ul, telefonul, funcția, salariul, programul și data începerii, apoi poți genera, previzualiza, copia sau trimite contractul pe Discord și îi poți atașa imaginile necesare.'
    }
];

window.PANEL_ASSISTANT_PAGES = [
    { file: 'index.html', label: 'Dashboard', role: 1 },
    { file: 'pontaj.html', label: 'Pontaj', role: 1 },
    { file: 'bucatarie.html', label: 'Bucătărie', role: 1 },
    { file: 'anunturi.html', label: 'Anunțuri și sondaje', role: 1 },
    { file: 'cereri.html', label: 'Cereri / Absențe', role: 1 },
    { file: 'craftmecanics.html', label: 'Craft Mecanics', role: 1 },
    { file: 'marketplace.html', label: 'Marketplace', role: 1 },
    { file: 'calculatorilegal.html', label: 'Calculator Ilegal', role: 3 },
    { file: 'locatiiilegale.html', label: 'Locații Ilegale', role: 3 },
    { file: 'marketplace-ilegal.html', label: 'Black Market', role: 3 },
    { file: 'rapoarte.html', label: 'Rapoarte', role: 4 },
    { file: 'contracte.html', label: 'Contracte', role: 4 },
    { file: 'asistent.html', label: 'Asistent', role: 1 }
];
