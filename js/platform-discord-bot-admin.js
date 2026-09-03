(() => {
  'use strict';
  if (typeof isPlatformAdmin === 'function' && !isPlatformAdmin()) { window.location.href = '403.html'; return; }
  const state = { organizations: [], busy: false };
  const $ = (id) => document.getElementById(id);
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  const status = (message, kind = '') => { $('status').textContent = message; $('status').className = `status ${kind}`; };
  const api = (body) => window.panelRequestJson('manage-organizations', { method: 'POST', timeoutMs: 30000, body: JSON.stringify(body) });
  const discoverBotGuilds = async () => {
    const token = window.getPanelDiscordAccessToken?.() || '';
    const config = window.PANEL_SUPABASE_CONFIG || {};
    if (!token || !config.url || !config.publishableKey) throw new Error('Sesiunea Discord lipsește. Intră din nou prin login cu Discord pentru a încărca serverele botului.');
    const response = await fetch(`${config.url}/functions/v1/manage-discord-bot`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: config.publishableKey, Authorization: `Bearer ${config.publishableKey}`, 'x-panel-session': localStorage.getItem('panel_session_token') || '' }, body: JSON.stringify({ action: 'bootstrap', access_token: token, application_id: window.PANEL_DISCORD_CONFIG?.clientId || '1531023771211792384' }) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'Serverele Discord nu au putut fi verificate.');
    return result;
  };
  const guild = (organization) => (organization.guilds || []).find((item) => item.enabled !== false) || organization.guilds?.[0] || {};
  const render = () => {
    const query = String($('search').value || '').trim().toLowerCase();
    const rows = state.organizations.filter((organization) => {
      const server = guild(organization);
      return [organization.name, organization.slug, server.guild_name, server.guild_id].join(' ').toLowerCase().includes(query);
    });
    $('list').innerHTML = rows.length ? rows.map((organization) => {
      const server = guild(organization);
      const statusLabel = organization.health?.status === 'active' ? 'Activ' : organization.health?.status === 'draft' ? 'Draft' : 'Inactiv';
      return `<article class="bot-card"><p class="eyebrow">Bot Discord separat</p><h2>${esc(server.guild_name || organization.name || 'Server Discord')}</h2><p class="meta">${esc(organization.name)}<br>Guild ID: <code>${esc(server.guild_id || '—')}</code></p><div class="badges"><span class="badge live">${statusLabel}</span><span class="badge">Organizație: ${esc(organization.id)}</span><span class="badge">${organization.package?.code === 'full' ? 'Premium / Full' : 'Configurație Discord-only'}</span></div><div class="card-actions"><a class="button cyan" href="discord-bot.html${server.guild_id ? `?guild_id=${encodeURIComponent(server.guild_id)}` : ''}">🤖 Administrează botul</a><button class="button" type="button" data-enter="${esc(organization.id)}">🧪 Intră în organizație · mod test</button><button class="button" type="button" data-premium="${esc(server.guild_id || '')}">⭐ Acordă Premium</button><a class="button" href="administrare-organizatii-platforma.html?organization=${encodeURIComponent(organization.id)}">Detalii organizație</a></div></article>`;
    }).join('') : '<div class="empty">Nu există servere Discord-only care să corespundă căutării.</div>';
    $('list').querySelectorAll('[data-enter]').forEach((button) => button.addEventListener('click', () => enter(button.dataset.enter)));
    $('list').querySelectorAll('[data-premium]').forEach((button) => button.addEventListener('click', () => grantPremium(button.dataset.premium)));
  };
  const grantPremium = async (guildId) => {
    const token = window.getPanelDiscordAccessToken?.() || '';
    if (!token || !guildId) { status('Sesiunea Discord lipsește. Reautentifică-te din login.', 'error'); return; }
    const value = window.prompt('Câte zile de Premium acordăm? Scrie 0 pentru acces fără expirare.', '30');
    if (value === null) return;
    const days = Number(value);
    if (!Number.isInteger(days) || days < 0 || days > 3650) { status('Introdu un număr întreg între 0 și 3650.', 'error'); return; }
    if (!window.confirm(`Confirmi acordarea Premium pentru ${days === 0 ? 'o perioadă nelimitată' : `${days} zile`}?`)) return;
    try { await fetchGrant(guildId, days); status('Accesul Premium a fost acordat serverului.', 'ok'); await load(); } catch (error) { status(error.message || 'Premium nu a putut fi acordat.', 'error'); }
  };
  const fetchGrant = async (guildId, days) => { const config = window.PANEL_SUPABASE_CONFIG || {}; const response = await fetch(`${config.url}/functions/v1/manage-discord-bot`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: config.publishableKey, Authorization: `Bearer ${config.publishableKey}`, 'x-panel-session': localStorage.getItem('panel_session_token') || '' }, body: JSON.stringify({ action: 'grant_premium', access_token: window.getPanelDiscordAccessToken?.() || '', guild_id: guildId, days, application_id: window.PANEL_DISCORD_CONFIG?.clientId || '1531023771211792384' }) }); const result = await response.json().catch(() => ({})); if (!response.ok) throw new Error(result.error || 'Acordarea Premium a eșuat.'); return result; };
  const enter = async (organizationId) => {
    if (state.busy) return;
    const organization = state.organizations.find((item) => String(item.id) === String(organizationId));
    const token = window.getPanelDiscordAccessToken?.() || '';
    if (!organization || !token) { status('Sesiunea Discord lipsește. Reautentifică-te din login.', 'error'); return; }
    if (!window.confirm(`Intri ca administrator în „${organization.name}” în modul test?`)) return;
    state.busy = true; status('Se activează organizația selectată…');
    try {
      const result = await window.panelRequestJson('sync-discord-role', { method: 'POST', timeoutMs: 30000, body: JSON.stringify({ access_token: token, organization_id: organization.id }) });
      if (!result?.session_token) throw new Error('Organizația nu a putut fi activată.');
      localStorage.setItem('panel_platform_return_organization', JSON.stringify(window.getActiveOrganization?.() || {}));
      localStorage.setItem('panel_platform_context', JSON.stringify({ organization_id: organization.id, organization_name: organization.name, entered_at: new Date().toISOString(), mode: 'platform_admin' }));
      localStorage.setItem('discord_user', JSON.stringify(result.user || {})); localStorage.setItem('user_role', 'Administrator platformă');
      localStorage.setItem('panel_session_token', result.session_token); localStorage.setItem('panel_session_expires_at', result.expires_at || '');
      localStorage.setItem('panel_active_organization', JSON.stringify(result.active_organization || {})); localStorage.setItem('panel_organizations', JSON.stringify(result.organizations || []));
      window.location.href = 'index.html';
    } catch (error) { status(error.message || 'Organizația nu a putut fi activată.', 'error'); state.busy = false; }
  };
  const load = async () => { if (state.busy) return; state.busy = true; status('Se verifică serverele în Discord și se încarcă registrul…'); try { const discovered = await discoverBotGuilds(); const result = await api({ action: 'platform_overview' }); const organizations = (result.organizations || []).filter((organization) => organization.access_mode === 'discord_only' || String(organization.slug || '').startsWith('discord-')); const known = new Set(organizations.flatMap((organization) => (organization.guilds || []).map((item) => String(item.guild_id)))); (discovered?.guilds || []).forEach((server) => { if (known.has(String(server.id))) return; organizations.push({ id: server.organization_id, name: server.organization_name || server.name, slug: `discord-${server.id}`, access_mode: 'discord_only', active: true, guilds: [{ guild_id: server.id, guild_name: server.name, enabled: true }], health: { status: 'active' }, package: { code: server.plan === 'premium' ? 'full' : 'standard' } }); }); const installations = Array.isArray(result.discord_installations) ? result.discord_installations : []; installations.filter((item) => item.status === 'active' && !known.has(String(item.guild_id)) && !(discovered?.guilds || []).some((server) => String(server.id) === String(item.guild_id))).forEach((item) => organizations.push({ id: item.organization_id || `discord-installation-${item.guild_id}`, name: item.guild_name || `Server Discord ${item.guild_id}`, slug: `discord-${item.guild_id}`, access_mode: 'discord_only', active: true, guilds: [{ guild_id: item.guild_id, guild_name: item.guild_name, enabled: true }], health: { status: 'active' }, package: { code: 'standard' }, installation: item })); state.organizations = organizations; render(); const diagnostic = discovered?.diagnostics; const removed = discovered?.reconciliation?.removed || 0; const suffix = diagnostic && !state.organizations.length ? ` OAuth: ${diagnostic.oauth_guild_count || 0}, owner: ${diagnostic.owner_guild_count || 0}, verificări bot: ${diagnostic.bot_check_count || 0}.` : ''; status(`Au fost găsite ${state.organizations.length} servere cu bot Discord${removed ? ` · ${removed} eliminate` : ''}.${suffix}`, state.organizations.length ? 'ok' : 'error'); } catch (error) { $('list').innerHTML = `<div class="empty">${esc(error.message || 'Registrul nu a putut fi încărcat.')}</div>`; status(error.message || 'Eroare de încărcare.', 'error'); } finally { state.busy = false; } };
  $('search').addEventListener('input', render); $('refresh').addEventListener('click', load); load();
})();
