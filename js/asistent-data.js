// BazÄƒ de cunoÈ™tinÈ›e localÄƒ. Nu conÈ›ine chei, webhook-uri sau informaÈ›ii externe.
window.PANEL_ASSISTANT_KNOWLEDGE = [
    {
        title: 'Ce este Asistentul intern',
        category: 'asistent', role: 1, page: '',
        keywords: ['asistent', 'ai', 'robot', 'cine esti', 'ce poti', 'ajutor'],
        answer: 'Sunt asistentul local al panelului. Caut exclusiv Ã®n informaÈ›iile proiectului È™i Ã®È›i arÄƒt pagina potrivitÄƒ. Nu caut pe internet È™i nu trimit conversaÈ›ia cÄƒtre un API AI.'
    },
    {
        title: 'CÄƒutarea Ã®n Panel',
        category: 'navigare', role: 1, page: '',
        keywords: ['cautare', 'search', 'searchbar', 'bara cautare', 'gasesc ceva', 'unde gasesc', 'cauta pagina'],
        answer: 'FoloseÈ™te bara de cÄƒutare din header. CÄƒutarea verificÄƒ paginile È™i conÈ›inutul permis rolului tÄƒu È™i te poate trimite direct cÄƒtre modulul potrivit.'
    },
    {
        title: 'Dashboard',
        category: 'navigare', role: 1, page: 'index.html',
        keywords: ['dashboard', 'acasa', 'pagina principala', 'rezumat', 'tura curenta'],
        answer: 'Dashboard-ul afiÈ™eazÄƒ turele de astÄƒzi, timpul lucrat, starea pontajului, urmÄƒtoarea Ã®nvoire È™i acces rapid cÄƒtre secÈ›iunile uzuale.'
    },
    {
        title: 'Pornirea pontajului',
        category: 'pontaj', role: 1, page: 'pontaj.html',
        keywords: ['start pontaj', 'pornesc pontaj', 'incep tura', 'tura zi', 'tura noapte'],
        answer: 'ÃŽn Pontaj alegi mai Ã®ntÃ¢i tipul turei â€” Zi sau Noapte â€” apoi apeÈ™i Start Pontaj. Tura de noapte poate fi pornitÄƒ Ã®ntre 20:00 È™i 22:59, iar sistemul nu permite douÄƒ ture active pentru acelaÈ™i utilizator.'
    },
    {
        title: 'Pontajul dupÄƒ refresh sau schimbarea paginii',
        category: 'pontaj', role: 1, page: 'pontaj.html',
        keywords: ['refresh', 'ies din pagina', 'inchid browser', 'continua timer', 'se reseteaza', 'restaurare tura'],
        answer: 'Tura activÄƒ este salvatÄƒ Ã®n Supabase. DacÄƒ schimbi pagina, dai refresh sau revii dupÄƒ Ã®nchiderea browserului, pontajul activ È™i cronometrul sunt restaurate.'
    },
    {
        title: 'Pauza din pontaj',
        category: 'pontaj', role: 1, page: 'pontaj.html',
        keywords: ['pauza', 'pun pauza', 'reiau tura', 'timp pauza'],
        answer: 'Butonul PauzÄƒ salveazÄƒ starea Ã®n baza de date. La revenirea Ã®n paginÄƒ se restaureazÄƒ È™i pauza, iar timpul de pauzÄƒ poate fi exclus din durata lucratÄƒ.'
    },
    {
        title: 'Oprirea manualÄƒ a pontajului',
        category: 'pontaj', role: 1, page: 'pontaj.html',
        keywords: ['stop pontaj', 'opresc tura', 'inchei tura', 'durata'],
        answer: 'ApasÄƒ Stop Pontaj pentru a Ã®nchide tura. Sistemul calculeazÄƒ durata, actualizeazÄƒ Supabase È™i trimite notificarea configuratÄƒ pentru pontaj.'
    },
    {
        title: 'ÃŽnchiderea automatÄƒ a turelor',
        category: 'pontaj', role: 1, page: 'pontaj.html',
        keywords: ['ora limita', 'oprire automata', 'inchidere automata', '19 59', '23 00', 'program maxim'],
        answer: 'Conform configuraÈ›iei implicite, turele de zi se Ã®nchid automat la 19:59, iar cele de noapte la 23:00, ora RomÃ¢niei. Administratorii pot modifica orele din Panoul Admin.'
    },
    {
        title: 'Trimiterea unei Ã®nvoiri',
        category: 'invoiri', role: 1, page: 'cereri.html',
        keywords: ['invoire', 'cerere', 'absenta', 'concediu', 'medicala', 'indisponibilitate', 'schimb tura'],
        answer: 'ÃŽn Cereri / AbsenÈ›e alegi tipul Ã®nÈ™tiinÈ›Äƒrii, completezi Ã®nceputul, sfÃ¢rÈ™itul È™i motivul, apoi trimiÈ›i formularul. Dovada prin link este opÈ›ionalÄƒ, iar data de sfÃ¢rÈ™it trebuie sÄƒ fie dupÄƒ Ã®nceput. Tipurile disponibile sunt ÃŽnvoire, Concediu, AbsenÈ›Äƒ medicalÄƒ, Schimb de turÄƒ È™i Indisponibilitate.'
    },
    {
        title: 'Modificarea unei Ã®nvoiri',
        category: 'invoiri', role: 1, page: 'cereri.html',
        keywords: ['editez invoirea', 'modific cererea', 'sterg cererea', 'istoric invoiri'],
        answer: 'ÃŽn Istoricul meu de Ã®nÈ™tiinÈ›Äƒri gÄƒseÈ™ti cererile tale È™i opÈ›iunile disponibile pentru modificare sau gestionare.'
    },
    {
        title: 'Craft Mecanics',
        category: 'craft', role: 1, page: 'craftmecanics.html',
        keywords: ['craft', 'reteta', 'unelte', 'masa lucru', 'kit reparatii', 'limitator viteza'],
        answer: 'Craft Mecanics conÈ›ine galeria localÄƒ de reÈ›ete È™i echipamente. PoÈ›i cÄƒuta dupÄƒ numele obiectului, al uneltei, al setului de roÈ›i sau al modelului de jantÄƒ.'
    },
    {
        title: 'Set roÈ›i Runflat',
        category: 'craft', role: 1, page: 'craftmecanics.html?search=Set%20ro%C8%9Bi%20Runflat',
        keywords: ['runflat', 'roti runflat', 'set roti', 'pana'],
        answer: 'Setul de roÈ›i Runflat este prezent Ã®n Craft Mecanics È™i este descris ca un set special care permite rularea Ã®n caz de panÄƒ. Deschide pagina pentru captura È™i detaliile reÈ›etei.'
    },
    {
        title: 'Marketplace intern',
        category: 'marketplace', role: 1, page: 'marketplace.html',
        keywords: ['marketplace', 'anunt', 'vanzare', 'cumparare', 'servicii', 'vehicule', 'case', 'bunuri'],
        answer: 'Marketplace-ul intern permite anunÈ›uri de VÃ¢nzare, CumpÄƒrare sau Servicii, pentru categorii precum Case, Vehicule È™i Bunuri. PreÈ›ul este obligatoriu, poÈ›i adÄƒuga maximum 5 imagini, iar anunÈ›urile pot fi filtrate din aceeaÈ™i paginÄƒ.'
    },
    {
        title: 'Calculatorul ilegal',
        category: 'ilegal', role: 3, page: 'calculatorilegal.html',
        keywords: ['calculator ilegal', 'arme', 'munitie', 'plicuri', 'cocaina', 'marijuana', 'ciuperci', 'materiale'],
        answer: 'Calculatorul ilegal calculeazÄƒ componentele È™i materialele necesare pentru arme, muniÈ›ii, plicuri de cocainÄƒ, marijuana È™i ciuperci. Introdu cantitÄƒÈ›ile dorite Ã®n pagina Calculator Ilegal.'
    },
    {
        title: 'Navy Pistol',
        category: 'ilegal', role: 3, page: 'calculatorilegal.html',
        keywords: ['navy', 'navy pistol', 'cum fac navy', 'cum fac un navy', 'craft navy pistol', 'arma navy'],
        answer: 'Pentru 1 Navy Pistol Ã®n Calculator Ilegal ai nevoie de 1 Blueprint, 6 piese de armÄƒ, 1 ÈšeavÄƒ Rifle È™i 1 Corp Pistol. Echivalentul materialelor brute este 5 Arc, 5 OÈ›el, 5 Plastic È™i 10 Scrap. Deschide Calculator Ilegal È™i introdu cantitatea la Navy Pistol pentru calcul automat.'
    },
    {
        title: 'Combat MG',
        category: 'ilegal', role: 3, page: 'calculatorilegal.html',
        keywords: ['combat mg', 'cum fac combat mg', 'arma combat mg'],
        answer: 'Pentru 1 Combat MG ai nevoie de 1 Blueprint, 4 piese de armÄƒ, 1 ÈšeavÄƒ Rifle, 1 Corp Rifle È™i 1 Butstock. Echivalentul materialelor brute este 6 Arc, 6 OÈ›el, 6 Plastic È™i 12 Scrap.'
    },
    {
        title: 'Assault SMG',
        category: 'ilegal', role: 3, page: 'calculatorilegal.html',
        keywords: ['assault smg', 'cum fac assault smg', 'arma smg'],
        answer: 'Pentru 1 Assault SMG ai nevoie de 1 Blueprint, 4 piese de armÄƒ, 1 ÈšeavÄƒ SMG, 1 Corp Rifle È™i 1 Butstock. Echivalentul materialelor brute este 6 Arc, 6 OÈ›el, 6 Plastic È™i 12 Scrap.'
    },
    {
        title: 'Gadget Pistol',
        category: 'ilegal', role: 3, page: 'calculatorilegal.html',
        keywords: ['gadget pistol', 'cum fac gadget pistol'],
        answer: 'Pentru 1 Gadget Pistol ai nevoie de 1 Blueprint, 20 piese de armÄƒ, 1 ÈšeavÄƒ Rifle, 1 Corp Pistol, 10 Aur, 2 Diamante, 2 Rubine È™i 2 Smaralde. Echivalentul materialelor brute este 12 Arc, 12 OÈ›el, 12 Plastic È™i 24 Scrap.'
    },
    {
        title: 'Shotgun',
        category: 'ilegal', role: 3, page: 'calculatorilegal.html',
        keywords: ['shotgun', 'cum fac shotgun'],
        answer: 'Pentru 1 Shotgun ai nevoie de 4 piese de armÄƒ, 1 ÈšeavÄƒ SMG È™i 1 Corp Pistol. Echivalentul materialelor brute este 4 Arc, 4 OÈ›el, 4 Plastic È™i 8 Scrap.'
    },
    {
        title: 'Raport materiale piesÄƒ brutÄƒ',
        category: 'ilegal', role: 3, page: 'calculatorilegal.html',
        keywords: ['piesa bruta', 'arc', 'otel', 'plastic', 'scrap', 'raport materiale arma'],
        answer: 'Pentru o piesÄƒ brutÄƒ, calculatorul foloseÈ™te raportul: 1 arc, 1 oÈ›el, 1 plastic È™i 2 scrap.'
    },
    {
        title: 'Raport cocainÄƒ È™i marijuana',
        category: 'ilegal', role: 3, page: 'calculatorilegal.html',
        keywords: ['100 plicuri cocaina', 'frunze coca', 'tavi', 'ape', 'brichete', 'joint', 'foita', 'frunze cannabis'],
        answer: 'Pentru 100 de plicuri de cocainÄƒ sunt calculate 1000 frunze, 50 tÄƒvi, 50 ape, 50 brichete È™i 100 plicuri goale. Pentru un joint sunt necesare 20 frunze de cannabis È™i o foiÈ›Äƒ.'
    },
    {
        title: 'LocaÈ›ii ilegale',
        category: 'ilegal', role: 3, page: 'locatiiilegale.html',
        keywords: ['locatii ilegale', 'harta', 'los santos', 'cayo', 'maldive', 'droguri', 'arme', 'rulote', 'topitorie'],
        answer: 'Pagina LocaÈ›ii ilegale afiÈ™eazÄƒ hÄƒrÈ›ile Los Santos, Cayo Perico È™i Maldive. LocaÈ›iile pot fi cÄƒutate, filtrate dupÄƒ categorie È™i salvate la favorite.'
    },
    {
        title: 'Procesarea cocainei È™i cumpÄƒrarea acetonei',
        category: 'ilegal', role: 3, page: 'locatiiilegale.html',
        keywords: ['unde procesez cocaina', 'procesare cocaina', 'cumpar acetona', 'humane labs', 'cayo'],
        answer: 'Procesarea cocainei se aflÄƒ pe Cayo È™i foloseÈ™te frunze de coca plus acetonÄƒ. Punctul de cumpÄƒrare a acetonei este la Humane Labs, Ã®n Los Santos.'
    },
    {
        title: 'Black Market',
        category: 'ilegal', role: 3, page: 'marketplace-ilegal.html',
        keywords: ['black market', 'piata neagra', 'anunt ilegal', 'arme', 'munitie', 'jointuri', 'piese arma'],
        answer: 'Black Market este marketplace-ul pentru rolurile Familia È™i superioare. Include anunÈ›uri pentru Arme, MuniÈ›ie, Plicuri, Jointuri, Piese de armÄƒ È™i Servicii. PreÈ›ul este obligatoriu È™i sunt permise maximum 5 imagini.'
    },
    {
        title: 'TEC-9 / TEC',
        category: 'ilegal', role: 3, page: 'marketplace-ilegal.html',
        keywords: ['tec', 'tec9', 'tec 9', 'tec-9', 'arma tec', 'pistol tec', 'vand tec', 'cumpar tec', 'black market tec'],
        answer: 'Pentru TEC sau TEC-9 mergi Ã®n Black Market. Acolo poÈ›i cÄƒuta anunÈ›uri de vÃ¢nzare, cumpÄƒrare sau servicii pentru aceastÄƒ armÄƒ. FoloseÈ™te cÄƒutarea din paginÄƒ cu â€žTECâ€ sau â€žTEC-9â€.'
    },
    {
        title: 'Rapoarte È™i pontaje active',
        category: 'manager', role: 4, page: 'rapoarte.html',
        keywords: ['rapoarte', 'pontaje active', 'mecanici activi', 'filtru tura', 'export csv', 'discord'],
        answer: 'ÃŽn Rapoarte, managerii pot vedea pontajele active Ã®n timp real, filtra istoricul dupÄƒ perioadÄƒ, tip de turÄƒ sau mecanic È™i exporta datele Ã®n CSV ori trimite raportul selectat pe Discord.'
    },
    {
        title: 'Gestionarea pontajului de cÄƒtre manager',
        category: 'manager', role: 4, page: 'rapoarte.html',
        keywords: ['manager opreste pontaj', 'editeaza pontaj', 'sterge pontaj', 'scoate mecanic din tura'],
        answer: 'Managerii pot edita un pontaj activ, schimba tipul, Ã®nceputul sau starea È™i pot opri tura unui mecanic. Istoricul permite È™i editarea sau È™tergerea Ã®nregistrÄƒrilor, conform permisiunilor.'
    },
    {
        title: 'Gestionarea Ã®nvoirilor de cÄƒtre manager',
        category: 'manager', role: 4, page: 'rapoarte.html',
        keywords: ['manager invoiri', 'editeaza absenta', 'sterge absenta', 'administrare cereri'],
        answer: 'SecÈ›iunea managerialÄƒ din Rapoarte permite vizualizarea, editarea È™i È™tergerea Ã®nvoirilor È™i absenÈ›elor personalului.'
    },
    {
        title: 'Contracte',
        category: 'manager', role: 4, page: 'contracte.html',
        keywords: ['contract', 'angajez', 'manager contract', 'cnp', 'functie mecanic', 'tip contract'],
        answer: 'Pagina Contracte este disponibilÄƒ managerilor. Completezi managerul, angajatul, CNP-ul, telefonul, funcÈ›ia, salariul, programul È™i data Ã®nceperii, apoi poÈ›i genera, previzualiza, copia sau trimite contractul pe Discord È™i Ã®i poÈ›i ataÈ™a imaginile necesare.'
    }
];

window.PANEL_ASSISTANT_PAGES = [
    { file: 'index.html', label: 'Dashboard', role: 1 },
    { file: 'pontaj.html', label: 'Pontaj', role: 1 },
    { file: 'bucatarie.html', label: 'BucÄƒtÄƒrie', role: 1 },
    { file: 'anunturi.html', label: 'AnunÈ›uri È™i sondaje', role: 1 },
    { file: 'cereri.html', label: 'Cereri / AbsenÈ›e', role: 1 },
    { file: 'craftmecanics.html', label: 'Craft Mecanics', role: 1 },
    { file: 'marketplace.html', label: 'Marketplace', role: 1 },
    { file: 'calculator.html', label: 'Calculator', role: 1 },
    { file: 'calculatorilegal.html', label: 'Calculator Ilegal', role: 3 },
    { file: 'locatiiilegale.html', label: 'LocaÈ›ii Ilegale', role: 3 },
    { file: 'marketplace-ilegal.html', label: 'Black Market', role: 3 },
    { file: 'rapoarte.html', label: 'Rapoarte', role: 4 },
    { file: 'contracte.html', label: 'Contracte', role: 4 },
    { file: 'asistent.html', label: 'Asistent', role: 1 },
    { file: 'status-live.html', label: 'Status live', role: 1 },
    { file: 'admin.html', label: 'Panou Admin', role: 7 },
    { file: 'logs.html', label: 'Loguri', role: 7 },
    { file: 'diagnostic.html', label: 'Diagnostic', role: 7 },
    { file: 'discord-configurare.html', label: 'Configurare Discord', role: 7 },
    { file: 'organizatii.html', label: 'OrganizaÈ›ii', role: 7 },
    { file: 'vouchere.html', label: 'Vouchere', role: 7 },
    { file: 'developer.html', label: 'Developer', role: 7 },
    { file: 'administrare-organizatie.html', label: 'Administrare organizaÈ›ie', role: 99 }
];

