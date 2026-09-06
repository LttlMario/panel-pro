(() => {
  'use strict';
  const root = document.getElementById('discord-bundle-templates');
  if (!root || typeof isPlatformAdmin !== 'function' || !isPlatformAdmin() || typeof window.panelRequestJson !== 'function') return;

  const $ = (id) => document.getElementById(id);
  const select = $('discord-bundle-select');
  const preview = $('discord-bundle-preview');
  const status = $('discord-bundle-status');
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  const call = (body) => window.panelRequestJson('manage-platform-pages', { method: 'POST', body: JSON.stringify(body), timeoutMs: 30000 });
  const moduleCall = (body) => window.panelRequestJson('manage-panel-modules', { method: 'POST', body: JSON.stringify(body), timeoutMs: 30000 });
  const installCall = (body) => window.panelRequestJson('manage-discord-bundles', { method: 'POST', body: JSON.stringify(body), timeoutMs: 60000 });

  const form = (fields) => fields.map((field) => ({ id: field[0], label: field[1], type: field[2] || 'short_text', required: field[3] !== false, max_length: field[2] === 'long_text' ? 1500 : 300 }));
  const workflow = (review = false) => ({ logging_enabled: true, actions: review ? ['review_buttons', 'send_log', 'update_message', 'notify_submitter'] : ['send_log', 'update_message'] });
  const moduleDefinition = (title, description, color, handler, fields, buttons, review = false) => ({
    title, description, color, handler, form_schema: form(fields), buttons,
    workflow: workflow(review),
    responses: {
      success: review ? 'Cererea a fost trimisă pentru aprobare. Rezultatul va apărea în canalul configurat.' : 'Informația a fost salvată și trimisă în canalul de rezultate.',
      review: 'Cererea a fost trimisă pentru aprobare.',
      error: 'Nu am putut procesa solicitarea. Încearcă din nou.'
    },
    footer: 'Panel Pro · bot Discord'
  });
  const open = (label, style = 1) => ({ label, action: 'open_form', style });
  const reportButton = (label = 'Vezi raportul') => ({ label, action: 'report', style: 1 });

  const bundles = {
    full: {
      label: '🧰 Full · toate modulele de bază',
      description: 'Pachet complet pentru o organizație Panel Pro: comunicare, cereri, aprobări, documente, pontaj și rapoarte.',
      modules: [
        ['custom_full_anunturi', 'Anunțuri organizație', 'Publică anunțuri și comunicate.','announcement',0x5865f2, [['message','Mesajul anunțului','long_text']], [open('Publică anunț')]],
        ['custom_full_cereri', 'Cereri organizație', 'Colectează cereri de la membrii organizației.','request',0x3b82f6, [['subject','Subiect'],['details','Detalii','long_text']], [open('Trimite cerere')]],
        ['custom_full_aprobari', 'Cereri cu aprobare', 'Trimite cereri către staff pentru aprobare sau respingere.','approval',0xf59e0b, [['subject','Subiect'],['details','Detalii','long_text']], [open('Trimite spre aprobare',3)], true],
        ['custom_full_contracte', 'Contracte și documente', 'Înregistrează contracte, documente și linkuri importante.','request',0x8b5cf6, [['title','Titlu document'],['url','Link document','url'],['details','Detalii','long_text']], [open('Adaugă document')]],
        ['custom_full_pontaj', 'Pontaj și activitate', 'Centralizează pontajul și activitatea echipei.','report',0x14b8a6, [], [reportButton('Generează pontaj')]],
        ['custom_full_rapoarte', 'Rapoarte organizație', 'Afișează un rezumat al activității modulului.','report',0x22c55e, [], [reportButton('Vezi raportul')]],
        ['custom_full_status', 'Status bot și server', 'Verifică disponibilitatea botului și configurația serverului.','report',0x06b6d4, [], [reportButton('Verifică statusul')]]
      ]
    },
    legal_management: {
      label: '⚖️ Legale + Management',
      description: 'Pachet pentru organizații axate pe administrare, documente, aprobări și comunicare internă.',
      modules: [
        ['custom_legal_anunturi', 'Anunțuri și comunicate', 'Publică informații oficiale pentru organizație.','announcement',0x2563eb, [['message','Mesajul anunțului','long_text']], [open('Publică anunț')]],
        ['custom_legal_cereri', 'Cereri oficiale', 'Primește solicitări oficiale de la membri.','approval',0xf59e0b, [['subject','Subiect'],['details','Detalii','long_text']], [open('Trimite cerere',3)], true],
        ['custom_legal_contracte', 'Contracte și documente', 'Gestionează documentele și contractele organizației.','request',0x7c3aed, [['title','Titlu document'],['url','Link document','url'],['details','Detalii','long_text']], [open('Adaugă document')]],
        ['custom_legal_rapoarte', 'Rapoarte de management', 'Generează rapoarte pentru activitatea organizației.','report',0x16a34a, [], [reportButton('Generează raport')]],
        ['custom_legal_pontaj', 'Pontaj echipă', 'Centralizează turele și activitatea echipei.','report',0x0891b2, [], [reportButton('Vezi pontajul')]]
      ]
    },
    illegal: {
      label: '🕶️ Ilegale · operațiuni și sancțiuni',
      description: 'Pachet pentru organizații care folosesc zona Ilegale: anunțuri, rapoarte, cereri și verificări interne.',
      modules: [
        ['custom_illegal_anunturi', 'Anunțuri Ilegale', 'Publică informații operaționale în canalul configurat.','announcement',0xdc2626, [['message','Mesajul anunțului','long_text']], [open('Publică anunț',4)]],
        ['custom_illegal_cereri', 'Cereri operaționale', 'Trimite o solicitare operațională către staff.','approval',0xea580c, [['subject','Subiect'],['details','Detalii','long_text']], [open('Trimite cerere',4)], true],
        ['custom_illegal_rapoarte', 'Rapoarte operaționale', 'Centralizează rapoartele și activitatea operațională.','report',0xb91c1c, [], [reportButton('Generează raport')]],
        ['custom_illegal_sanctiuni', 'Sancțiuni și sesizări', 'Înregistrează sesizări care trebuie analizate de staff.','approval',0x991b1b, [['member','Persoană / identificator'],['details','Descrierea sesizării','long_text']], [open('Trimite sesizare',4)], true]
      ]
    }
  };

  const toModule = (item, bundleKey) => {
    const [module_key, label, description, handler, color, fields, buttons, review] = item;
    return { module_key, label, description, definition: moduleDefinition(label, description, color, handler, fields, buttons, review), enabled: true, bundle: bundleKey };
  };
  const selected = () => bundles[select?.value] || null;
  const setStatus = (message, error = false) => { if (!status) return; status.textContent = message; status.className = `status ${error ? 'error' : 'ok'}`; };
  const renderPreview = () => {
    const bundle = selected();
    if (!bundle || !preview) { if (preview) preview.hidden = true; return; }
    preview.hidden = false;
    preview.innerHTML = `<div class="flex items-center justify-between gap-2"><strong>${esc(bundle.label)}</strong><span class="tag">${bundle.modules.length} module + canale</span></div><p class="muted mt-2">${esc(bundle.description)}</p><div class="grid gap-2 sm:grid-cols-2 mt-3">${bundle.modules.map((item) => `<div class="rounded-lg border border-slate-800 bg-slate-950/60 p-2"><strong>${esc(item[1])}</strong><br><small class="muted">Embed cu butoane · rezultate în canalul Panel Pro log</small></div>`).join('')}</div><p class="muted text-xs mt-3">Instalarea creează categoria și canalele, activează modulele și publică embedurile. Nu creează roluri noi. Membrii activi ai organizației pot folosi modulele configurate.</p>`;
  };
  const loadInstallTargets = async () => {
    try {
      const catalog = await moduleCall({ action: 'catalog' });
      const organizationSelect = $('discord-bundle-organization');
      const guildSelect = $('discord-bundle-guild');
      if (organizationSelect) organizationSelect.innerHTML = '<option value="">Organizația pentru instalare…</option>' + (catalog.organizations || []).map((org) => `<option value="${esc(org.id)}">${esc(org.name)}</option>`).join('');
      const renderGuilds = () => {
        const organizationId = organizationSelect?.value || '';
        if (guildSelect) guildSelect.innerHTML = '<option value="">Serverul Discord…</option>' + (catalog.guilds || []).filter((guild) => !organizationId || String(guild.organization_id) === String(organizationId)).map((guild) => `<option value="${esc(guild.guild_id)}" data-organization="${esc(guild.organization_id)}">${esc(guild.guild_name || guild.guild_id)} · ${esc(guild.kind || 'primary')}</option>`).join('');
      };
      organizationSelect?.addEventListener('change', renderGuilds);
      renderGuilds();
    } catch (error) { setStatus(`Nu am putut încărca serverele Discord: ${error?.message || 'eroare necunoscută'}.`, true); }
  };
  const load = async () => {
    if (!select) return;
    Object.entries(bundles).forEach(([key, bundle]) => { const option = document.createElement('option'); option.value = key; option.textContent = bundle.label; select.appendChild(option); });
    select.addEventListener('change', renderPreview);
    $('discord-bundle-show-preview')?.addEventListener('click', () => { renderPreview(); if (!selected()) setStatus('Alege un preset Discord.', true); });
    $('discord-bundle-create')?.addEventListener('click', createBundle);
    $('discord-bundle-install')?.addEventListener('click', installBundle);
  };
  const createBundle = async () => {
    const bundle = selected();
    if (!bundle) { setStatus('Alege un preset Discord înainte de creare.', true); return; }
    renderPreview();
    try {
      setStatus('Verific modulele existente…');
      const catalog = await call({ action: 'list' });
      const existing = new Set((catalog.modules || []).map((module) => String(module.module_key)));
      const modules = bundle.modules.map((item) => toModule(item, select.value));
      const overwriteCount = modules.filter((module) => existing.has(module.module_key)).length;
      const warning = overwriteCount ? `\n\n${overwriteCount} module există deja și vor fi actualizate.` : '';
      if (!window.confirm(`Creezi presetul „${bundle.label}” cu ${modules.length} module?${warning}`)) return;
      let done = 0;
      for (const module of modules) {
        setStatus(`Se salvează ${done + 1}/${modules.length}: ${module.label}…`);
        await call({ action: 'save_module', ...module });
        done += 1;
      }
      setStatus(`Presetul a fost creat: ${done} module salvate. Acum le poți publica în canalele Discord dorite.`);
      if (typeof window.loadModuleCatalog === 'function') window.loadModuleCatalog();
    } catch (error) {
      setStatus(error?.message || 'Presetul nu a putut fi creat complet.', true);
    }
  };
  const installBundle = async () => {
    const bundle = selected();
    const organizationId = $('discord-bundle-organization')?.value || '';
    const guildId = $('discord-bundle-guild')?.value || '';
    if (!bundle) { setStatus('Alege un preset Discord înainte de instalare.', true); return; }
    if (!organizationId || !/^\d{15,22}$/.test(guildId)) { setStatus('Alege organizația și serverul Discord.', true); return; }
    renderPreview();
    if (!window.confirm(`Instalezi pachetul „${bundle.label}” pe serverul selectat?\n\nVor fi create sau reutilizate categoria și canalele, apoi vor fi activate modulele și publicate embedurile. Nu se creează roluri noi.`)) return;
    try {
      setStatus('Instalez pachetul pe Discord. Nu închide pagina…');
      const result = await installCall({ action: 'install_bundle', bundle_key: select.value, organization_id: organizationId, guild_id: guildId });
      setStatus(`Pachet instalat: ${result.created?.channels || 0} canale și ${result.created?.messages || 0} embeduri publicate. Nu au fost create roluri noi.`);
    } catch (error) { setStatus(error?.message || 'Instalarea pe Discord a eșuat.', true); }
  };
  load();
  loadInstallTargets();
})();
