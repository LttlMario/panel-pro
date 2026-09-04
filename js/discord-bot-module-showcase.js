(() => {
  const gate = document.getElementById('access-gate');
  if (!gate) return;
  const modules = [
    ['module-pontaj.png', '🕒 Pontaj și ture', 'FREE', 'Membrii pornesc tura, intră în pauză și opresc pontajul direct din Discord. Fiecare persoană își poate consulta situația.'],
    ['module-invoiri-organizatie.png', '📝 Învoiri organizație', 'PREMIUM', 'Responsabilii primesc și gestionează cererile de învoire ale organizației, cu istoric și aprobare rapidă.'],
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
  const hoverStyle = document.createElement('style');
  hoverStyle.textContent = '.module-showcase .showcase-module-card{transition:transform .2s ease,border-color .2s ease,box-shadow .2s ease}.module-showcase .showcase-module-card.is-image-hovered{transform:translateY(-4px);border-color:rgba(167,139,250,.72);box-shadow:0 12px 30px rgba(2,6,23,.34)}.module-showcase .showcase-module-card img{cursor:zoom-in;transition:transform .2s ease,filter .2s ease}.module-showcase .showcase-module-card.is-image-hovered img{transform:scale(1.03);filter:brightness(1.08) saturate(1.06)}';
  document.head.appendChild(hoverStyle);
  section.innerHTML = `<div class="mb-5"><p class="text-xs font-black uppercase tracking-[.2em] text-indigo-300">Vezi cum funcționează</p><h2 class="mt-1 text-2xl font-black">Modulele Panel Pro Discord</h2><p class="mt-2 max-w-3xl text-sm leading-6 text-slate-400">Botul este separat de panelul web și funcționează direct pe serverul tău Discord. Fiecare modul are embedul și canalul de log configurabile separat.</p></div><div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">${modules.map(([image, title, plan, description]) => `<article class="showcase-module-card overflow-hidden rounded-xl border border-slate-700 bg-slate-900/80"><img src="img/${image}" alt="${title}" loading="lazy" decoding="async" class="h-40 w-full object-contain bg-[#202126] p-2"><div class="p-4"><div class="flex items-start justify-between gap-3"><h3 class="font-black">${title}</h3><span class="shrink-0 rounded-lg border px-3 py-1.5 text-[10px] font-black tracking-wider shadow-sm ${plan === 'FREE' ? 'border-emerald-300/70 bg-emerald-500 text-emerald-950 shadow-emerald-500/20' : 'border-violet-300/70 bg-violet-500 text-white shadow-violet-500/20'}" style="${plan === 'PREMIUM' ? 'border-color:#c4b5fd;background:#8b5cf6;color:#fff;box-shadow:0 4px 16px rgba(139,92,246,.28)' : ''}">${plan}</span></div><p class="mt-2 text-xs leading-5 text-slate-400">${description}</p></div></article>`).join('')}</div><div class="mt-5 grid gap-3 sm:grid-cols-3"><div class="rounded-xl p-4 shadow-lg" style="border:2px solid rgba(110,231,183,.72);border-radius:14px;background:rgba(16,185,129,.15);box-shadow:0 8px 22px rgba(16,185,129,.12)"><strong class="text-lg text-emerald-200">FREE</strong><p class="mt-1 text-xs text-slate-300">Pontaj și învoiri angajați.</p></div><div class="rounded-xl p-4 shadow-lg" style="border:2px solid rgba(252,211,77,.72);border-radius:14px;background:rgba(245,158,11,.15);box-shadow:0 8px 22px rgba(245,158,11,.12)"><strong class="text-lg text-amber-200">TRIAL 30 ZILE</strong><p class="mt-1 text-xs text-slate-300">Acces complet la toate modulele, fără plată.</p></div><div class="rounded-xl p-4 shadow-lg" style="border:2px solid rgba(196,181,253,.78);border-radius:14px;background:rgba(139,92,246,.16);box-shadow:0 8px 22px rgba(139,92,246,.14)"><strong class="text-lg text-violet-200">PREMIUM</strong><p class="mt-1 text-xs text-slate-300">Toate modulele și funcțiile disponibile.</p></div></div>`;
  gate.appendChild(section);
  section.querySelectorAll('img').forEach((image) => {
    image.classList.add('cursor-zoom-in');
    const card = image.closest('.showcase-module-card');
    image.addEventListener('mouseenter', () => card?.classList.add('is-image-hovered'));
    image.addEventListener('mouseleave', () => card?.classList.remove('is-image-hovered'));
  });
  const close = () => document.getElementById('module-image-modal')?.remove();
  section.addEventListener('click', (event) => {
    const image = event.target.closest('img');
    if (!image) return;
    const modal = document.createElement('div');
    modal.id = 'module-image-modal';
    modal.className = 'fixed inset-0 z-50 flex cursor-zoom-out items-center justify-center bg-slate-950/72 p-4 backdrop-blur-[2px]';
    modal.innerHTML = `<button type="button" aria-label="Închide imaginea" class="absolute right-5 top-5 rounded-full bg-white/10 px-4 py-2 text-2xl text-white hover:bg-white/20">×</button><img src="${image.src}" alt="${image.alt}" class="max-h-[92vh] max-w-[96vw] rounded-xl object-contain shadow-2xl">`;
    modal.addEventListener('click', (modalEvent) => { if (modalEvent.target === modal || modalEvent.target.tagName === 'BUTTON') close(); });
    document.body.appendChild(modal);
  });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') close(); });
})();
