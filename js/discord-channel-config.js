(() => {
  const initializeDiscordChannelConfig = () => {
  const root = document.getElementById('webhooks') || document.getElementById('owner-webhooks') || document.getElementById('draft-webhooks');
  if (!root) return;
  if (document.getElementById('discord-channel-routes')) return;
  const isDraft = root.id === 'draft-webhooks';
  const isOwner = root.id === 'owner-webhooks';
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const routeKeys = [...root.querySelectorAll(isOwner ? '[data-owner-webhook]' : isDraft ? '[data-draft-webhook]' : '[id^="wh_primary_url_"]')]
    .map((input) => isOwner ? input.dataset.ownerWebhook : isDraft ? input.dataset.draftWebhook : input.id.replace(/^wh_primary_url_/, ''))
    .filter((key, index, list) => key && list.indexOf(key) === index);
  const labels = Object.fromEntries(routeKeys.map((key) => {
    const input = isOwner ? root.querySelector(`[data-owner-webhook="${key}"]`) : isDraft ? root.querySelector(`[data-draft-webhook="${key}"]`) : document.getElementById(`wh_primary_url_${key}`);
    return [key, input?.closest('fieldset')?.querySelector('legend')?.textContent?.trim() || key];
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
    const renderChannel = (channel) => `<option value="${esc(channel.id)}" ${channel.id === selected ? 'selected' : ''}>#${esc(channel.name)}${channel.has_webhook ? ' · are webhook' : ''}</option>`;
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
  section.innerHTML = `<div class="flex flex-wrap items-center justify-between gap-3"><div><h2 class="font-bold">Canale Discord pentru bot</h2><p class="mt-1 text-xs text-slate-400">Selectează unde trimite botul toate embed-urile. Webhook-urile de mai jos rămân backup automat.</p></div><button id="discord-channel-discover" type="button" class="rounded-xl bg-emerald-700 px-4 py-2 text-xs font-black text-white">Încarcă canalele Discord</button></div><p id="discord-channel-status" class="mt-2 text-xs text-slate-400">Nu s-au încărcat încă canalele.</p><div id="discord-channel-grid" class="mt-3 grid gap-3 md:grid-cols-2"></div>`;
  root.closest('details')?.before(section);
  const grid = section.querySelector('#discord-channel-grid');
  const status = section.querySelector('#discord-channel-status');
  const render = () => {
    grid.innerHTML = routeKeys.map((key) => `<fieldset class="rounded-lg border border-emerald-900/70 bg-slate-950/50 p-3"><legend class="px-1 text-xs font-bold text-slate-200">${esc(labels[key])}</legend>${['primary', 'secondary'].map((target) => `<label class="mt-2 block text-xs text-slate-400">${target === 'primary' ? 'Canal principal' : 'Canal secundar'}<select class="field mt-1" data-discord-channel-route="${esc(key)}" data-discord-channel-target="${target}">${options(selectedChannel(key, target))}</select></label>`).join('')}</fieldset>`).join('');
   grid.querySelectorAll('[data-discord-channel-route]').forEach((select) => { select.onchange = () => setRoute(select.dataset.discordChannelRoute, select.dataset.discordChannelTarget, select.value); });
    grid.querySelectorAll('[data-discord-channel-route]').forEach((select) => {
      const target = select.dataset.discordChannelTarget;
      const targetGuildId = guildIdForTarget(target);
      const unavailable = state.discoveryAttempted && Boolean(targetGuildId) && !state.guildAvailability[target];
      const label = select.closest('label');
      if (label?.firstChild) label.firstChild.textContent = target === 'primary' ? 'Discord principal' : 'Discord secundar';
      select.innerHTML = options(selectedChannel(select.dataset.discordChannelRoute, target), target);
      select.disabled = !targetGuildId || unavailable;
    });
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
          if (response.status === 404) throw new Error('Descoperirea automată a canalelor nu este disponibilă pe Supabase remote încă. Funcția trebuie publicată; webhook-urile rămân disponibile ca backup.');
          throw new Error(result.error || `HTTP ${response.status}`);
        }
       state.channelsByGuild[guildId] = result.channels || [];
       state.guildNames[guildId] = result.guild?.name || guildId;
        state.guildAvailability[target] = true;
        loaded += state.channelsByGuild[guildId].length;
        if (result.can_read_webhooks === false) status.textContent = 'Canalele au fost încărcate; nu s-a putut verifica existența webhook-urilor fără Manage Webhooks.';
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
