(() => {
  'use strict';

  if (!location.pathname.endsWith('organizatii.html')) return;

  const $ = (id) => document.getElementById(id);
  const config = window.PANEL_SUPABASE_CONFIG;
  const statusChannel = 'status_live';
  let communicationPermissions = { organization: { read: [], write: [] }, departments: { read: [], write: [] } };

  function communicationRoles(audience, kind) {
    return Array.isArray(communicationPermissions[audience]?.[kind]) ? communicationPermissions[audience][kind].map(String) : [];
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
    card.innerHTML = '<b class="text-sm">AnunÈ›uri È™i Amenzi</b><p class="mt-1 text-xs text-slate-400">AceeaÈ™i selecÈ›ie controleazÄƒ citirea È™i publicarea pentru ambele pagini, separat pentru OrganizaÈ›ie È™i Birouri / AngajaÈ›i.</p><div class="mt-3 grid gap-3 md:grid-cols-2">' + ['organization','departments'].map(audience => `<div class="rounded-lg border border-slate-700 p-3"><b class="text-xs">${audience === 'organization' ? 'OrganizaÈ›ie' : 'Birouri / AngajaÈ›i'}</b><div class="mt-2 text-[11px] text-slate-400">Cine poate citi</div><div data-communication-audience="${audience}" data-communication-kind="read" class="mt-1 flex flex-wrap gap-2"></div><div class="mt-2 text-[11px] text-slate-400">Cine poate scrie</div><div data-communication-audience="${audience}" data-communication-kind="write" class="mt-1 flex flex-wrap gap-2"></div></div>`).join('') + '</div>';
    ['organization','departments'].forEach((audience) => ['read', 'write'].forEach((kind) => {
      const target = card.querySelector(`[data-communication-audience="${audience}"][data-communication-kind="${kind}"]`);
      roles.forEach((label, id) => {
        const wrapper = document.createElement('label');
        wrapper.className = 'flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs';
        wrapper.innerHTML = `<input type="checkbox" data-communication-audience="${audience}" data-communication-kind="${kind}" data-communication-role="${id}"><span>${label}</span>`;
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
      <small class="mb-2 block text-slate-400">Embed Discord editat periodic cu mecanicii aflaÈ›i Ã®n pontaj È™i Ã®n pauzÄƒ.</small>
      <label class="flex items-center gap-2 text-xs"><input type="checkbox" id="wh_primary_enabled_status_live"> Discord principal</label>
      <input id="wh_primary_url_status_live" type="url" class="field" placeholder="Webhook Discord principal pentru Status Live">
      <button type="button" class="mt-2 rounded-lg border border-cyan-700 px-3 py-1 text-xs font-bold text-cyan-200" data-status-test="primary">TesteazÄƒ webhookul</button>
      <span class="ml-2 text-xs text-slate-400" data-status-test-result="primary"></span>
      <label class="mt-3 flex items-center gap-2 text-xs"><input type="checkbox" id="wh_secondary_enabled_status_live"> Discord secundar</label>
      <input id="wh_secondary_url_status_live" type="url" class="field" placeholder="Webhook Discord secundar pentru Status Live">
      <button type="button" class="mt-2 rounded-lg border border-cyan-700 px-3 py-1 text-xs font-bold text-cyan-200" data-status-test="secondary">TesteazÄƒ webhookul</button>
      <span class="ml-2 text-xs text-slate-400" data-status-test-result="secondary"></span>`;
    host.appendChild(fieldset);

    fieldset.querySelectorAll('[data-status-test]').forEach((button) => {
      button.addEventListener('click', async () => {
        const target = button.dataset.statusTest;
        const url = $(`wh_${target}_url_status_live`).value.trim();
        const result = fieldset.querySelector(`[data-status-test-result="${target}"]`);
        if (!url) { result.textContent = 'CompleteazÄƒ webhookul.'; result.className = 'ml-2 text-xs text-amber-300'; return; }
        button.disabled = true; result.textContent = 'Se testeazÄƒ...';
        try {
          const response = await fetch(`${config.url}/functions/v1/manage-organizations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', apikey: config.publishableKey, Authorization: `Bearer ${config.publishableKey}`, 'x-panel-session': localStorage.getItem('panel_session_token') || '' },
            body: JSON.stringify({ action: 'test_webhook', url, organization_id: $('id').value })
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || 'Testul a eÈ™uat.');
          result.textContent = 'Trimis cu succes.'; result.className = 'ml-2 text-xs text-emerald-300';
        } catch (error) { result.textContent = error.message; result.className = 'ml-2 text-xs text-red-300'; }
        finally { button.disabled = false; }
      });
    });
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
    } catch (_) { /* Lista principalÄƒ gestioneazÄƒ deja mesajul de eroare. */ }
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
          options.body = JSON.stringify(body);
        }
      } catch (_) { /* Cererile care nu sunt JSON rÄƒmÃ¢n nemodificate. */ }
    }
    return originalFetch(url, options);
  };

  const originalRenderPermissions = renderPagePermissions;
  renderPagePermissions = () => { originalRenderPermissions(); addAnnouncementPermissions(); };

  const originalEditOrganization = editOrganization;
  editOrganization = async (...args) => {
    await originalEditOrganization(...args);
    const organization = (typeof organizations !== 'undefined' ? organizations : []).find((item) => item.id === args[0]);
    const saved = organization?.platform_settings?.communication_permissions || {};
    const legacyRead = Array.isArray(pagePermissions?.['anunturi.html']) ? pagePermissions['anunturi.html'].map(String) : [];
    const legacyWrite = Array.isArray(actionPermissions?.['anunturi.publish']) ? actionPermissions['anunturi.publish'].map(String) : [];
    communicationPermissions = {
      organization: { read: Array.isArray(saved.organization?.read) ? saved.organization.read.map(String) : legacyRead, write: Array.isArray(saved.organization?.write) ? saved.organization.write.map(String) : legacyWrite },
      departments: { read: Array.isArray(saved.departments?.read) ? saved.departments.read.map(String) : legacyRead, write: Array.isArray(saved.departments?.write) ? saved.departments.write.map(String) : legacyWrite }
    };
    document.querySelector('[data-communication-permission]')?.remove();
    if (typeof renderActionPermissions === 'function') renderActionPermissions();
    addAnnouncementPermissions();
    await loadStatusRoutes($('id').value);
  };

  document.addEventListener('DOMContentLoaded', () => {
    $('new')?.addEventListener('click', () => {
      communicationPermissions = { organization: { read: [], write: [] }, departments: { read: [], write: [] } };
      if (typeof renderActionPermissions === 'function') renderActionPermissions();
    });
    document.addEventListener('click', (event) => {
      document.querySelectorAll('#list details[open]').forEach((details) => {
        if (!details.contains(event.target)) details.open = false;
      });
    });
    injectStatusWebhookFields();
    addAnnouncementPermissions();
    const observer = new MutationObserver(() => { injectStatusWebhookFields(); addAnnouncementPermissions(); });
    observer.observe(document.body, { childList: true, subtree: true });
  });
})();
