import { createClient } from 'jsr:@supabase/supabase-js@2.112.3';
import { requirePanelSession } from '../_shared/panel-session.ts';
import { isPlatformAdminAccount } from '../_shared/platform-admin.ts';
import { getPlatformSecret } from '../_shared/platform-secrets.ts';

const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-panel-session', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Content-Type': 'application/json' };
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers });
const api = 'https://discord.com/api/v10';
const id = (value: unknown) => /^\d{15,22}$/.test(String(value || '').trim()) ? String(value).trim() : '';
const VIEW = 1024n, SEND = 2048n, EMBED = 16384n, HISTORY = 65536n, MANAGE_MESSAGES = 8192n;
const allow = (...bits: bigint[]) => bits.reduce((sum, bit) => sum | bit, 0n).toString();

const routeLabels: Record<string, string> = {
  organization: 'Anunțuri organizație', departments: 'Anunțuri angajați', pontaj: 'Pontaj și ture', weekly_reports: 'Rapoarte săptămânale', requests: 'Cereri', requests_organization: 'Învoiri organizație', requests_departments: 'Învoiri angajați', contracts: 'Contracte', contract_identity_weekly: 'Raport săptămânal contracte', marketplace: 'Marketplace legal', illegal_marketplace: 'Marketplace ilegal', illegal_locations: 'Locații ilegale', fines_organization: 'Amenzi organizație', fines_departments: 'Amenzi angajați', warnings_organization: 'Avertismente organizație', warnings_departments: 'Avertismente angajați', sanctions_organization: 'Sancțiuni organizație', sanctions_departments: 'Sancțiuni angajați', actions_organization: 'Acțiuni organizație', actions_organization_weekly: 'Clasament acțiuni săptămânal', event_reminders: 'Evenimente și remindere', status_live: 'Status Live', organization_expiration: 'Expirare organizație', stash: 'Stash organizație', stash_requests: 'Cereri Stash', stash_donations: 'Donații Stash', log_pontaj: 'Log pontaj', log_requests_organization: 'Log învoiri organizație', log_requests_departments: 'Log învoiri angajați', log_announcements_organization: 'Log anunțuri organizație', log_announcements_departments: 'Log anunțuri angajați', log_contracts: 'Log contracte', log_discipline_organization: 'Log disciplină organizație', log_discipline_departments: 'Log disciplină angajați', log_stash: 'Log Stash', log_stash_requests: 'Log cereri Stash', log_stash_donations: 'Log donații Stash', log_actions_organization: 'Log acțiuni', log_marketplace: 'Log marketplace legal', log_illegal_marketplace: 'Log marketplace ilegal', log_event_reminders: 'Log evenimente', log_contract_identity_weekly: 'Log raport contracte', contract_uploads: 'Upload contracte'
};
const allRoutes = Object.keys(routeLabels);
const bundles: Record<string, string[]> = {
  full: allRoutes,
  legal_management: ['organization', 'departments', 'pontaj', 'weekly_reports', 'requests', 'requests_organization', 'requests_departments', 'contracts', 'contract_identity_weekly', 'marketplace', 'fines_departments', 'warnings_departments', 'sanctions_departments', 'actions_organization', 'actions_organization_weekly', 'event_reminders', 'status_live', 'organization_expiration', 'log_pontaj', 'log_requests_organization', 'log_requests_departments', 'log_announcements_organization', 'log_announcements_departments', 'log_contracts', 'log_discipline_departments', 'log_actions_organization', 'log_marketplace', 'log_event_reminders', 'log_contract_identity_weekly', 'contract_uploads'],
  illegal: ['illegal_marketplace', 'illegal_locations', 'fines_organization', 'fines_departments', 'warnings_organization', 'warnings_departments', 'sanctions_organization', 'sanctions_departments', 'actions_organization', 'actions_organization_weekly', 'event_reminders', 'status_live', 'stash', 'stash_requests', 'stash_donations', 'organization_expiration', 'log_illegal_marketplace', 'log_discipline_organization', 'log_discipline_departments', 'log_actions_organization', 'log_event_reminders', 'log_stash', 'log_stash_requests', 'log_stash_donations', 'contract_uploads']
};
const logFor: Record<string, string> = { organization: 'log_announcements_organization', departments: 'log_announcements_departments', pontaj: 'log_pontaj', requests_organization: 'log_requests_organization', requests_departments: 'log_requests_departments', contracts: 'log_contracts', contract_identity_weekly: 'log_contract_identity_weekly', marketplace: 'log_marketplace', illegal_marketplace: 'log_illegal_marketplace', event_reminders: 'log_event_reminders', actions_organization: 'log_actions_organization', fines_organization: 'log_discipline_organization', fines_departments: 'log_discipline_departments', warnings_organization: 'log_discipline_organization', warnings_departments: 'log_discipline_departments', sanctions_organization: 'log_discipline_organization', sanctions_departments: 'log_discipline_departments', stash: 'log_stash', stash_requests: 'log_stash_requests', stash_donations: 'log_stash_donations' };
const routeNames: Record<string, string> = { organization: '📣・anunturi-organizatie', departments: '📣・anunturi-angajati', pontaj: '⏱️・pontaj', weekly_reports: '📊・rapoarte-saptamanale', requests: '📋・cereri', requests_organization: '📋・invoiri-organizatie', requests_departments: '📋・invoiri-angajati', contracts: '📄・contracte', contract_identity_weekly: '📄・raport-contracte-saptamanal', marketplace: '🛒・marketplace-legal', illegal_marketplace: '🚨・marketplace-ilegal', illegal_locations: '🗺️・locatii-ilegale', fines_organization: '💰・amenzi-organizatie', fines_departments: '💰・amenzi-angajati', warnings_organization: '⚠️・avertismente-organizatie', warnings_departments: '⚠️・avertismente-angajati', sanctions_organization: '🔒・sanctiuni-organizatie', sanctions_departments: '🔒・sanctiuni-angajati', actions_organization: '🎯・actiuni-organizatie', actions_organization_weekly: '🏆・clasament-actiuni', event_reminders: '🗓️・evenimente', status_live: '📡・status-live', organization_expiration: '⏳・expirare-organizatie', stash: '📦・stash', stash_requests: '📨・cereri-stash', stash_donations: '🎁・donatii-stash', log_pontaj: '🧾・log-pontaj', log_requests_organization: '🧾・log-invoiri-organizatie', log_requests_departments: '🧾・log-invoiri-angajati', log_announcements_organization: '🧾・log-anunturi-organizatie', log_announcements_departments: '🧾・log-anunturi-angajati', log_contracts: '🧾・log-contracte', log_discipline_organization: '🧾・log-disciplina-organizatie', log_discipline_departments: '🧾・log-disciplina-angajati', log_stash: '🧾・log-stash', log_stash_requests: '🧾・log-cereri-stash', log_stash_donations: '🧾・log-donatii-stash', log_actions_organization: '🧾・log-actiuni', log_marketplace: '🧾・log-marketplace-legal', log_illegal_marketplace: '🧾・log-marketplace-ilegal', log_event_reminders: '🧾・log-evenimente', log_contract_identity_weekly: '🧾・log-raport-contracte', contract_uploads: '🧾・upload-contracte' };

const definitions: Record<string, any> = {
  organization: { title: '📢 Anunțuri · Organizație', description: 'Publică anunțuri, întrebări, sondaje și măsuri disciplinare pentru organizație.', color: 0x8b5cf6, buttons: [['Publică anunț', 1, 'panel:announcements:organization:create:announcement'], ['Pune întrebare', 2, 'panel:announcements:organization:create:question'], ['Creează sondaj', 3, 'panel:announcements:organization:create:poll'], ['Avertisment', 4, 'panel:discipline:organization:warning'], ['Amendă', 4, 'panel:discipline:organization:sanction']] },
  departments: { title: '📢 Anunțuri · Angajați', description: 'Publică anunțuri, întrebări, sondaje și măsuri disciplinare pentru angajați.', color: 0x8b5cf6, buttons: [['Publică anunț', 1, 'panel:announcements:departments:create:announcement'], ['Pune întrebare', 2, 'panel:announcements:departments:create:question'], ['Creează sondaj', 3, 'panel:announcements:departments:create:poll'], ['Avertisment', 4, 'panel:discipline:departments:warning'], ['Amendă', 4, 'panel:discipline:departments:sanction']] },
  pontaj: { title: '🕒 Pontaj · Panel Pro', description: 'Alege tura și folosește butoanele pentru Start, Pauză și Stop.', color: 0x22c55e, buttons: [['Tura de zi', 1, 'panel:pontaj:shift_day'], ['Tura de noapte', 1, 'panel:pontaj:shift_night'], ['Start', 3, 'panel:pontaj:start'], ['Pauză', 2, 'panel:pontaj:pause'], ['Stop', 4, 'panel:pontaj:stop'], ['Pontajul meu', 1, 'panel:pontaj:my_stats']] },
  requests_organization: { title: '📝 Învoiri · Organizație', description: 'Trimite și consultă învoirile organizației.', color: 0xf59e0b, buttons: [['Trimite învoire', 1, 'panel:requests:organization:new'], ['Învoirile mele', 2, 'panel:requests:organization:mine']] },
  requests_departments: { title: '📝 Învoiri · Angajați', description: 'Trimite și consultă învoirile angajaților.', color: 0xf59e0b, buttons: [['Trimite învoire', 1, 'panel:requests:departments:new'], ['Învoirile mele', 2, 'panel:requests:departments:mine']] },
  contracts: { title: '📄 Contracte · Panel Pro', description: 'Generează și trimite contracte folosind șablonul organizației.', color: 0x14b8a6, buttons: [['Creează contract', 1, 'panel:contracts:create'], ['Setează contractul', 2, 'panel:contracts:settings'], ['Info contract', 1, 'panel:contracts:info']] },
  marketplace: { title: '🛒 Marketplace', description: 'Publică și consultă anunțuri pentru vehicule, bunuri și servicii.', color: 0x2563eb, buttons: [['Publică anunț', 1, 'panel:marketplace:legal:create'], ['Anunțurile mele', 2, 'panel:marketplace:legal:mine']] },
  illegal_marketplace: { title: '🚨 Marketplace · Ilegal', description: 'Publică și consultă anunțuri Black Market, cu acces controlat.', color: 0xef4444, buttons: [['Publică anunț', 4, 'panel:marketplace:illegal:create'], ['Anunțurile mele', 2, 'panel:marketplace:illegal:mine']] },
  illegal_locations: { title: '🗺️ Locații ilegale · Panel Pro', description: 'Catalog global informativ cu locații pentru Los Santos, Cayo Perico și Maldive. Consultă harta și detaliile direct în Panel Pro.', color: 0xef4444, buttons: [['Deschide locațiile', 5, '', 'https://panel-pro.ro/locatiiilegale.html'], ['Los Santos', 5, '', 'https://panel-pro.ro/locatiiilegale.html?map=ls'], ['Cayo Perico', 5, '', 'https://panel-pro.ro/locatiiilegale.html?map=cayo'], ['Maldive', 5, '', 'https://panel-pro.ro/locatiiilegale.html?map=maldive']] },
  event_reminders: { title: '🗓️ Evenimente și remindere', description: 'Înregistrează evenimente și trimite remindere automate.', color: 0xf59e0b, buttons: [['Adaugă eveniment', 1, 'panel:discovery:reminder_create'], ['Info remindere', 2, 'panel:discovery:reminder_info']] },
  contract_identity_weekly: { title: '📋 Raport săptămânal contracte', description: 'Generează exportul săptămânal cu numele și CNP-ul angajaților.', color: 0x14b8a6, buttons: [['Generează raport', 1, 'panel:discovery:weekly_report'], ['Info raport', 2, 'panel:discovery:report_info']] },
  actions_organization: { title: '🎯 Acțiuni · Organizație', description: 'Înregistrează și consultă acțiunile organizației.', color: 0x3b82f6, buttons: [['Acțiune', 1, 'panel:actions:organization:create'], ['Clasament acțiuni', 2, 'panel:actions:organization:stats']] },
  stash: { title: '📦 Stash · Administrare', description: 'Gestionează articolele, cererile și donațiile Stash.', color: 0x22c55e, buttons: [['Adaugă în Stash', 3, 'panel:stash:create'], ['Cereri în așteptare', 1, 'panel:stash:pending_requests'], ['Donații în așteptare', 1, 'panel:stash:pending_donations']] },
  stash_requests: { title: '📨 Cereri Stash', description: 'Solicită articole și urmărește cererile pentru aprobare.', color: 0x3b82f6, buttons: [['Solicită articol', 1, 'panel:stash:request'], ['Cereri în așteptare', 2, 'panel:stash:pending_requests']] },
  stash_donations: { title: '🎁 Donații Stash', description: 'Înregistrează donații și trimite-le spre aprobare.', color: 0x22c55e, buttons: [['Donează articol', 3, 'panel:stash:donate'], ['Donații în așteptare', 2, 'panel:stash:pending_donations']] }
};

async function discord(path: string, token: string, init: RequestInit = {}) {
  const response = await fetch(`${api}${path}`, { ...init, headers: { Authorization: `Bot ${token}`, 'Content-Type': 'application/json', ...(init.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Discord a refuzat operația (${response.status}): ${String(data?.message || data?.code || 'eroare necunoscută')}.`);
  return data;
}
async function ensureChannel(guildId: string, token: string, channels: any[], name: string, type: number, parentId: string, overwrites: any[]) {
  const found = channels.find((row) => String(row?.name || '').trim() === name && Number(row?.type) === type && (!parentId || String(row?.parent_id || '') === parentId));
  if (found) return { row: found, created: false };
  const row = await discord(`/guilds/${guildId}/channels`, token, { method: 'POST', body: JSON.stringify({ name, type, ...(parentId ? { parent_id: parentId } : {}), permission_overwrites: overwrites }) });
  channels.push(row); return { row, created: true };
}
const payload = (routeKey: string) => {
  const definition = definitions[routeKey] || { title: `⚙️ ${routeLabels[routeKey] || 'Panel Pro'}`, description: `Embed Panel Pro pentru ${routeLabels[routeKey] || routeKey}.`, color: 0x5865f2, buttons: [] };
  const components: any[] = [];
  // Discord permite maximum 5 butoane într-un action row și maximum 5 rânduri.
  // Împărțim automat listele mai lungi (de exemplu Pontaj are 6 butoane).
  for (let index = 0; index < definition.buttons.length && components.length < 5; index += 5) {
    components.push({
      type: 1,
      components: definition.buttons.slice(index, index + 5).map((button: any[]) => button[1] === 5
        ? { type: 2, style: 5, label: button[0], url: button[3] }
        : { type: 2, style: button[1], label: button[0], custom_id: button[2] })
    });
  }
  return { allowed_mentions: { parse: [] }, embeds: [{ title: definition.title, description: definition.description, color: definition.color, footer: { text: 'Panel Pro · configurat din Discord' } }], components };
};
const hasInteractiveDefinition = (routeKey: string) => Array.isArray(definitions[routeKey]?.buttons) && definitions[routeKey].buttons.length > 0;

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return reply({ error: 'Metodă invalidă.' }, 405);
  try {
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default;
    const db = createClient(Deno.env.get('SUPABASE_URL')!, service);
    const session = await requirePanelSession(db, request, 0);
    if (!(session.is_platform_admin || await isPlatformAdminAccount(db, session.discord_id))) return reply({ error: 'Acces permis doar administratorului global.' }, 403);
    const body = await request.json().catch(() => ({}));
    const routeKeys = bundles[String(body.bundle_key || '')];
    const organizationId = String(body.organization_id || '').trim();
    const guildId = id(body.guild_id);
    if (!routeKeys) return reply({ error: 'Preset Discord invalid.' }, 400);
    if (!/^[0-9a-f-]{36}$/i.test(organizationId) || !guildId) return reply({ error: 'Organizația sau serverul Discord sunt invalide.' }, 400);
    const { data: guild } = await db.from('organization_guilds').select('guild_id,kind').eq('organization_id', organizationId).eq('guild_id', guildId).eq('enabled', true).maybeSingle();
    if (!guild) return reply({ error: 'Serverul nu aparține organizației selectate.' }, 400);
    const token = await getPlatformSecret(db, 'discord_bot_token'); if (!token) return reply({ error: 'DISCORD_BOT_TOKEN lipsește din Supabase.' }, 500);
    const publishEmbeds = body.publish_embeds !== false;
    const [guildInfo, channels, bot] = await Promise.all([discord(`/guilds/${guildId}`, token), discord(`/guilds/${guildId}/channels`, token), discord('/users/@me', token)]);
    const botOverwrite = [{ id: String(bot.id), type: 1, allow: allow(VIEW, SEND, EMBED, HISTORY, MANAGE_MESSAGES), deny: '0' }];
    const category = await ensureChannel(guildId, token, channels, `PANEL PRO · ${String(body.bundle_key || '').toUpperCase()}`, 4, '', botOverwrite);
    let createdChannels = Number(category.created), createdMessages = 0;
    const routes: Record<string, any> = {};
    const installed: any[] = [];
    const target = String(guild.kind || 'primary') === 'secondary' ? 'secondary' : 'primary';
    for (const routeKey of routeKeys) {
      const channelName = routeNames[routeKey] || `⚙️・${routeKey.replace(/_/g, '-')}`;
      const channel = await ensureChannel(guildId, token, channels, channelName, 0, String(category.row.id), botOverwrite);
      createdChannels += Number(channel.created);
      let messageId = '';
      if (publishEmbeds && !routeKey.startsWith('log_') && routeKey !== 'contract_uploads' && hasInteractiveDefinition(routeKey)) {
        const existingSettings = await db.from('organization_settings').select('discord_channel_routes').eq('organization_id', organizationId).maybeSingle();
        const oldMessage = existingSettings.data?.discord_channel_routes?.[routeKey]?.[target]?.message_id || '';
        let response = await fetch(`${api}/channels/${channel.row.id}/messages${id(oldMessage) ? `/${oldMessage}` : ''}`, { method: id(oldMessage) ? 'PATCH' : 'POST', headers: { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload(routeKey)) });
        if (!response.ok && id(oldMessage)) response = await fetch(`${api}/channels/${channel.row.id}/messages`, { method: 'POST', headers: { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload(routeKey)) });
        if (!response.ok) throw new Error(`Embedul pentru ${routeLabels[routeKey] || routeKey} nu a putut fi publicat.`);
        const message = await response.json().catch(() => ({})); messageId = String(message?.id || oldMessage); if (!oldMessage) createdMessages += 1;
      } else if (publishEmbeds && !routeKey.startsWith('log_') && routeKey !== 'contract_uploads') {
        // Template-ul nu mai publică embeduri informative fără acțiuni. Dacă o
        // instalare veche a lăsat un astfel de mesaj, îl eliminăm doar dacă
        // este mesajul botului salvat în configurație.
        const existingSettings = await db.from('organization_settings').select('discord_channel_routes').eq('organization_id', organizationId).maybeSingle();
        const oldMessage = existingSettings.data?.discord_channel_routes?.[routeKey]?.[target]?.message_id || '';
        if (id(oldMessage)) {
          const deleted = await fetch(`${api}/channels/${channel.row.id}/messages/${oldMessage}`, { method: 'DELETE', headers: { Authorization: `Bot ${token}` } });
          if (!deleted.ok && deleted.status !== 404) throw new Error(`Embedul vechi pentru ${routeLabels[routeKey] || routeKey} nu a putut fi șters.`);
        }
      }
      routes[routeKey] = { primary: { enabled: true, channel_id: String(channel.row.id), guild_id: guildId, ...(messageId ? { message_id: messageId } : {}) } };
      installed.push({ route: routeKey, label: routeLabels[routeKey] || routeKey, channel_id: String(channel.row.id), message_id: messageId || null, buttons: definitions[routeKey]?.buttons?.length || 0 });
    }
    const { data: currentSettings } = await db.from('organization_settings').select('discord_client_id,panel_public_url,discord_channel_routes').eq('organization_id', organizationId).maybeSingle();
    const mergedRoutes = { ...(currentSettings?.discord_channel_routes || {}) };
    for (const [key, value] of Object.entries(routes)) mergedRoutes[key] = { ...(mergedRoutes[key] || {}), [target]: value.primary };
    const { error: settingsError } = await db.from('organization_settings').upsert({ organization_id: organizationId, discord_client_id: currentSettings?.discord_client_id || '0', panel_public_url: currentSettings?.panel_public_url || '', discord_channel_routes: mergedRoutes, updated_by_discord_id: session.discord_id, updated_at: new Date().toISOString() }, { onConflict: 'organization_id' });
    if (settingsError) throw settingsError;
    await db.from('admin_audit_log').insert({ organization_id: organizationId, actor_discord_id: session.discord_id, action: 'discord_real_routes_installed', target_type: 'discord_guild', target_id: guildId, details: { bundle: body.bundle_key, category_id: category.row.id, route_count: installed.length, message_count: createdMessages, publish_embeds: publishEmbeds } });
    return reply({ ok: true, guild: { id: guildInfo.id, name: guildInfo.name }, category: { id: category.row.id, name: category.row.name }, created: { channels: createdChannels, roles: 0, messages: createdMessages }, routes: installed, route_count: installed.length, uses_real_panel_routes: true });
  } catch (error) { return reply({ error: error instanceof Error ? error.message : 'Instalarea pachetului a eșuat.' }, 400); }
});
