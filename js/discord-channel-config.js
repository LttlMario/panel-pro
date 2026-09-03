(() => {
  const initializeDiscordChannelConfig = () => {
  const root = document.getElementById('webhooks') || document.getElementById('owner-webhooks') || document.getElementById('draft-webhooks');
  if (!root) return;
  if (document.getElementById('discord-channel-routes')) return;
  const isDraft = root.id === 'draft-webhooks';
  const isOwner = root.id === 'owner-webhooks';
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const detectedRouteKeys = [...root.querySelectorAll(isOwner ? '[data-owner-webhook]' : isDraft ? '[data-draft-webhook]' : '[id^="wh_primary_url_"]')]
    .map((input) => isOwner ? input.dataset.ownerWebhook : isDraft ? input.dataset.draftWebhook : input.id.replace(/^wh_primary_url_/, ''))
    .filter((key, index, list) => key && list.indexOf(key) === index);
  const consolidatedContentRoutes = new Set(['fines_organization', 'fines_departments', 'warnings_organization', 'warnings_departments', 'sanctions_organization', 'sanctions_departments']);
  const routeKeys = [...detectedRouteKeys].filter((key, index, list) => list.indexOf(key) === index && !consolidatedContentRoutes.has(key));
  const pontajIndex = routeKeys.indexOf('pontaj');
  routeKeys.splice(pontajIndex >= 0 ? pontajIndex + 1 : routeKeys.length, 0, 'log_pontaj');
  const insertSyntheticAfter = (sourceKey, syntheticKey) => {
    if (routeKeys.includes(syntheticKey)) return;
    const sourceIndex = routeKeys.indexOf(sourceKey);
    routeKeys.splice(sourceIndex >= 0 ? sourceIndex + 1 : routeKeys.length, 0, syntheticKey);
  };
  insertSyntheticAfter('requests_organization', 'log_requests_organization');
  insertSyntheticAfter('requests_departments', 'log_requests_departments');
  insertSyntheticAfter('organization', 'log_announcements_organization');
  insertSyntheticAfter('departments', 'log_announcements_departments');
  insertSyntheticAfter('contracts', 'log_contracts');
  insertSyntheticAfter('stash', 'log_stash');
  insertSyntheticAfter('stash_requests', 'log_stash_requests');
  insertSyntheticAfter('stash_donations', 'log_stash_donations');
  const preferredRouteOrder = ['organization', 'log_announcements_organization', 'departments', 'log_announcements_departments', 'pontaj', 'log_pontaj', 'requests_organization', 'log_requests_organization', 'requests_departments', 'log_requests_departments', 'contracts', 'log_contracts', 'actions_organization', 'status_live', 'stash', 'log_stash', 'stash_requests', 'log_stash_requests', 'stash_donations', 'log_stash_donations'];
  const preferredRoutes = preferredRouteOrder.filter((key) => routeKeys.includes(key));
  const remainingRoutes = routeKeys.filter((key) => !preferredRoutes.includes(key));
  routeKeys.splice(0, routeKeys.length, ...preferredRoutes, ...remainingRoutes);
  const labels = Object.fromEntries(routeKeys.map((key) => {
    const input = isOwner ? root.querySelector(`[data-owner-webhook="${key}"]`) : isDraft ? root.querySelector(`[data-draft-webhook="${key}"]`) : document.getElementById(`wh_primary_url_${key}`);
    const fallbackLabels = {
      log_pontaj: 'Log pontaj · Start / Pauză / Stop',
      log_requests_organization: 'Log învoiri · Organizație',
      log_requests_departments: 'Log învoiri · Angajați',
      log_announcements_organization: 'Log anunțuri · Organizație',
      log_announcements_departments: 'Log anunțuri · Angajați',
      log_contracts: 'Log contracte',
      actions_organization: 'Acțiuni organizație',
      stash: 'Stash · Embed cu butoane',
      stash_requests: 'Cereri stash · Embed cu butoane',
      stash_donations: 'Donații stash · Embed cu butoane',
      log_stash: 'Log stash',
      log_stash_requests: 'Log cereri stash',
      log_stash_donations: 'Log donații stash',
    };
    return [key, input?.closest('fieldset')?.querySelector('legend')?.textContent?.trim() || fallbackLabels[key] || key];
  }));
 const state = { routes: {}, channelsByGuild: {}, guildNames: {} };
  state.guildAvailability = { primary: false, secondary: false };
  state.discoveryAttempted = false;
  const getConfig = () => window.PANEL_SUPABASE_CONFIG || window.config || {};
  const organizationId = () => document.getElementById('id')?.value || window.ownerOrganizationId || window.draftOrganizationId || '';
  const guildIds = () => {
    const values = isOwner
      ? (Array.isArray(window.ownerGuildIds) ? window.ownerGuildIds : [])
      : isDraft
        ? [document.getElementById('draft-config-guild')?.value, document.getElementById('draft-config-guild-secondary')?.value]
        : [document.getElementById('guild')?.value, document.getElementById('guild-secondary')?.value];
    return [...new Set(values.map((value) => String(value || '').trim()).filter((value) => /^\d{15,22}$/.test(value)))];
 };
  const guildTargets = () => isOwner && Array.isArray(window.ownerGuildTargets) ? window.ownerGuildTargets.map((item) => ({ target: item.kind === 'secondary' ? 'secondary' : 'primary', id: String(item.id || '').trim() })).filter((item) => /^\d{15,22}$/.test(item.id)) : (isDraft ? [document.getElementById('draft-config-guild')?.value, document.getElementById('draft-config-guild-secondary')?.value] : [document.getElementById('guild')?.value, document.getElementById('guild-secondary')?.value]).map((value, index) => ({ target: index === 1 ? 'secondary' : 'primary', id: String(value || '').trim() })).filter((item) => /^\d{15,22}$/.test(item.id));
 const validChannel = (value) => /^\d{15,22}$/.test(String(value || '').trim());
  const guildIdForTarget = (target) => {
    const values = isOwner
      ? (Array.isArray(window.ownerGuildTargets) ? window.ownerGuildTargets.filter((item) => item.kind === target).map((item) => item.id) : [])
      : isDraft
        ? [document.getElementById('draft-config-guild')?.value, document.getElementById('draft-config-guild-secondary')?.value]
        : [document.getElementById('guild')?.value, document.getElementById('guild-secondary')?.value];
    if (isOwner && Array.isArray(window.ownerGuildTargets)) return String(values[0] || '').trim();
    return String(values[target === 'secondary' ? 1 : 0] || '').trim();
  };
  const allChannels = () => Object.entries(state.channelsByGuild).flatMap(([guildId, channels]) => (channels || []).map((channel) => ({ ...channel, guild_id: guildId, guild_name: state.guildNames[guildId] || guildId })));
  const routeValue = (key, target) => state.routes?.[key]?.[target] || {};
  const selectedChannel = (key, target) => String(routeValue(key, target).channel_id || '');
  const setRoute = (key, target, channelId) => {
    state.routes[key] ||= {};
    state.routes[key][target] = channelId ? { enabled: true, channel_id: String(channelId), guild_id: allChannels().find((channel) => channel.id === String(channelId))?.guild_id || '' } : null;
  };
  const options = (selected, target) => {
    const targetGuildId = guildIdForTarget(target);
    const values = allChannels().filter((channel) => !targetGuildId || channel.guild_id === targetGuildId);
    const saved = selected && !values.some((channel) => channel.id === selected) ? `<option value="${esc(selected)}" selected>Canal salvat · ${esc(selected)}</option>` : '';
    const renderChannel = (channel) => `<option value="${esc(channel.id)}" ${channel.id === selected ? 'selected' : ''}>#${esc(channel.name)}</option>`;
    const uncategorized = values.filter((channel) => !channel.category_name).map(renderChannel).join('');
    const categories = [...new Map(values.filter((channel) => channel.category_name).map((channel) => [channel.parent_id || channel.category_name, channel])).values()]
      .sort((left, right) => Number(left.category_position ?? 0) - Number(right.category_position ?? 0) || String(left.category_name).localeCompare(String(right.category_name), 'ro'));
    const grouped = categories.map((category) => {
      const channels = values.filter((channel) => (channel.parent_id || channel.category_name) === (category.parent_id || category.category_name)).map(renderChannel).join('');
      return `<optgroup label="${esc(category.category_name)}">${channels}</optgroup>`;
    }).join('');
    return `<option value="">Fără canal selectat</option>${saved}${uncategorized}${grouped}`;
  };
  const section = document.createElement('section');
  section.id = 'discord-channel-routes';
  section.className = 'mt-4 rounded-xl border border-emerald-700/60 bg-emerald-950/20 p-4';
  const canPublishDiscordPanels = root.id === 'webhooks' || root.id === 'owner-webhooks';
  section.innerHTML = `<div class="flex flex-wrap items-center justify-between gap-3"><div><h2 class="font-bold">Canale Discord pentru bot</h2><p class="mt-1 text-xs text-slate-400">Selectează unde trimite botul toate mesajele și embed-urile. Canalele sunt afișate în ordinea serverului, grupate după categorie.</p></div><button id="discord-channel-discover" type="button" class="rounded-xl bg-emerald-700 px-4 py-2 text-xs font-black text-white">Încarcă canalele Discord</button></div><p id="discord-channel-status" class="mt-2 text-xs text-slate-400">Nu s-au încărcat încă canalele.</p><div id="discord-channel-grid" class="mt-3 grid gap-3 md:grid-cols-2"></div>`;
  root.closest('details')?.before(section);
  const grid = section.querySelector('#discord-channel-grid');
  const status = section.querySelector('#discord-channel-status');
  const channelIsAccessible = (target, key) => {
    const channelId = selectedChannel(key, target);
    if (!validChannel(channelId)) return false;
    if (!state.discoveryAttempted) return true;
    const guildId = guildIdForTarget(target);
    const discovered = state.channelsByGuild[guildId] || [];
    return Boolean(guildId && state.guildAvailability[target] !== false && discovered.some((channel) => String(channel.id) === channelId));
  };
  const selectedPontajTargets = () => ['primary', 'secondary'].filter((target) => channelIsAccessible(target, 'pontaj'));
  const buildPontajPanelPayload = () => ({
    allowed_mentions: { parse: [] },
    embeds: [{
      title: 'Pontaj · Panel Pro',
      description: 'Alege tura, apoi folosește comenzile de mai jos. Regulile și programul sunt cele configurate în panel pentru organizația activă.',
      color: 0x22d3ee,
      fields: [
        { name: 'Tura selectată', value: 'Neselectată', inline: true },
        { name: 'Status', value: 'Oprit', inline: true },
        { name: 'Program', value: 'Conform configurației din panel', inline: false },
      ],
      footer: { text: 'Panel Pro · Pontaj' },
    }],
    components: [
      { type: 1, components: [
        { type: 2, style: 1, label: 'Tura de zi', custom_id: 'panel:pontaj:shift_day' },
        { type: 2, style: 1, label: 'Tura de noapte', custom_id: 'panel:pontaj:shift_night' },
      ] },
      { type: 1, components: [
        { type: 2, style: 3, label: 'Start', custom_id: 'panel:pontaj:start' },
        { type: 2, style: 2, label: 'Pauză', custom_id: 'panel:pontaj:pause' },
        { type: 2, style: 4, label: 'Stop', custom_id: 'panel:pontaj:stop' },
      ] },
      { type: 1, components: [
        { type: 2, style: 1, label: 'Pontajul meu', custom_id: 'panel:pontaj:my_stats' },
      ] },
    ],
  });
  const syncPontajPublishState = (resetStatus = true) => {
    const pontajPublishButton = section.querySelector('#discord-pontaj-publish');
    const pontajPublishStatus = section.querySelector('#discord-pontaj-publish-status');
    if (!pontajPublishButton) return;
    const targets = selectedPontajTargets();
    pontajPublishButton.disabled = targets.length === 0;
    if (!resetStatus) return;
    if (!targets.length && pontajPublishStatus) pontajPublishStatus.textContent = 'Selectează mai întâi cel puțin un canal pentru „Pontaj”.';
    else if (pontajPublishStatus && !pontajPublishStatus.dataset.busy) pontajPublishStatus.textContent = `Panoul va fi publicat pe ${targets.length === 1 ? 'canalul configurat' : 'canalele configurate'}.`;
  };
  const publishPontajPanel = async () => {
    const pontajPublishButton = section.querySelector('#discord-pontaj-publish');
    const pontajPublishStatus = section.querySelector('#discord-pontaj-publish-status');
    if (!pontajPublishButton || !pontajPublishStatus) return;
    const targets = selectedPontajTargets();
    const selectedOrganizationId = String(organizationId() || '').trim();
    const activeOrganizationId = String(window.getActiveOrganizationId?.() || '').trim();
    if (!targets.length) { pontajPublishStatus.textContent = 'Selectează mai întâi un canal pentru „Pontaj”.'; return; }
    if (!selectedOrganizationId || !activeOrganizationId || selectedOrganizationId !== activeOrganizationId) {
      pontajPublishStatus.textContent = 'Intră mai întâi în organizația aleasă din „Administrare organizații”, folosind modul de test.';
      return;
    }
    if (typeof window.sendPanelDiscord !== 'function') { pontajPublishStatus.textContent = 'Modulul de trimitere Discord nu este disponibil pe această pagină.'; return; }
    pontajPublishButton.disabled = true;
    pontajPublishStatus.dataset.busy = '1';
    pontajPublishStatus.textContent = 'Se publică embedul Pontaj pe Discord...';
    try {
      const response = await window.sendPanelDiscord('pontaj', buildPontajPanelPayload(), { messageKey: 'pontaj-control', channelRoutes: window.getDiscordChannelRoutes?.() || {} });
      const result = await response.clone().json().catch(() => ({}));
      const delivered = Number(result.routes || targets.length);
      pontajPublishStatus.textContent = `Embedul Pontaj a fost ${result.messages?.some?.((item) => item.action === 'edited') ? 'actualizat' : 'publicat'} pe ${delivered} canal${delivered === 1 ? '' : 'e'}.`;
    } catch (error) {
      pontajPublishStatus.textContent = error.message || 'Embedul Pontaj nu a putut fi publicat.';
    } finally {
      delete pontajPublishStatus.dataset.busy;
      syncPontajPublishState(false);
    }
  };
  const selectedContractsTargets = () => ['primary', 'secondary'].filter((target) => channelIsAccessible(target, 'contracts'));
  const selectedStashTargets = () => ['primary', 'secondary'].filter((target) => channelIsAccessible(target, 'stash'));
  const buildStashPanelPayload = () => ({ allowed_mentions: { parse: [] }, embeds: [{ title: '📦 Stash · Administrare', description: 'Panou pentru gestionarea Stash-ului organizației. Accesul la acțiuni este verificat după rolurile configurate în Panel Pro.', color: 0x22c55e, fields: [{ name: 'Funcție', value: 'Adaugă articole și gestionează cererile sau donațiile în așteptare.', inline: false }, { name: 'Loguri', value: 'Activitatea Stash, cererile și donațiile sunt trimise separat în canalele de log configurate.', inline: false }], footer: { text: 'Panel Pro · Stash' } }], components: [{ type: 1, components: [{ type: 2, style: 3, label: 'Adaugă în stash', custom_id: 'panel:stash:create' }, { type: 2, style: 1, label: 'Cereri în așteptare', custom_id: 'panel:stash:pending_requests' }, { type: 2, style: 1, label: 'Donații în așteptare', custom_id: 'panel:stash:pending_donations' }] }] });
  const syncStashPublishState = (resetStatus = true) => { const button = section.querySelector('#discord-stash-publish'); const statusNode = section.querySelector('#discord-stash-publish-status'); if (!button) return; const targets = selectedStashTargets(); button.disabled = !targets.length; if (!resetStatus || !statusNode) return; statusNode.textContent = targets.length ? `Panoul va fi publicat pe ${targets.length === 1 ? 'canalul configurat' : 'canalele configurate'}.` : 'Selectează cel puțin un canal pentru „Stash”.'; };
  const publishStashPanel = async () => { const button = section.querySelector('#discord-stash-publish'); const statusNode = section.querySelector('#discord-stash-publish-status'); if (!button || !statusNode) return; const targets = selectedStashTargets(); const selectedOrganizationId = String(organizationId() || '').trim(); const activeOrganizationId = String(window.getActiveOrganizationId?.() || '').trim(); if (!targets.length) { statusNode.textContent = 'Selectează cel puțin un canal pentru „Stash”.'; return; } if (!selectedOrganizationId || !activeOrganizationId || selectedOrganizationId !== activeOrganizationId) { statusNode.textContent = 'Intră mai întâi în organizația aleasă din „Administrare organizații”, folosind modul de test.'; return; } button.disabled = true; statusNode.dataset.busy = '1'; statusNode.textContent = 'Se publică embedul Stash pe Discord...'; try { const response = await window.sendPanelDiscord('stash', buildStashPanelPayload(), { messageKey: 'stash-control', channelRoutes: window.getDiscordChannelRoutes?.() || {} }); const result = await response.clone().json().catch(() => ({})); const delivered = Number(result.routes || targets.length); statusNode.textContent = `Embedul Stash a fost ${result.messages?.some?.((item) => item.action === 'edited') ? 'actualizat' : 'publicat'} pe ${delivered} canal${delivered === 1 ? '' : 'e'}.`; } catch (error) { statusNode.textContent = error.message || 'Embedul Stash nu a putut fi publicat.'; } finally { delete statusNode.dataset.busy; syncStashPublishState(false); } };
  const publishStashRoutePanel = async (key, label, buttonId) => { const button = section.querySelector(`#${buttonId}`); if (!button) return; const targets = ['primary', 'secondary'].filter((target) => channelIsAccessible(target, key)); const statusNode = section.querySelector(`#${buttonId}-status`); if (!targets.length) { if (statusNode) statusNode.textContent = `Selectează cel puțin un canal pentru „${label}”.`; return; } button.disabled = true; try { const payload = { allowed_mentions: { parse: [] }, embeds: [{ title: `📦 ${label} · Panel Pro`, description: `Folosește butoanele pentru funcția ${label.toLowerCase()}. Datele sunt salvate în Supabase și respectă permisiunile organizației.`, color: key === 'stash' ? 0x22c55e : key === 'stash_requests' ? 0xf59e0b : 0xa78bfa, footer: { text: `Panel Pro · ${label}` } }], components: [{ type: 1, components: [{ type: 2, style: 1, label: key === 'stash_requests' ? 'Trimite cerere' : 'Donează către stash', custom_id: key === 'stash_requests' ? 'panel:stash:request' : 'panel:stash:donate' }] }] }; const response = await window.sendPanelDiscord(key, payload, { messageKey: `${key}-control`, channelRoutes: window.getDiscordChannelRoutes?.() || {} }); const result = await response.clone().json().catch(() => ({})); if (statusNode) statusNode.textContent = `Embedul ${label} a fost publicat pe ${Number(result.routes || targets.length)} canal${Number(result.routes || targets.length) === 1 ? '' : 'e'}.`; } catch (error) { if (statusNode) statusNode.textContent = error.message || `Embedul ${label} nu a putut fi publicat.`; } finally { button.disabled = false; } };
  const syncStashRoutePublishState = (key) => { const button = section.querySelector(`#discord-${key}-publish`); if (button) button.disabled = !['primary', 'secondary'].some((target) => channelIsAccessible(target, key)); };
  const buildContractsPanelPayload = () => ({
    allowed_mentions: { parse: [] },
    embeds: [{
      title: '📄 Contracte · Panel Pro',
      description: 'Generează contractul și completează manual numele și prenumele, CNP-ul și telefonul. După generare îl poți copia, apoi apasă „Adaugă imaginile” pentru a publica textul în canalul ales la „Log contracte”. Imaginile se adaugă manual sub mesaj.',
      color: 0x14b8a6,
      fields: [
        { name: 'Date preluate automat', value: 'Organizație, manager, șablon, funcție, salariu, program, data și număr contract.', inline: false },
        { name: 'Date completate la creare', value: 'CNP și număr de telefon. Imaginile se adaugă manual după publicarea contractului.', inline: false },
      ],
      footer: { text: 'Panel Pro · Contracte' },
    }],
    components: [{ type: 1, components: [{ type: 2, style: 1, label: 'Creează contract', custom_id: 'panel:contracts:create' }] }],
  });
  const syncContractsPublishState = (resetStatus = true) => {
    const button = section.querySelector('#discord-contracts-publish');
    const statusNode = section.querySelector('#discord-contracts-publish-status');
    if (!button) return;
    const targets = selectedContractsTargets();
    button.disabled = !targets.length;
    if (!resetStatus || !statusNode) return;
    if (!targets.length) statusNode.textContent = 'Selectează cel puțin un canal pentru „Contracte”.';
    else if (!statusNode.dataset.busy) statusNode.textContent = `Panoul va fi publicat pe ${targets.length === 1 ? 'canalul configurat' : 'canalele configurate'}.`;
  };
  const publishContractsPanel = async () => {
    const button = section.querySelector('#discord-contracts-publish');
    const statusNode = section.querySelector('#discord-contracts-publish-status');
    if (!button || !statusNode) return;
    const targets = selectedContractsTargets();
    const selectedOrganizationId = String(organizationId() || '').trim();
    const activeOrganizationId = String(window.getActiveOrganizationId?.() || '').trim();
    if (!targets.length) { statusNode.textContent = 'Selectează cel puțin un canal pentru „Contracte”.'; return; }
    if (!selectedOrganizationId || !activeOrganizationId || selectedOrganizationId !== activeOrganizationId) { statusNode.textContent = 'Intră mai întâi în organizația aleasă din „Administrare organizații”, folosind modul de test.'; return; }
    if (typeof window.sendPanelDiscord !== 'function') { statusNode.textContent = 'Modulul de trimitere Discord nu este disponibil pe această pagină.'; return; }
    button.disabled = true; statusNode.dataset.busy = '1'; statusNode.textContent = 'Se publică embedul Contracte pe Discord...';
    try {
      const response = await window.sendPanelDiscord('contracts', buildContractsPanelPayload(), { messageKey: 'contracts-control', channelRoutes: window.getDiscordChannelRoutes?.() || {} });
      const result = await response.clone().json().catch(() => ({}));
      const delivered = Number(result.routes || targets.length);
      statusNode.textContent = `Embedul Contracte a fost ${result.messages?.some?.((item) => item.action === 'edited') ? 'actualizat' : 'publicat'} pe ${delivered} canal${delivered === 1 ? '' : 'e'}.`;
    } catch (error) { statusNode.textContent = error.message || 'Embedul Contracte nu a putut fi publicat.'; }
    finally { delete statusNode.dataset.busy; syncContractsPublishState(false); }
  };
  const requestPanelDefinition = (key) => key === 'requests_organization'
    ? { label: 'Învoiri · Organizație', audience: 'Organizație', permission: 'cereri.organization' }
    : { label: 'Învoiri · Angajați', audience: 'Angajați', permission: 'cereri.departments' };
  const announcementPanelDefinition = (key) => key === 'organization'
    ? { label: 'Anunțuri · Organizație', audience: 'Organizație', route: 'organization' }
    : { label: 'Anunțuri · Angajați', audience: 'Angajați', route: 'departments' };
  const buildAnnouncementsPanelPayload = (key) => {
    const definition = announcementPanelDefinition(key);
    const prefix = definition.route;
    return {
      allowed_mentions: { parse: [] },
      embeds: [{
        title: `📣 ${definition.label} · Panel Pro`,
        description: `Publică anunțuri, întrebări și sondaje pentru ${definition.audience.toLowerCase()}. Înregistrările se salvează în Supabase și respectă rolurile configurate în panel.`,
        color: definition.route === 'organization' ? 0x22d3ee : 0x5865f2,
        fields: [
          { name: 'Ce poți face', value: 'Publică un anunț, adresează o întrebare sau creează un sondaj.', inline: false },
          { name: 'Interacțiuni', value: 'Membrii pot reacționa, vota și consulta postările publicate.', inline: false },
        ],
        footer: { text: `Panel Pro · ${definition.label}` },
      }],
       components: [
         { type: 1, components: [
           { type: 2, style: 1, label: 'Publică anunț', custom_id: `panel:announcements:${prefix}:create:announcement` },
           { type: 2, style: 2, label: 'Pune întrebare', custom_id: `panel:announcements:${prefix}:create:question` },
           { type: 2, style: 3, label: 'Creează sondaj', custom_id: `panel:announcements:${prefix}:create:poll` },
         ] },
         { type: 1, components: [
           { type: 2, style: 4, label: 'Avertisment', custom_id: `panel:discipline:${prefix}:warning` },
           { type: 2, style: 4, label: 'Sancțiune', custom_id: `panel:discipline:${prefix}:sanction` },
           ...(prefix === 'organization' ? [{ type: 2, style: 1, label: 'Acțiune', custom_id: 'panel:actions:organization:create' }, { type: 2, style: 2, label: 'Clasament acțiuni', custom_id: 'panel:actions:organization:stats' }] : []),
         ] },
       ],
    };
  };
  const selectedAnnouncementTargets = (key) => ['primary', 'secondary'].filter((target) => channelIsAccessible(target, key));
  const syncAnnouncementPublishState = (key, resetStatus = true) => {
    const button = section.querySelector(`#discord-${key}-publish`);
    const statusNode = section.querySelector(`#discord-${key}-publish-status`);
    if (!button) return;
    const targets = selectedAnnouncementTargets(key);
    button.disabled = !targets.length;
    if (!resetStatus || !statusNode) return;
    if (!targets.length) statusNode.textContent = `Selectează cel puțin un canal pentru „${announcementPanelDefinition(key).label}”.`;
    else if (!statusNode.dataset.busy) statusNode.textContent = `Panoul va fi publicat pe ${targets.length === 1 ? 'canalul configurat' : 'canalele configurate'}.`;
  };
  const publishAnnouncementsPanel = async (key) => {
    const button = section.querySelector(`#discord-${key}-publish`);
    const statusNode = section.querySelector(`#discord-${key}-publish-status`);
    if (!button || !statusNode) return;
    const targets = selectedAnnouncementTargets(key);
    const selectedOrganizationId = String(organizationId() || '').trim();
    const activeOrganizationId = String(window.getActiveOrganizationId?.() || '').trim();
    if (!targets.length) { statusNode.textContent = `Selectează cel puțin un canal pentru „${announcementPanelDefinition(key).label}”.`; return; }
    if (!selectedOrganizationId || !activeOrganizationId || selectedOrganizationId !== activeOrganizationId) { statusNode.textContent = 'Intră mai întâi în organizația aleasă din „Administrare organizații”, folosind modul de test.'; return; }
    if (typeof window.sendPanelDiscord !== 'function') { statusNode.textContent = 'Modulul de trimitere Discord nu este disponibil pe această pagină.'; return; }
    button.disabled = true; statusNode.dataset.busy = '1'; statusNode.textContent = `Se publică embedul ${announcementPanelDefinition(key).label} pe Discord...`;
    try {
      const response = await window.sendPanelDiscord(key, buildAnnouncementsPanelPayload(key), { messageKey: 'announcements-control', channelRoutes: window.getDiscordChannelRoutes?.() || {} });
      const result = await response.clone().json().catch(() => ({}));
      const delivered = Number(result.routes || targets.length);
      statusNode.textContent = `Embedul ${announcementPanelDefinition(key).label} a fost ${result.messages?.some?.((item) => item.action === 'edited') ? 'actualizat' : 'publicat'} pe ${delivered} canal${delivered === 1 ? '' : 'e'}.`;
    } catch (error) { statusNode.textContent = error.message || 'Embedul nu a putut fi publicat.'; }
    finally { delete statusNode.dataset.busy; syncAnnouncementPublishState(key, false); }
  };
  const selectedRouteTargets = (key) => ['primary', 'secondary'].filter((target) => channelIsAccessible(target, key));
  const buildRequestsPanelPayload = (key) => {
    const definition = requestPanelDefinition(key);
    const prefix = key === 'requests_organization' ? 'organization' : 'departments';
    return {
      allowed_mentions: { parse: [] },
      embeds: [{
        title: `📋 Învoiri · ${definition.audience} · Panel Pro`,
        description: `Folosește butoanele pentru a trimite o învoire pentru ${definition.audience.toLowerCase()}. Formularul se salvează în Supabase și respectă rolurile configurate în panel.`,
        color: 0xf59e0b,
        fields: [
          { name: 'Ce poți face', value: 'Depune o învoire și consultă istoricul tău.', inline: false },
          { name: 'Datele salvate', value: 'Tip, interval, motiv și dovadă opțională.', inline: false },
        ],
        footer: { text: `Panel Pro · Învoiri ${definition.audience}` },
      }],
      components: [
        { type: 1, components: [{ type: 2, style: 1, label: 'Trimite învoire', custom_id: `panel:requests:${prefix}:new` }, { type: 2, style: 2, label: 'Învoirile mele', custom_id: `panel:requests:${prefix}:mine` }] },
      ],
    };
  };
  const syncRequestPublishState = (key, resetStatus = true) => {
    const button = section.querySelector(`#discord-${key}-publish`);
    const statusNode = section.querySelector(`#discord-${key}-publish-status`);
    if (!button) return;
    const targets = selectedRouteTargets(key);
    button.disabled = !targets.length;
    if (!resetStatus || !statusNode) return;
    if (!targets.length) statusNode.textContent = `Selectează cel puțin un canal pentru „${requestPanelDefinition(key).label}”.`;
    else if (!statusNode.dataset.busy) statusNode.textContent = `Panoul va fi publicat pe ${targets.length === 1 ? 'canalul configurat' : 'canalele configurate'}.`;
  };
  const publishRequestsPanel = async (key) => {
    const button = section.querySelector(`#discord-${key}-publish`);
    const statusNode = section.querySelector(`#discord-${key}-publish-status`);
    if (!button || !statusNode) return;
    const targets = selectedRouteTargets(key);
    const selectedOrganizationId = String(organizationId() || '').trim();
    const activeOrganizationId = String(window.getActiveOrganizationId?.() || '').trim();
    if (!targets.length) { statusNode.textContent = `Selectează cel puțin un canal pentru „${requestPanelDefinition(key).label}”.`; return; }
    if (!selectedOrganizationId || !activeOrganizationId || selectedOrganizationId !== activeOrganizationId) { statusNode.textContent = 'Intră mai întâi în organizația aleasă din „Administrare organizații”, folosind modul de test.'; return; }
    if (typeof window.sendPanelDiscord !== 'function') { statusNode.textContent = 'Modulul de trimitere Discord nu este disponibil pe această pagină.'; return; }
    button.disabled = true; statusNode.dataset.busy = '1'; statusNode.textContent = `Se publică embedul ${requestPanelDefinition(key).label} pe Discord...`;
    try {
      const response = await window.sendPanelDiscord(key, buildRequestsPanelPayload(key), { messageKey: 'requests-control', channelRoutes: window.getDiscordChannelRoutes?.() || {} });
      const result = await response.clone().json().catch(() => ({}));
      const delivered = Number(result.routes || targets.length);
      statusNode.textContent = `Embedul ${requestPanelDefinition(key).label} a fost ${result.messages?.some?.((item) => item.action === 'edited') ? 'actualizat' : 'publicat'} pe ${delivered} canal${delivered === 1 ? '' : 'e'}.`;
    } catch (error) { statusNode.textContent = error.message || 'Embedul nu a putut fi publicat.'; }
    finally { delete statusNode.dataset.busy; syncRequestPublishState(key, false); }
  };
  const render = () => {
    grid.innerHTML = routeKeys.map((key) => `<fieldset class="rounded-lg border border-emerald-900/70 bg-slate-950/50 p-3${key === 'actions_organization' ? ' md:col-span-2' : ''}"><legend class="px-1 text-xs font-bold text-slate-200">${esc(labels[key])}</legend>${['primary', 'secondary'].map((target) => `<label class="mt-2 block text-xs text-slate-400">${target === 'primary' ? 'Canal principal' : 'Canal secundar'}<select class="field mt-1" data-discord-channel-route="${esc(key)}" data-discord-channel-target="${target}">${options(selectedChannel(key, target))}</select></label>`).join('')}${canPublishDiscordPanels && key === 'pontaj' ? '<div class="mt-3 rounded-lg border border-cyan-900/70 bg-cyan-950/20 p-3"><div class="flex flex-wrap items-center gap-2"><button id="discord-pontaj-publish" type="button" disabled class="rounded-xl bg-cyan-600 px-4 py-2 text-xs font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-40">📌 Publică embedul Pontaj</button><span id="discord-pontaj-publish-status" class="text-xs text-slate-400">Selectează canalul „Pontaj”, apoi publică panoul cu butoane.</span></div></div>' : ''}${canPublishDiscordPanels && ['requests_organization', 'requests_departments'].includes(key) ? `<div class="mt-3 rounded-lg border border-amber-900/70 bg-amber-950/20 p-3"><div class="flex flex-wrap items-center gap-2"><button id="discord-${key}-publish" type="button" disabled class="rounded-xl bg-amber-500 px-4 py-2 text-xs font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-40">📌 Publică embedul ${esc(requestPanelDefinition(key).label)}</button><span id="discord-${key}-publish-status" class="text-xs text-slate-400">Selectează canalul, apoi publică panoul cu butoane.</span></div></div>` : ''}${canPublishDiscordPanels && ['organization', 'departments'].includes(key) ? `<div class="mt-3 rounded-lg border border-violet-900/70 bg-violet-950/20 p-3"><div class="flex flex-wrap items-center gap-2"><button id="discord-${key}-publish" type="button" disabled class="rounded-xl bg-violet-500 px-4 py-2 text-xs font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-40">📌 Publică embedul ${esc(announcementPanelDefinition(key).label)}</button><span id="discord-${key}-publish-status" class="text-xs text-slate-400">Selectează canalul, apoi publică panoul cu butoane.</span></div></div>` : ''}${canPublishDiscordPanels && key === 'contracts' ? '<div class="mt-3 rounded-lg border border-teal-900/70 bg-teal-950/20 p-3"><div class="flex flex-wrap items-center gap-2"><button id="discord-contracts-publish" type="button" disabled class="rounded-xl bg-teal-500 px-4 py-2 text-xs font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-40">📌 Publică embedul Contracte</button><span id="discord-contracts-publish-status" class="text-xs text-slate-400">Selectează canalul, apoi publică panoul cu butoane.</span></div></div>' : ''}</fieldset>`).join('');
    grid.querySelectorAll('[data-discord-channel-route]').forEach((select) => { select.onchange = () => { const key = select.dataset.discordChannelRoute; setRoute(key, select.dataset.discordChannelTarget, select.value); syncPontajPublishState(); syncContractsPublishState(); if (['requests_organization', 'requests_departments'].includes(key)) syncRequestPublishState(key); if (['organization', 'departments'].includes(key)) syncAnnouncementPublishState(key); }; });
    const stashFieldset = grid.querySelector('[data-discord-channel-route="stash"]')?.closest('fieldset');
    grid.querySelector('[data-discord-channel-route="actions_organization"]')?.closest('fieldset')?.classList.remove('md:col-span-2');
    if (stashFieldset) { stashFieldset.classList.add('md:row-span-3'); stashFieldset.insertAdjacentHTML('beforeend', '<div class="mt-3 rounded-lg border border-emerald-900/70 bg-emerald-950/20 p-3"><div class="flex flex-wrap items-center gap-2"><button id="discord-stash-publish" type="button" disabled class="rounded-xl bg-emerald-500 px-4 py-2 text-xs font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-40">📌 Publică embedul Stash</button><span id="discord-stash-publish-status" class="text-xs text-slate-400">Selectează canalul, apoi publică panoul cu butoane.</span></div></div>'); }
    [['stash_requests', 'Cereri stash'], ['stash_donations', 'Donații stash']].forEach(([key, label]) => { const fieldset = grid.querySelector(`[data-discord-channel-route="${key}"]`)?.closest('fieldset'); if (fieldset) fieldset.insertAdjacentHTML('beforeend', `<div class="mt-3 rounded-lg border border-emerald-900/70 bg-emerald-950/20 p-3"><div class="flex flex-wrap items-center gap-2"><button id="discord-${key}-publish" type="button" disabled class="rounded-xl bg-emerald-500 px-4 py-2 text-xs font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-40">📌 Publică embedul ${label}</button><span id="discord-${key}-publish-status" class="text-xs text-slate-400">Selectează canalul, apoi publică panoul cu butoane.</span></div></div>`); });
    grid.querySelectorAll('[data-discord-channel-route]').forEach((select) => {
      const target = select.dataset.discordChannelTarget;
      const targetGuildId = guildIdForTarget(target);
      const unavailable = state.discoveryAttempted && Boolean(targetGuildId) && !state.guildAvailability[target];
      const label = select.closest('label');
      if (label?.firstChild) label.firstChild.textContent = target === 'primary' ? 'Discord principal' : 'Discord secundar';
      select.innerHTML = options(selectedChannel(select.dataset.discordChannelRoute, target), target);
      select.disabled = !targetGuildId || unavailable;
    });
    grid.querySelectorAll('[data-discord-channel-route="stash"]').forEach((select) => select.addEventListener('change', () => syncStashPublishState()));
    ['stash_requests', 'stash_donations'].forEach((key) => { grid.querySelectorAll(`[data-discord-channel-route="${key}"]`).forEach((select) => select.addEventListener('change', () => syncStashRoutePublishState(key))); syncStashRoutePublishState(key); });
    grid.querySelector('#discord-pontaj-publish')?.addEventListener('click', publishPontajPanel);
    grid.querySelector('#discord-contracts-publish')?.addEventListener('click', publishContractsPanel);
    grid.querySelector('#discord-stash-publish')?.addEventListener('click', publishStashPanel);
    [['stash_requests', 'Cereri stash'], ['stash_donations', 'Donații stash']].forEach(([key, label]) => { grid.querySelector(`#discord-${key}-publish`)?.addEventListener('click', () => publishStashRoutePanel(key, label, `discord-${key}-publish`)); });
    ['requests_organization', 'requests_departments'].forEach((key) => grid.querySelector(`#discord-${key}-publish`)?.addEventListener('click', () => publishRequestsPanel(key)));
    ['organization', 'departments'].forEach((key) => grid.querySelector(`#discord-${key}-publish`)?.addEventListener('click', () => publishAnnouncementsPanel(key)));
    syncPontajPublishState();
    syncContractsPublishState();
    syncStashPublishState();
    ['requests_organization', 'requests_departments'].forEach((key) => syncRequestPublishState(key));
    ['organization', 'departments'].forEach((key) => syncAnnouncementPublishState(key));
  };
  const discover = async () => {
    const targets = guildTargets();
    if (!targets.length) { status.textContent = 'Completează și verifică mai întâi cel puțin un Guild ID.'; return; }
    const cfg = getConfig();
    if (!cfg.url || !cfg.publishableKey) { status.textContent = 'Configurația Supabase nu este disponibilă.'; return; }
    status.textContent = 'Se încarcă canalele Discord...';
    let loaded = 0;
    state.discoveryAttempted = true;
    state.guildAvailability = { primary: false, secondary: false };
    for (const { target, id: guildId } of targets) {
      try {
        const response = await fetch(`${cfg.url}/functions/v1/discover-discord-channels`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: cfg.publishableKey, Authorization: `Bearer ${cfg.publishableKey}`, 'x-panel-session': localStorage.getItem('panel_session_token') || '' }, body: JSON.stringify({ guild_id: guildId, organization_id: organizationId(), access_token: window.getPanelDiscordAccessToken?.() || '' }) });
        const result = await response.json();
        if (!response.ok) {
          if (response.status === 404) throw new Error('Descoperirea automată a canalelor nu este disponibilă pe Supabase remote încă. Publică funcția discover-discord-channels și încearcă din nou.');
          throw new Error(result.error || `HTTP ${response.status}`);
        }
       state.channelsByGuild[guildId] = result.channels || [];
       state.guildNames[guildId] = result.guild?.name || guildId;
        state.guildAvailability[target] = true;
        loaded += state.channelsByGuild[guildId].length;
      } catch (error) { state.guildAvailability[target] = false; status.textContent = error.message || 'Canalele nu au putut fi încărcate.'; }
    }
    render();
    if (loaded && targets.some((item) => item.target === 'secondary') && state.guildAvailability.secondary === false) status.textContent = `${loaded} canale text disponibile doar pe Discord principal. Botul nu este prezent pe Discord secundar; selectorul secundar rămâne dezactivat.`;
    else if (loaded) status.textContent = `${loaded} canale text disponibile. Selectează destinațiile și salvează configurația.`;
  };
  window.getDiscordChannelRoutes = () => JSON.parse(JSON.stringify(state.routes || {}));
  window.setDiscordChannelRoutes = (routes) => { state.routes = routes && typeof routes === 'object' ? JSON.parse(JSON.stringify(routes)) : {}; render(); };
  state.routes = window.discordChannelRoutesInitial && typeof window.discordChannelRoutesInitial === 'object' ? window.discordChannelRoutesInitial : {};
  section.querySelector('#discord-channel-discover').onclick = discover;
  render();
  };
  window.initializeDiscordChannelConfig = initializeDiscordChannelConfig;
  initializeDiscordChannelConfig();
})();
