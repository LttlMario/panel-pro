(() => {
  const gate = document.getElementById('access-gate');
  if (!gate) return;
  const modules = [
    ['module-pontaj.png', '🕒 Pontaj și ture', 'FREE', 'Membrii pornesc tura, intră în pauză și opresc pontajul direct din Discord. Fiecare persoană își poate consulta situația.'],
    ['module-invoiri-organizatie.png', '📝 Învoiri organizație', 'FREE', 'Responsabilii primesc și gestionează cererile de învoire ale organizației, cu istoric și aprobare rapidă.'],
    ['module-invoiri-angajati.png', '📝 Învoiri angajați', 'FREE', 'Angajații trimit cereri de învoire, iar statusul lor poate fi urmărit direct din server.'],
    ['module-anunturi-organizatie.png', '📢 Anunțuri organizație', 'PREMIUM', 'Publică anunțuri, întrebări și sondaje interactive pentru întreaga organizație.'],
    ['module-anunturi-angajati.png', '📢 Anunțuri angajați', 'PREMIUM', 'Comunică rapid cu angajații prin anunțuri, întrebări și sondaje cu butoane.'],
    ['module-contracte.png', '📄 Contracte', 'PREMIUM', 'Configurează un șablon propriu și generează contracte completate automat cu datele angajatului.'],
    ['module-actiuni.png', '🎯 Acțiuni și disciplină', 'PREMIUM', 'Înregistrează acțiuni, avertismente și sancțiuni, cu evidență clară și log separat.'],
    ['module-stash.png', '📦 Stash', 'PREMIUM', 'Gestionează articolele, cererile și donațiile Stash, cu aprobare administrativă și loguri separate.'],
    ['module-status-live.png', '📡 Status live', 'PREMIUM', 'Afișează automat cine este în pontaj, cine este în pauză și totalurile actualizate ale serverului.']
  ];
  const section = document.createElement('section');
  section.className = 'module-showcase mt-8 rounded-2xl border border-slate-700 bg-slate-950/50 p-5 text-left';
  section.innerHTML = `<div class="mb-5"><p class="text-xs font-black uppercase tracking-[.2em] text-indigo-300">Vezi cum funcționează</p><h2 class="mt-1 text-2xl font-black">Modulele Panel Pro Discord</h2><p class="mt-2 max-w-3xl text-sm leading-6 text-slate-400">Botul este separat de panelul web și funcționează direct pe serverul tău Discord. Fiecare modul are embedul și canalul de log configurabile separat.</p></div><div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">${modules.map(([image, title, plan, description]) => `<article class="overflow-hidden rounded-xl border border-slate-700 bg-slate-900/80"><img src="img/${image}" alt="${title}" loading="lazy" decoding="async" class="h-40 w-full object-contain bg-[#202126] p-2"><div class="p-4"><div class="flex items-start justify-between gap-3"><h3 class="font-black">${title}</h3><span class="shrink-0 rounded-full px-2 py-1 text-[10px] font-black ${plan === 'FREE' ? 'bg-emerald-500/20 text-emerald-200' : 'bg-indigo-500/20 text-indigo-200'}">${plan}</span></div><p class="mt-2 text-xs leading-5 text-slate-400">${description}</p></div></article>`).join('')}</div><div class="mt-5 grid gap-3 sm:grid-cols-3"><div class="rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-4"><strong class="text-emerald-200">Free</strong><p class="mt-1 text-xs text-slate-300">Pontaj și ambele module de învoiri.</p></div><div class="rounded-xl border border-amber-400/20 bg-amber-500/10 p-4"><strong class="text-amber-200">Trial 30 zile</strong><p class="mt-1 text-xs text-slate-300">Acces complet la toate modulele, fără plată.</p></div><div class="rounded-xl border border-indigo-400/20 bg-indigo-500/10 p-4"><strong class="text-indigo-200">Premium</strong><p class="mt-1 text-xs text-slate-300">Toate modulele și funcțiile disponibile.</p></div></div>`;
  gate.appendChild(section);
})();
