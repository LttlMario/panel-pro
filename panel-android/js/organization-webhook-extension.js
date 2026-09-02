(() => {
  'use strict';

  if (!location.pathname.endsWith('organizatii.html')) return;

  const $ = (id) => document.getElementById(id);
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  const config = window.PANEL_SUPABASE_CONFIG;
  const statusChannel = 'status_live';
  let communicationPermissions = { organization: { read: [], write: [] }, departments: { read: [], write: [] } };
  let disciplinePermissions = { organization: { read: [], write: [], sanction: [] }, departments: { read: [], write: [], sanction: [] } };
  let packageCode = 'standard';
  const fullOnlyWebhookKeys = new Set(['organization', 'requests_organization', 'illegal_marketplace', 'fines_organization', 'warnings_organization', 'sanctions_organization']);
  const standardWebhookKeys = new Set(['departments', 'pontaj', 'weekly_reports', 'contracts', 'contract_identity_weekly', 'marketplace', 'fines_departments', 'warnings_departments', 'sanctions_departments', 'status_live', 'organization_expiration']);
  const operationsWebhookKeys = new Set(['organization', 'requests_organization', 'fines_organization', 'warnings_organization', 'sanctions_organization', 'illegal_marketplace', 'organization_expiration']);
  const organizationScopeEnabled = () => packageCode === 'full' || packageCode === 'operations';

  function communicationRoles(audience, kind) {
    return Array.isArray(communicationPermissions[audience]?.[kind]) ? communicationPermissions[audience][kind].map(String) : [];
  }

  function disciplineRoles(audience, kind) {
    return Array.isArray(disciplinePermissions[audience]?.[kind]) ? disciplinePermissions[audience][kind].map(String) : [];
  }

  function applyPackageVisibility() {
    document.querySelectorAll('[id^="wh_primary_url_"], [id^="wh_secondary_url_"]').forEach((input) => {
      const key = input.id.replace(/^wh_(?:primary|secondary)_url_/, '');
      const fieldset = input.closest('fieldset');
      if (fieldset) fieldset.hidden = packageCode === 'full' ? false : packageCode === 'operations' ? !operationsWebhookKeys.has(key) : !standardWebhookKeys.has(key);
    });
  }

  function addAnnouncementPermissions() {
    const host = $('action-permissions');
    if (!host || host.querySelector('[data-communication-permission]')) return;
    const roles = new Map();
    if (typeof roleRows !== 'undefined' && Array.isArray(roleRows)) {
      roleRows.filter((row) => row.discord_role_id).forEach((row) => {
        const id = String(row.discord_role_id || '');
        if (id && !roles.has(id)) roles.set(id, row.panel_role || id);
      });
    }
    if (!roles.size) return;
    const card = document.createElement('div');
    card.dataset.communicationPermission = 'true';
    card.className = 'rounded-xl border border-amber-700/60 bg-amber-950/10 p-3';
    const audiences = packageCode === 'full' ? ['organization', 'departments'] : packageCode === 'operations' ? ['organization'] : ['departments'];
    card.innerHTML = '<b class="text-sm">Anunțuri și disciplină</b><p class="mt-1 text-xs text-slate-400">Standard: partea firmei și angajaților. Full: adaugă separat partea organizației/mafiei.</p><div class="mt-3 grid gap-3 md:grid-cols-2">' + audiences.map(audience => `<div class="rounded-lg border border-slate-700 p-3"><b class="text-xs">${audience === 'organization' ? 'Organizație / Mafia · Full' : 'Birouri / Angajați · Standard'}</b><div class="mt-2 text-[11px] text-slate-400">Cine poate citi comunicările</div><div data-communication-audience="${audience}" data-communication-kind="read" class="mt-1 flex flex-wrap gap-2"></div><div class="mt-2 text-[11px] text-slate-400">Cine poate scrie comunicări</div><div data-communication-audience="${audience}" data-communication-kind="write" class="mt-1 flex flex-wrap gap-2"></div></div>`).join('') + '</div><div class="mt-4 rounded-lg border border-amber-700/40 bg-amber-950/10 p-3"><b class="text-xs text-amber-200">Disciplină pe pachet</b><p class="mt-1 text-[11px] text-slate-400">Avertismentele și sancțiunile pentru angajați sunt Standard; cele pentru organizație/mafia apar numai la Full.</p><div data-discipline-permissions class="mt-3 grid gap-3 md:grid-cols-2"></div></div>';
    audiences.forEach((audience) => ['read', 'write'].forEach((kind) => {
      const target = card.querySelector(`[data-communication-audience="${audience}"][data-communication-kind="${kind}"]`);
      roles.forEach((label, id) => {
        const wrapper = document.createElement('label');
        wrapper.className = 'flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs';
        wrapper.innerHTML = `<input type="checkbox" data-communication-audience="${escapeHtml(audience)}" data-communication-kind="${escapeHtml(kind)}" data-communication-role="${escapeHtml(id)}"><span>${escapeHtml(label)}</span>`;
        const checkbox = wrapper.querySelector('input');
        checkbox.checked = communicationRoles(audience, kind).includes(id);
        checkbox.addEventListener('change', () => {
          const current = new Set(communicationRoles(audience, kind));
          checkbox.checked ? current.add(id) : current.delete(id);
          communicationPermissions[audience][kind] = [...current];
        });
        target.appendChild(wrapper);
      });
    }));
    const disciplineHost = card.querySelector('[data-discipline-permissions]');
    audiences.forEach((audience) => {
      const label = audience === 'organization' ? 'Organizație / Mafia · Full' : 'Birouri / Angajați · Standard';
      const block = document.createElement('div');
      block.className = 'rounded-lg border border-slate-700 p-3';
      block.innerHTML = `<b class="text-xs">${label}</b>`;
      [['read', 'Poate vedea'], ['write', 'Poate emite avertismente'], ['sanction', 'Poate aplica sancțiuni']].forEach(([kind, kindLabel]) => {
        const group = document.createElement('div');
        group.className = 'mt-2';
        group.innerHTML = `<div class="text-[11px] text-slate-400">${kindLabel}</div><div class="mt-1 flex flex-wrap gap-2"></div>`;
        const target = group.querySelector('div:last-child');
        roles.forEach((labelValue, id) => {
          const wrapper = document.createElement('label');
          wrapper.className = 'flex items-center gap-2 rounded-lg bg-slate-900 px-2 py-1 text-[11px]';
          wrapper.innerHTML = `<input type="checkbox"><span>${escapeHtml(labelValue)}</span>`;
          const checkbox = wrapper.querySelector('input');
          checkbox.checked = disciplineRoles(audience, kind).includes(id);
          checkbox.addEventListener('change', () => {
            const current = new Set(disciplineRoles(audience, kind));
            checkbox.checked ? current.add(id) : current.delete(id);
            disciplinePermissions[audience][kind] = [...current];
          });
          target.appendChild(wrapper);
        });
        block.appendChild(group);
      });
      disciplineHost.appendChild(block);
    });
    host.appendChild(card);
  }

  function routeValue(target) {
    return {
      enabled: $(`wh_${target}_enabled_${statusChannel}`)?.checked === true,
      url: $(`wh_${target}_url_${statusChannel}`)?.value.trim() || ''
    };
  }

  function injectStatusWebhookFields() {
    const host = $('webhooks');
    if (!host || $('wh_primary_url_status_live')) return;
    const fieldset = document.createElement('fieldset');
    fieldset.className = 'rounded-xl border border-emerald-700/60 bg-emerald-950/10 p-3';
    fieldset.innerHTML = `
      <legend class="px-1 font-bold text-emerald-200">Status Live</legend>
      <small class="mb-2 block text-slate-400">Embed Discord editat periodic cu mecanicii aflați în pontaj și în pauză.</small>
      <label class="flex items-center gap-2 text-xs"><input type="checkbox" id="wh_primary_enabled_status_live"> Discord principal</label>
      <input id="wh_primary_url_status_live" type="url" class="field" placeholder="Webhook Discord principal pentru Status Live">
      <button type="button" class="mt-2 rounded-lg border border-cyan-700 px-3 py-1 text-xs font-bold text-cyan-200" data-status-test="primary">Testează webhookul</button>
      <span class="ml-2 text-xs text-slate-400" data-status-test-result="primary"></span>
      <label class="mt-3 flex items-center gap-2 text-xs"><input type="checkbox" id="wh_secondary_enabled_status_live"> Discord secundar</label>
      <input id="wh_secondary_url_status_live" type="url" class="field" placeholder="Webhook Discord secundar pentru Status Live">
      <button type="button" class="mt-2 rounded-lg border border-cyan-700 px-3 py-1 text-xs font-bold text-cyan-200" data-status-test="secondary">Testează webhookul</button>
      <span class="ml-2 text-xs text-slate-400" data-status-test-result="secondary"></span>`;
    host.appendChild(fieldset);

    fieldset.querySelectorAll('[data-status-test]').forEach((button) => {
      button.addEventListener('click', async () => {
        const target = button.dataset.statusTest;
        const url = $(`wh_${target}_url_status_live`).value.trim();
        const result = fieldset.querySelector(`[data-status-test-result="${target}"]`);
        if (!url) { result.textContent = 'Completează webhookul.'; result.className = 'ml-2 text-xs text-amber-300'; return; }
        button.disabled = true; result.textContent = 'Se testează...';
        try {
          const response = await fetch(`${config.url}/functions/v1/manage-organizations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', apikey: config.publishableKey, Authorization: `Bearer ${config.publishableKey}`, 'x-panel-session': localStorage.getItem('panel_session_token') || '' },
            body: JSON.stringify({ action: 'test_webhook', url, organization_id: $('id').value })
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || 'Testul a eșuat.');
          result.textContent = 'Trimis cu succes.'; result.className = 'ml-2 text-xs text-emerald-300';
        } catch (error) { result.textContent = error.message; result.className = 'ml-2 text-xs text-red-300'; }
        finally { button.disabled = false; }
      });
    });
  }

  function addStatusLivePagePermission() {
    const host = $('page-permissions');
    if (!host || host.querySelector('[data-status-live-permission]')) return;
    const roleInputs = [...host.querySelectorAll('input[data-page-role]')];
    if (!roleInputs.length) return;
    const card = document.createElement('div');
    card.dataset.statusLivePermission = 'true';
    card.className = 'rounded-xl border border-emerald-700/60 bg-emerald-950/10 p-3';
    card.innerHTML = '<b class="text-sm">Status Live</b><div class="mt-2 flex flex-wrap gap-3"></div>';
    const roles = new Map();
    roleInputs.forEach((input) => {
      const key = input.dataset.pageRole;
      if (roles.has(key)) return;
      roles.set(key, input.closest('label')?.textContent?.trim() || key);
    });
    const target = card.querySelector('div');
    roles.forEach((label, roleId) => {
      const wrapper = document.createElement('label');
      wrapper.className = 'flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2';
      wrapper.innerHTML = `<input type="checkbox" data-status-live-role="${escapeHtml(roleId)}"><span>${escapeHtml(label)}</span>`;
      const checkbox = wrapper.querySelector('input');
      checkbox.checked = Array.isArray(pagePermissions['status-live.html']) && pagePermissions['status-live.html'].includes(roleId);
      checkbox.addEventListener('change', () => {
        const current = new Set(pagePermissions['status-live.html'] || []);
        checkbox.checked ? current.add(roleId) : current.delete(roleId);
        pagePermissions['status-live.html'] = [...current];
      });
      target.appendChild(wrapper);
    });
    host.appendChild(card);
  }

  async function loadStatusRoutes(organizationId) {
    try {
      const result = await invoke({ action: 'list' });
      const organization = (result.organizations || []).find((item) => item.id === organizationId);
      const route = organization?.organization_settings?.[0]?.webhook_routes?.[statusChannel] || {};
      ['primary', 'secondary'].forEach((target) => {
        const item = route[target] || {};
        $(`wh_${target}_url_status_live`).value = item.url || '';
        $(`wh_${target}_enabled_status_live`).checked = item.enabled === true && Boolean(item.url);
      });
    } catch (_) { /* Lista principală gestionează deja mesajul de eroare. */ }
  }

  const originalFetch = window.fetch;
  window.fetch = (url, options = {}) => {
    if (String(url).includes('/functions/v1/manage-organizations') && options.body) {
      try {
        const body = JSON.parse(options.body);
        if (body.action === 'save') {
          body.settings = body.settings || {};
          body.settings.webhook_routes = body.settings.webhook_routes || {};
          body.settings.webhook_routes[statusChannel] = { primary: routeValue('primary'), secondary: routeValue('secondary') };
          body.communication_permissions = communicationPermissions;
          body.discipline_permissions = disciplinePermissions;
          options.body = JSON.stringify(body);
        }
      } catch (_) { /* Cererile care nu sunt JSON rămân nemodificate. */ }
    }
    return originalFetch(url, options);
  };

  const originalRenderPermissions = renderPagePermissions;
  renderPagePermissions = () => { originalRenderPermissions(); addStatusLivePagePermission(); addAnnouncementPermissions(); };

  const originalEditOrganization = editOrganization;
  editOrganization = async (...args) => {
    await originalEditOrganization(...args);
    const organization = (typeof organizations !== 'undefined' ? organizations : []).find((item) => item.id === args[0]);
    packageCode = String(organization?.package?.code || organization?.platform_settings?.organization_package?.code || 'standard').toLowerCase();
    applyPackageVisibility();
    const saved = organization?.platform_settings?.communication_permissions || {};
    const savedDiscipline = organization?.platform_settings?.discipline_permissions || {};
    const legacyRead = Array.isArray(pagePermissions?.['anunturi.html']) ? pagePermissions['anunturi.html'].map(String) : [];
    const legacyWrite = Array.isArray(actionPermissions?.['anunturi.publish']) ? actionPermissions['anunturi.publish'].map(String) : [];
    communicationPermissions = {
      organization: { read: Array.isArray(saved.organization?.read) ? saved.organization.read.map(String) : legacyRead, write: Array.isArray(saved.organization?.write) ? saved.organization.write.map(String) : legacyWrite },
      departments: { read: Array.isArray(saved.departments?.read) ? saved.departments.read.map(String) : legacyRead, write: Array.isArray(saved.departments?.write) ? saved.departments.write.map(String) : legacyWrite }
    };
    disciplinePermissions = {
      organization: { read: Array.isArray(savedDiscipline.organization?.read) ? savedDiscipline.organization.read.map(String) : [], write: Array.isArray(savedDiscipline.organization?.write) ? savedDiscipline.organization.write.map(String) : [], sanction: Array.isArray(savedDiscipline.organization?.sanction) ? savedDiscipline.organization.sanction.map(String) : [] },
      departments: { read: Array.isArray(savedDiscipline.departments?.read) ? savedDiscipline.departments.read.map(String) : [], write: Array.isArray(savedDiscipline.departments?.write) ? savedDiscipline.departments.write.map(String) : [], sanction: Array.isArray(savedDiscipline.departments?.sanction) ? savedDiscipline.departments.sanction.map(String) : [] }
    };
    document.querySelector('[data-communication-permission]')?.remove();
    if (typeof renderActionPermissions === 'function') renderActionPermissions();
    addAnnouncementPermissions();
    await loadStatusRoutes($('id').value);
  };

  document.addEventListener('DOMContentLoaded', () => {
    $('new')?.addEventListener('click', () => {
      packageCode = String($('package-code')?.value || 'standard').toLowerCase();
      applyPackageVisibility();
      communicationPermissions = { organization: { read: [], write: [] }, departments: { read: [], write: [] } };
      disciplinePermissions = { organization: { read: [], write: [], sanction: [] }, departments: { read: [], write: [], sanction: [] } };
      if (typeof renderActionPermissions === 'function') renderActionPermissions();
    });
    $('package-code')?.addEventListener('change', () => { packageCode = String($('package-code').value || 'standard').toLowerCase(); applyPackageVisibility(); document.querySelector('[data-communication-permission]')?.remove(); addAnnouncementPermissions(); });
    document.addEventListener('click', (event) => {
      document.querySelectorAll('#list details[open]').forEach((details) => {
        if (!details.contains(event.target)) details.open = false;
      });
    });
    injectStatusWebhookFields();
    applyPackageVisibility();
    addStatusLivePagePermission();
    addAnnouncementPermissions();
    const observer = new MutationObserver(() => { injectStatusWebhookFields(); addStatusLivePagePermission(); addAnnouncementPermissions(); });
    observer.observe(document.body, { childList: true, subtree: true });
  });
})();
