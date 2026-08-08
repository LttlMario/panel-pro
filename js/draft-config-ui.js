(() => {
  if (!location.pathname.endsWith('creare-organizatie-voucher.html')) return;
  const form = document.getElementById('create');
  if (!form) return;

  const pages = [
    ['index.html', 'Dashboard'], ['anunturi.html', 'Anunțuri și sondaje'], ['pontaj.html', 'Pontaj'],
    ['cereri.html', 'Cereri și absențe'], ['bucatarie.html', 'Bucătărie'], ['contracte.html', 'Contracte'],
    ['calculatorilegal.html', 'Calculator ilegal'], ['craftmecanics.html', 'Craft mecanics'],
    ['locatiiilegale.html', 'Locații ilegale'], ['marketplace.html', 'Marketplace'],
    ['marketplace-ilegal.html', 'Marketplace ilegal'], ['rapoarte.html', 'Rapoarte'], ['asistent.html', 'Asistent']
  ];
  const webhookDefinitions = [
    ['organization', 'Organizație', 'Anunțuri și notificări generale'],
    ['departments', 'Birouri / angajați', 'Anunțuri pentru departamente și angajați'],
    ['pontaj', 'Pontaj și ture', 'Pornire, oprire și închidere automată'],
    ['requests', 'Cereri și învoiri', 'Cereri și actualizări de absențe'],
    ['contracts', 'Contracte', 'Contracte create sau actualizate'],
    ['marketplace', 'Marketplace legal', 'Anunțuri marketplace normal'],
    ['illegal_marketplace', 'Marketplace ilegal', 'Anunțuri marketplace ilegal']
  ];
  const defaultTemplate = `CONTRACT INDIVIDUAL\n\nAngajator: {{COMPANY}}, reprezentată de {{MANAGER}}.\nAngajat: {{EMPLOYEE_NAME}}, CNP {{CNP}}, telefon {{PHONE}}.\nFuncție: {{POSITION}}.\nSalariu: {{SALARY}}.\nProgram: {{PROGRAM}}.\nData începerii: {{START_DATE}}.\nNumăr contract: {{CONTRACT_NUMBER}}.`;

  const box = document.createElement('section');
  box.id = 'draft-config';
  box.hidden = true;
  box.className = 'mt-6 rounded-2xl border border-indigo-700/50 bg-slate-900 p-5';
  box.innerHTML = `<h2 class="text-xl font-black">Finalizează organizația Draft</h2><p class="mt-2 text-sm text-slate-400">Ai acces doar la configurarea acestei organizații. Alege guildul, rolurile, paginile, webhook-urile și contractul, apoi activează organizația.</p><div class="mt-4 space-y-4"><div class="flex flex-wrap gap-2"><input id="draft-config-guild" inputmode="numeric" class="min-w-64 flex-1 rounded-xl border border-slate-700 bg-slate-950 p-3" placeholder="Guild ID Discord"><button id="draft-config-attach-guild" type="button" class="rounded-xl bg-cyan-700 px-4 py-3 font-bold">Adaugă și verifică guildul</button></div><p id="draft-guild-status" class="text-xs text-slate-400"></p><input id="draft-config-logo" type="url" class="w-full rounded-xl border border-slate-700 bg-slate-950 p-3" placeholder="Logo organizație (opțional)"><details class="rounded-xl border border-slate-700 p-4" open><summary class="cursor-pointer font-bold">Acces pe pagini în funcție de rol</summary><p class="mt-2 text-xs text-slate-400">După citirea rolurilor, bifează rolurile care pot deschide fiecare pagină. Nivelul numeric al rolului răm�ne separat de aceste permisiuni.</p><div id="draft-page-permissions" class="mt-4 space-y-3"><p class="text-xs text-slate-500">Adaugă guildul și citește rolurile pentru a configura paginile.</p></div></details><details class="rounded-xl border border-slate-700 p-4"><summary class="cursor-pointer font-bold">Webhook-uri pe secțiuni</summary><p class="mt-2 text-xs text-slate-400">Fiecare webhook se salvează numai în organizația creată. Pentru anunțuri există separat Organizație și Birouri / angajați.</p><div id="draft-webhooks" class="mt-4 grid gap-3 md:grid-cols-2"></div></details><details class="rounded-xl border border-amber-700/60 bg-amber-950/20 p-4" open><summary class="cursor-pointer font-bold">Contractul organizației</summary><p class="mt-2 text-xs leading-5 text-amber-100/80">Completează șablonul o singură dată. Organizația și datele implicite se citesc automat la generare; în pagina Contracte vor răm�ne de completat în mod normal doar numele angajatului, CNP-ul și telefonul.</p><p class="mt-2 text-xs text-slate-300"><b>Variabile:</b> {{COMPANY}} companie · {{MANAGER}} manager · {{EMPLOYEE_NAME}} angajat · {{CNP}} CNP · {{PHONE}} telefon · {{POSITION}} funcție · {{SALARY}} salariu · {{PROGRAM}} program · {{START_DATE}} data începerii · {{CONTRACT_NUMBER}} număr contract.</p><input id="draft-contract-title" class="mt-3 w-full rounded-xl border border-slate-700 bg-slate-950 p-3" placeholder="Titlu contract"><input id="draft-contract-salary" class="mt-3 w-full rounded-xl border border-slate-700 bg-slate-950 p-3" placeholder="Salariu implicit, ex. 100 lei/lună"><textarea id="draft-contract-template" class="mt-3 min-h-48 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 font-mono text-xs" placeholder="Șablonul contractului"></textarea></details><div class="flex flex-wrap gap-2"><button id="draft-config-save" type="button" class="rounded-xl bg-indigo-700 px-5 py-3 font-bold">Salvează configurația</button><button id="draft-config-finalize" type="button" class="rounded-xl bg-emerald-700 px-5 py-3 font-bold">Creează organizația și intră în panel</button></div><p id="draft-config-status" class="text-sm text-slate-400"></p></div>`;
  form.parentElement.appendChild(box);
  const announcementBox = document.createElement('div');
  announcementBox.className = 'mt-4 rounded-xl border border-amber-700/60 bg-amber-950/10 p-4';
  announcementBox.innerHTML = '<b class="text-sm">Permisiuni Anunțuri</b><p class="mt-1 text-xs text-slate-400">Introdu nivelurile care pot citi și publica Anunțuri, separate prin virgulă.</p><div class="mt-3 grid gap-3 md:grid-cols-2"><input id="draft-announcement-read" class="w-full rounded-xl border border-slate-700 bg-slate-950 p-3" placeholder="Pot citi: 1,2,3"><input id="draft-announcement-write" class="w-full rounded-xl border border-slate-700 bg-slate-950 p-3" placeholder="Pot publica: 6,7"></div>';
  box.appendChild(announcementBox);

  let organizationId = '';
  let availableRoles = [];
  let pagePermissions = {};
  const config = () => window.PANEL_SUPABASE_CONFIG;
  const accessToken = () => localStorage.getItem('discord_access_token') || '';
  const voucherCode = () => document.getElementById('voucher')?.value.trim().toUpperCase() || '';
  const status = () => document.getElementById('draft-config-status');
  const call = (path, body) => fetch(`${config().url}/functions/v1/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: config().publishableKey, Authorization: `Bearer ${config().publishableKey}` }, body: JSON.stringify(body) });

  document.getElementById('draft-webhooks').innerHTML = webhookDefinitions.map(([key, label, help]) => `<fieldset class="rounded-xl border border-slate-700 p-3"><legend class="px-1 text-sm font-bold">${label}</legend><small class="mb-2 block text-slate-500">${help}</small><input data-draft-webhook="${key}" data-target="primary" type="url" class="w-full rounded-xl border border-slate-700 bg-slate-950 p-2 text-xs" placeholder="Webhook principal (opțional)"><input data-draft-webhook="${key}" data-target="secondary" type="url" class="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 p-2 text-xs" placeholder="Webhook secundar (opțional)"></fieldset>`).join('');

  const renderPages = () => {
    const host = document.getElementById('draft-page-permissions');
    if (!availableRoles.length) { host.innerHTML = '<p class="text-xs text-slate-500">Adaugă guildul și citește rolurile pentru a configura paginile.</p>'; return; }
    host.innerHTML = pages.map(([page, label]) => `<div class="rounded-xl border border-slate-700 bg-slate-950 p-3"><b class="text-sm">${label}</b><div class="mt-2 flex flex-wrap gap-2">${availableRoles.map(role => `<label class="flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs"><input type="checkbox" data-draft-page="${page}" data-draft-page-role="${role.id}" ${(pagePermissions[page] || []).includes(String(role.id)) ? 'checked' : ''}><span>${String(role.name).replace(/[<>]/g, '')}</span></label>`).join('')}</div></div>`).join('');
    host.querySelectorAll('[data-draft-page-role]').forEach((input) => input.onchange = () => {
      const page = input.dataset.draftPage;
      const selected = new Set(pagePermissions[page] || []);
      input.checked ? selected.add(input.dataset.draftPageRole) : selected.delete(input.dataset.draftPageRole);
      pagePermissions[page] = [...selected];
    });
  };
  window.renderDraftPagePermissions = (roles) => { availableRoles = Array.isArray(roles) ? roles : []; renderPages(); };
  window.setDraftOrganizationId = (id) => { organizationId = id || ''; window.draftOrganizationId = organizationId; box.hidden = !organizationId; if (organizationId) box.scrollIntoView({ behavior: 'smooth' }); };

  const collectWebhooks = () => {
    const routes = {};
    document.querySelectorAll('[data-draft-webhook]').forEach((input) => {
      const value = input.value.trim();
      if (!value) return;
      const key = input.dataset.draftWebhook;
      routes[key] ||= {};
      routes[key][input.dataset.target] = { enabled: true, url: value };
    });
    return routes;
  };
  window.saveDraftConfiguration = async ({ silent = false } = {}) => {
    if (!organizationId) throw new Error('Creează mai înt�i organizația Draft.');
    const contractTitle = document.getElementById('draft-contract-title').value.trim();
    const contractTemplate = document.getElementById('draft-contract-template').value.trim();
    const contractSalary = document.getElementById('draft-contract-salary').value.trim();
    const levels = (id) => [...new Set(document.getElementById(id).value.split(',').map((value) => Number(value.trim())).filter((value) => Number.isInteger(value) && value >= 1 && value <= 99))];
    const body = { access_token: accessToken(), organization_id: organizationId, logo_url: document.getElementById('draft-config-logo').value.trim(), webhook_routes: collectWebhooks(), page_permissions: pagePermissions, announcement_permissions: { read: levels('draft-announcement-read'), write: levels('draft-announcement-write') } };
    if (contractTitle || contractTemplate || contractSalary) body.contract_template = { title: contractTitle, template: contractTemplate || defaultTemplate, defaults: { salary: contractSalary } };
    const response = await call('manage-draft-organization', body);
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Salvarea configurației a eșuat.');
    if (!silent) status().textContent = 'Configurația, paginile, webhook-urile și contractul au fost salvate.';
    return result;
  };

  const originalFetch = window.fetch;
  window.fetch = async (url, options) => {
    const response = await originalFetch(url, options);
    if (String(url).includes('create-voucher-organization')) {
      try { const result = await response.clone().json(); if (result.organization?.id) { window.setDraftOrganizationId(result.organization.id); const guildId = result.guild_id || document.getElementById('guild').value; if (guildId) { document.getElementById('guild').value = guildId; document.getElementById('draft-config-guild').value = guildId; } } } catch (_) { /* răspunsul nu este JSON */ }
    }
    return response;
  };

  document.getElementById('draft-config-attach-guild').onclick = async () => {
    const guildId = document.getElementById('draft-config-guild').value.trim();
    if (!organizationId) { status().textContent = 'Creează mai înt�i organizația Draft.'; return; }
    if (!/^\d{15,22}$/.test(guildId)) { status().textContent = 'Guild ID invalid.'; return; }
    const button = document.getElementById('draft-config-attach-guild'); button.disabled = true; document.getElementById('draft-guild-status').textContent = 'Se verifică botul și apartenența la guild...';
    try {
      const response = await call('manage-draft-organization', { action: 'attach_guild', access_token: accessToken(), voucher_code: voucherCode(), organization_id: organizationId, guild_id: guildId });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Guildul nu a putut fi adăugat.');
      document.getElementById('guild').value = guildId; document.getElementById('draft-guild-status').textContent = `Guild adăugat: ${result.guild_name || guildId}. Apasă verificarea rolurilor.`;
    } catch (error) { document.getElementById('draft-guild-status').textContent = error.message || 'Guildul nu a putut fi adăugat.'; }
    button.disabled = false;
  };
  document.getElementById('draft-config-save').onclick = async () => { try { await window.saveDraftConfiguration(); } catch (error) { status().textContent = error.message; } };
  document.getElementById('draft-config-finalize').onclick = async () => {
    const button = document.getElementById('draft-config-finalize'); button.disabled = true;
    try {
      await window.saveDraftConfiguration({ silent: true });
      status().textContent = 'Se verifică rolurile și se activează organizația...';
      const response = await call('finalize-organization', { access_token: accessToken(), voucher_code: voucherCode(), organization_id: organizationId });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Organizația nu a putut fi finalizată.');
      if (result.session_token) {
        localStorage.setItem('discord_user', JSON.stringify(result.user)); localStorage.setItem('user_role', result.user?.role || 'Administrator'); localStorage.setItem('discord_access_token', accessToken()); localStorage.setItem('panel_session_token', result.session_token); localStorage.setItem('panel_session_expires_at', result.expires_at); localStorage.setItem('panel_active_organization', JSON.stringify(result.active_organization)); localStorage.setItem('panel_organizations', JSON.stringify(result.organizations || []));
      }
      window.location.href = 'index.html';
    } catch (error) { status().textContent = error.message || 'Activarea a eșuat.'; button.disabled = false; }
  };
  renderPages();
})();
