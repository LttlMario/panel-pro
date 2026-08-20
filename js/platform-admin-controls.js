(() => {
  'use strict';
  if (!/admin\.html$/i.test(location.pathname) || window.__platformAdminControlsLoaded) return;
  window.__platformAdminControlsLoaded = true;

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  const validDiscordId = value => /^\d{15,22}$/.test(String(value || '').trim());

  function makeCollapsible() {
    const main = document.querySelector('main');
    if (!main || main.dataset.compactAdminReady) return;
    main.dataset.compactAdminReady = '1';
    const titles = new Map([
      ['Configurare server Discord', 'Configurare server Discord'],
      ['Membri și administrare utilizatori', 'Membri și administrare utilizatori'],
      ['Utilizatori online în panel', 'Utilizatori online în panel'],
      ['Configurare Pagini Web', 'Configurare Pagini Web'],
      ['Setări Avansate Pontaje', 'Setări Avansate Pontaje'],
    ]);
    [...main.children].forEach(section => {
      if (!(section instanceof HTMLElement) || section.id === 'platform-admin-center' || section.classList.contains('panel-action-bar') || section.dataset.compactSection) return;
      const heading = section.querySelector('h3');
      const title = heading && titles.get(heading.textContent.trim());
      if (!title) return;
      const details = document.createElement('details');
      details.className = 'bg-slate-900 border border-slate-800 rounded-2xl shadow-lg overflow-hidden';
      details.open = title === 'Membri și administrare utilizatori';
      const nextSection = section.nextElementSibling;
      const summary = document.createElement('summary');
      summary.className = 'cursor-pointer list-none px-6 py-5 text-sm font-bold text-slate-100 hover:bg-slate-800/40 transition';
      summary.innerHTML = `<span class="mr-2 text-emerald-400">▸</span>${escapeHtml(title)}`;
      details.append(summary, section);
      section.dataset.compactSection = '1';
      section.classList.remove('rounded-2xl', 'shadow-lg');
      main.insertBefore(details, nextSection);
      details.addEventListener('toggle', () => { summary.querySelector('span').textContent = details.open ? '▾' : '▸'; });
    });
  }

  function createPanel() {
    if (document.getElementById('platform-admin-center')) return;
    const main = document.querySelector('main');
    if (!main) return;
    const panel = document.createElement('section');
    panel.id = 'platform-admin-center';
    panel.className = 'bg-slate-900 border border-indigo-500/30 rounded-2xl shadow-lg overflow-hidden';
    panel.innerHTML = `
      <details open>
        <summary class="cursor-pointer list-none px-6 py-5 flex items-center justify-between gap-4 hover:bg-slate-800/40 transition">
          <span><strong class="block text-base text-slate-100">Administrare platformă</strong><small class="block text-xs text-slate-400 mt-1">Administratori suplimentari, acces și blocarea conturilor.</small></span>
          <span class="text-indigo-300 text-xs font-semibold">▾ Secțiune</span>
        </summary>
        <div class="p-6 space-y-6 border-t border-slate-800">
          <div>
            <h4 class="text-sm font-bold text-slate-100">Administratori platformă</h4>
            <p class="text-xs text-slate-400 mt-1">Administratorii adăugați aici primesc aceleași drepturi globale în panel. Administratorii principali din configurarea serverului nu pot fi eliminați din această listă.</p>
            <div class="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3 mt-4">
              <input id="platform-admin-discord-id" inputmode="numeric" maxlength="22" placeholder="Discord ID" class="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-indigo-500">
              <input id="platform-admin-display-name" maxlength="120" placeholder="Nume afișat (opțional)" class="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-indigo-500">
              <button id="platform-admin-add" type="button" class="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl text-xs font-semibold">+ Adaugă administrator</button>
            </div>
            <div id="platform-admin-list" class="mt-4 space-y-2"><p class="text-xs text-slate-500">Se încarcă administratorii…</p></div>
          </div>
          <div class="border-t border-slate-800 pt-6">
            <h4 class="text-sm font-bold text-slate-100">Conturi blocate</h4>
            <p class="text-xs text-slate-400 mt-1">Ban-ul revocă sesiunile active și împiedică autentificarea până la unban.</p>
            <div id="platform-ban-list" class="mt-4 space-y-2"><p class="text-xs text-slate-500">Se încarcă lista de ban-uri…</p></div>
          </div>
        </div>
      </details>`;
    const actionBar = main.querySelector('.panel-action-bar');
    main.insertBefore(panel, actionBar?.nextSibling || main.firstChild);
    panel.querySelector('#platform-admin-add').addEventListener('click', addPlatformAdmin);
  }

  async function loadPlatformAdminData() {
    if (typeof window.panelAdminInvoke !== 'function') return false;
    const panel = document.getElementById('platform-admin-center');
    if (!panel) return false;
    try {
      const [admins, bans] = await Promise.all([
        window.panelAdminInvoke('platform_admins'),
        window.panelAdminInvoke('platform_bans'),
      ]);
      renderAdmins(admins.administrators || []);
      renderBans(bans.bans || []);
    } catch (error) {
      panel.querySelector('#platform-admin-list').innerHTML = `<p class="text-xs text-rose-300">Nu s-au putut încărca setările: ${escapeHtml(error.message)}</p>`;
      panel.querySelector('#platform-ban-list').innerHTML = '';
    }
    return true;
  }

  function renderAdmins(items) {
    const host = document.getElementById('platform-admin-list');
    if (!host) return;
    host.innerHTML = items.length ? items.map(item => `
      <div class="flex flex-wrap items-center justify-between gap-3 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3">
        <div><span class="font-mono text-xs text-slate-200">${escapeHtml(item.discord_id)}</span><span class="ml-3 text-xs text-slate-400">${escapeHtml(item.display_name || 'Administrator')}</span>${item.root ? '<span class="ml-3 text-[10px] uppercase tracking-wider text-emerald-300">principal</span>' : ''}${item.active === false ? '<span class="ml-3 text-[10px] uppercase tracking-wider text-rose-300">inactiv</span>' : ''}</div>
        ${item.root ? '<span class="text-[10px] uppercase tracking-wider text-slate-500">protejat</span>' : item.active === false ? '' : `<button type="button" data-remove-admin="${escapeHtml(item.discord_id)}" title="Revocă administratorul și deloghează sesiunile active" class="bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 px-3 py-1.5 rounded-lg text-xs font-semibold">⛔ Remove admin + Kick</button>`}
      </div>`).join('') : '<p class="text-xs text-slate-500">Nu există administratori suplimentari.</p>';
    host.querySelectorAll('[data-remove-admin]').forEach(button => button.addEventListener('click', () => removePlatformAdmin(button.dataset.removeAdmin)));
  }

  function renderBans(items) {
    const host = document.getElementById('platform-ban-list');
    if (!host) return;
    host.innerHTML = items.length ? items.map(item => `
      <div class="flex flex-wrap items-center justify-between gap-3 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3">
        <div><span class="font-mono text-xs text-slate-200">${escapeHtml(item.discord_id)}</span><span class="ml-3 text-xs text-slate-400">${escapeHtml(item.reason || 'Blocat de administrator')}</span><span class="ml-3 text-[10px] uppercase tracking-wider ${item.active ? 'text-rose-300' : 'text-slate-500'}">${item.active ? 'activ' : 'ridicat'}</span></div>
        ${item.active ? `<button type="button" data-unban="${escapeHtml(item.discord_id)}" class="bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30 px-3 py-1.5 rounded-lg text-xs font-semibold">Unban</button>` : ''}
      </div>`).join('') : '<p class="text-xs text-slate-500">Nu există conturi blocate.</p>';
    host.querySelectorAll('[data-unban]').forEach(button => button.addEventListener('click', () => unbanUser(button.dataset.unban)));
  }

  async function addPlatformAdmin() {
    const idInput = document.getElementById('platform-admin-discord-id');
    const nameInput = document.getElementById('platform-admin-display-name');
    const discordId = idInput.value.trim();
    if (!validDiscordId(discordId)) return alert('Introdu un Discord ID valid, format din 15–22 cifre.');
    try {
      await window.panelAdminInvoke('platform_admin_add', { discord_id: discordId, display_name: nameInput.value.trim() });
      idInput.value = ''; nameInput.value = '';
      await loadPlatformAdminData();
      alert('Administratorul a fost adăugat. La următoarea autentificare va primi acces global.');
    } catch (error) { alert(`Administratorul nu a putut fi adăugat: ${error.message}`); }
  }

  async function removePlatformAdmin(discordId) {
    if (!confirm(`Revoci administratorul ${discordId} și îi deloghezi sesiunile active?`)) return;
    try { await window.panelAdminInvoke('platform_admin_remove', { discord_id: discordId }); await loadPlatformAdminData(); alert('Administratorul a fost eliminat și sesiunile active au fost închise.'); }
    catch (error) { alert(`Accesul nu a putut fi eliminat: ${error.message}`); }
  }

  async function unbanUser(discordId) {
    if (!confirm(`Ridici ban-ul pentru ${discordId}?`)) return;
    try { await window.panelAdminInvoke('platform_unban', { discord_id: discordId }); await loadPlatformAdminData(); alert('Ban-ul a fost ridicat.'); }
    catch (error) { alert(`Ban-ul nu a putut fi ridicat: ${error.message}`); }
  }

  function boot() {
    makeCollapsible();
    createPanel();
    let attempts = 0;
    const waitForAdminApi = () => {
      if (typeof window.panelAdminInvoke === 'function') { loadPlatformAdminData(); return; }
      if (attempts++ > 40) return;
      window.setTimeout(waitForAdminApi, 250);
    };
    waitForAdminApi();
  }
  document.addEventListener('DOMContentLoaded', boot);
})();
