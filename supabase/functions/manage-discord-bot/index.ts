import { createClient } from 'jsr:@supabase/supabase-js@2.112.3';
import { getPlatformSecret } from '../_shared/platform-secrets.ts';
import { isPlatformAdminAccount } from '../_shared/platform-admin.ts';
import { requirePanelSession } from '../_shared/panel-session.ts';
import { deliverDiscordRoute, routeCandidates, validDiscordChannelId } from '../_shared/discord-delivery.ts';

const DISCORD_API = 'https://discord.com/api/v10';
const MODULES: Record<string, { label: string; premium: boolean; title: string; description: string; color: number; buttons: any[] }> = {
  pontaj: { label: 'Pontaj și ture', premium: false, title: '🕒 Pontaj · Panel Pro', description: 'Alege tura și folosește butoanele pentru Start, Pauză și Stop.', color: 0x22c55e, buttons: [{ label: 'Tura de zi', style: 1, id: 'panel:pontaj:shift_day' }, { label: 'Tura de noapte', style: 1, id: 'panel:pontaj:shift_night' }, { label: 'Start', style: 3, id: 'panel:pontaj:start' }, { label: 'Pauză', style: 2, id: 'panel:pontaj:pause' }, { label: 'Stop', style: 4, id: 'panel:pontaj:stop' }, { label: 'Pontajul meu', style: 1, id: 'panel:pontaj:my_stats' }] },
  requests_organization: { label: 'Învoiri organizație', premium: false, title: '📝 Învoiri · Organizație', description: 'Trimite și consultă învoirile organizației.', color: 0xf59e0b, buttons: [{ label: 'Trimite învoire', style: 1, id: 'panel:requests:organization:new' }, { label: 'Învoirile mele', style: 2, id: 'panel:requests:organization:mine' }] },
  requests_departments: { label: 'Învoiri angajați', premium: false, title: '📝 Învoiri · Angajați', description: 'Trimite și consultă învoirile angajaților.', color: 0xf59e0b, buttons: [{ label: 'Trimite învoire', style: 1, id: 'panel:requests:departments:new' }, { label: 'Învoirile mele', style: 2, id: 'panel:requests:departments:mine' }] },
  organization: { label: 'Anunțuri organizație', premium: true, title: '📢 Anunțuri · Organizație', description: 'Publică anunțuri, întrebări și sondaje pentru organizație.', color: 0x8b5cf6, buttons: [{ label: 'Publică anunț', style: 1, id: 'panel:announcements:organization:create:announcement' }, { label: 'Pune întrebare', style: 2, id: 'panel:announcements:organization:create:question' }, { label: 'Creează sondaj', style: 3, id: 'panel:announcements:organization:create:poll' }] },
  departments: { label: 'Anunțuri angajați', premium: true, title: '📢 Anunțuri · Angajați', description: 'Publică anunțuri, întrebări și sondaje pentru angajați.', color: 0x8b5cf6, buttons: [{ label: 'Publică anunț', style: 1, id: 'panel:announcements:departments:create:announcement' }, { label: 'Pune întrebare', style: 2, id: 'panel:announcements:departments:create:question' }, { label: 'Creează sondaj', style: 3, id: 'panel:announcements:departments:create:poll' }] },
  contracts: { label: 'Contracte', premium: true, title: '📄 Contracte · Panel Pro', description: 'Generează și trimite contracte folosind șablonul organizației.', color: 0x14b8a6, buttons: [{ label: 'Creează contract', style: 1, id: 'panel:contracts:create' }, { label: 'Setează contractul', style: 2, id: 'panel:contracts:settings' }, { label: 'Info contract', style: 1, id: 'panel:contracts:info' }] },
  actions_organization: { label: 'Acțiuni organizație', premium: true, title: '🎯 Acțiuni · Organizație', description: 'Înregistrează și consultă acțiunile organizației.', color: 0x3b82f6, buttons: [{ label: 'Acțiune', style: 1, id: 'panel:actions:organization:create' }, { label: 'Clasament acțiuni', style: 2, id: 'panel:actions:organization:stats' }] },
  stash: { label: 'Stash', premium: true, title: '📦 Stash · Administrare', description: 'Gestionează articolele, cererile și donațiile Stash.', color: 0x22c55e, buttons: [{ label: 'Adaugă în Stash', style: 3, id: 'panel:stash:create' }, { label: 'Cereri în așteptare', style: 1, id: 'panel:stash:pending_requests' }, { label: 'Donații în așteptare', style: 1, id: 'panel:stash:pending_donations' }] },
  status_live: { label: 'Status live', premium: true, title: '📡 Status live · Panel Pro', description: 'Statusul este actualizat automat cu pontajele și pauzele active.', color: 0x06b6d4, buttons: [] },
};
const LOG_ROUTES: Record<string, string> = {
  organization: 'log_announcements_organization', departments: 'log_announcements_departments', pontaj: 'log_pontaj',
  requests_organization: 'log_requests_organization', requests_departments: 'log_requests_departments', contracts: 'log_contracts',
  actions_organization: 'log_actions_organization', stash: 'log_stash', stash_requests: 'log_stash_requests', stash_donations: 'log_stash_donations'
};
const LOG_LABELS: Record<string, string> = {
  log_announcements_organization: 'Log anunțuri organizație', log_announcements_departments: 'Log anunțuri angajați', log_pontaj: 'Log pontaj',
  log_requests_organization: 'Log învoiri organizație', log_requests_departments: 'Log învoiri angajați', log_contracts: 'Log contracte',
  log_actions_organization: 'Log acțiuni organizație', log_stash: 'Log Stash', log_stash_requests: 'Log cereri Stash', log_stash_donations: 'Log donații Stash'
};
const headersFor = (request: Request) => {
  const origin = String(request.headers.get('origin') || '');
  const allowed = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) || origin === 'https://panel-pro.ro' ? origin : 'https://panel-pro.ro';
  return { 'Access-Control-Allow-Origin': allowed, 'Access-Control-Allow-Headers': 'authorization,apikey,content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Max-Age': '86400', Vary: 'Origin', 'Content-Type': 'application/json' };
};
const reply = (request: Request, data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: headersFor(request) });
const id = (value: unknown) => /^\d{15,22}$/.test(String(value || '').trim());
const clean = (value: unknown, max = 200) => String(value ?? '').trim().slice(0, max);
const botHeaders = (token: string) => ({ Authorization: `Bot ${token}`, 'User-Agent': 'Panel Pro Discord Bot (+https://panel-pro.ro)' });

async function discordUser(token: string) {
  const response = await fetch(`${DISCORD_API}/users/@me`, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error('Sesiunea Discord a expirat. Conectează-te din nou.');
  return response.json();
}

async function ensureDiscordOrganization(db: any, user: any, guild: any, applicationId: string) {
  const guildId = String(guild.id);
  const { data: linked, error: linkedError } = await db.from('organization_guilds').select('organization_id,kind').eq('guild_id', guildId).eq('enabled', true).maybeSingle();
  if (linkedError) throw linkedError;
  if (linked?.organization_id) return linked;
  const botToken = await getPlatformSecret(db, 'discord_bot_token');
  const botGuildResponse = await fetch(`${DISCORD_API}/guilds/${guildId}`, { headers: botHeaders(botToken) });
  if (!botGuildResponse.ok) return null;
  const now = new Date().toISOString();
  const trialEnds = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: organization, error: organizationError } = await db.from('organizations').insert({ slug: `discord-${guildId}`, name: clean(guild.name || `Server Discord ${guildId}`, 120), access_mode: 'discord_only', lifecycle_status: 'active', active: true, updated_at: now }).select('id,name,access_mode,active').single();
  if (organizationError) {
    if (organizationError.code === '23505') return (await db.from('organization_guilds').select('organization_id,kind').eq('guild_id', guildId).eq('enabled', true).maybeSingle()).data;
    throw organizationError;
  }
  const organizationId = String(organization.id);
  const results = await Promise.all([
    db.from('organization_guilds').insert({ organization_id: organizationId, guild_id: guildId, guild_name: clean(guild.name || guildId, 120), kind: 'primary', enabled: true }),
    db.from('organization_settings').insert({ organization_id: organizationId, discord_client_id: applicationId || '1531023771211792384', panel_public_url: '', discord_channel_routes: {}, updated_at: now, updated_by_discord_id: String(user.id) }),
    db.from('app_settings').insert({ organization_id: organizationId, key: 'organization_package', value: { code: 'discord', unlimited: true, expires_at: null }, updated_at: now }),
    db.from('app_settings').insert({ organization_id: organizationId, key: 'discord_trial', value: { starts_at: now, ends_at: trialEnds, duration_days: 30 }, updated_at: now }),
    db.from('organization_members').insert({ organization_id: organizationId, discord_id: String(user.id), panel_role: 'Administrator', permission_level: 99, active: true, last_verified_at: now }),
  ]);
  const failed = results.find((result: any) => result?.error);
  if (failed?.error) throw failed.error;
  return { organization_id: organizationId, kind: 'primary' };
}

async function ownedGuilds(db: any, user: any, applicationId: string, platformAdmin = false, diagnostics: Record<string, any> = {}) {
  const token = String(user.access_token);
  const response = await fetch(`${DISCORD_API}/users/@me/guilds`, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error('Serverele Discord nu pot fi încărcate. Verifică scope-ul guilds în OAuth.');
  const guilds = await response.json();
  diagnostics.oauth_guild_count = Array.isArray(guilds) ? guilds.length : 0;
  diagnostics.owner_guild_count = 0;
  diagnostics.bot_check_count = 0;
  diagnostics.bot_check_failures = [];
  const result = [];
  for (const guild of Array.isArray(guilds) ? guilds : []) {
    if (guild.owner) diagnostics.owner_guild_count += 1;
    if ((!platformAdmin && !guild.owner) || !id(guild.id)) continue;
    diagnostics.bot_check_count += 1;
    const linked = await ensureDiscordOrganization(db, user, guild, applicationId);
    if (!linked?.organization_id) {
      diagnostics.bot_check_failures.push({ guild_id: String(guild.id), guild_name: clean(guild.name || guild.id, 120), reason: 'Botul nu a fost găsit în server sau DISCORD_BOT_TOKEN nu are acces.' });
      continue;
    }
    const { data: organization, error } = await db.from('organizations').select('id,name,access_mode,active').eq('id', linked.organization_id).maybeSingle();
    if (error) throw error;
    if (organization?.access_mode !== 'discord_only' && !platformAdmin) continue;
    const { data: packageSetting } = await db.from('app_settings').select('key,value').eq('organization_id', linked.organization_id).in('key', ['organization_package', 'discord_trial']);
    const packageValue = (packageSetting || []).find((item: any) => item.key === 'organization_package')?.value || {};
    const trialValue = (packageSetting || []).find((item: any) => item.key === 'discord_trial')?.value || {};
    const { data: entitlement } = await db.from('discord_guild_entitlements').select('sku_id,ends_at,active').eq('guild_id', String(guild.id)).eq('active', true).order('updated_at', { ascending: false }).limit(1).maybeSingle();
    const premium = Boolean(entitlement && (!entitlement.ends_at || Date.parse(String(entitlement.ends_at)) > Date.now()));
    const trial = !premium && Date.parse(String(trialValue.ends_at || '')) > Date.now();
    result.push({ id: String(guild.id), name: clean(guild.name || guild.id, 120), organization_id: String(organization?.id || linked.organization_id), organization_name: clean(organization?.name || guild.name, 120), access_mode: organization?.access_mode || 'discord_only', bot_installed: true, plan: premium ? 'premium' : trial ? 'trial' : 'free', trial_ends_at: trialValue.ends_at || null, premium_ends_at: entitlement?.ends_at || null, sku_id: entitlement?.sku_id || null });
  }
  return result;
}

async function reconcileInstallations(db: any) {
  const { data: installations, error } = await db.from('discord_bot_installations').select('guild_id,status').eq('status', 'active');
  if (error) {
    if (error.code === '42P01') return { checked: 0, removed: 0 };
    throw error;
  }
  const botToken = await getPlatformSecret(db, 'discord_bot_token');
  if (!botToken) return { checked: 0, removed: 0, skipped: 'DISCORD_BOT_TOKEN lipsește.' };
  let removed = 0;
  for (const installation of installations || []) {
    const guildId = String(installation.guild_id || '');
    if (!id(guildId)) continue;
    const response = await fetch(`${DISCORD_API}/guilds/${guildId}`, { headers: botHeaders(botToken) });
    if (response.status === 404) {
      await db.from('discord_bot_installations').update({ status: 'removed', removed_at: new Date().toISOString(), last_event_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('guild_id', guildId);
      removed += 1;
    } else if (response.ok) {
      const guild = await response.json().catch(() => ({}));
      await db.from('discord_bot_installations').update({ guild_name: clean(guild.name || '', 120) || undefined, last_event_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('guild_id', guildId);
    }
  }
  return { checked: (installations || []).length, removed };
}

async function channels(db: any, guildId: string) {
  const botToken = await getPlatformSecret(db, 'discord_bot_token');
  const response = await fetch(`${DISCORD_API}/guilds/${guildId}/channels`, { headers: botHeaders(botToken) });
  if (!response.ok) throw new Error(`Canalele Discord nu pot fi citite (HTTP ${response.status}). Verifică accesul botului.`);
  const raw = await response.json();
  const categories = new Map((Array.isArray(raw) ? raw : []).filter((item: any) => Number(item.type) === 4).map((item: any) => [String(item.id), item.name]));
  return (Array.isArray(raw) ? raw : []).filter((item: any) => [0, 5].includes(Number(item.type)) && id(item.id)).map((item: any) => ({ id: String(item.id), name: clean(item.name || item.id, 100), category_name: categories.get(String(item.parent_id || '')) || '', type: Number(item.type) })).sort((a: any, b: any) => `${a.category_name}/${a.name}`.localeCompare(`${b.category_name}/${b.name}`, 'ro'));
}

function payload(moduleKey: string, donation: boolean) {
  const definition = MODULES[moduleKey];
  const rows: any[] = [];
  for (let index = 0; index < definition.buttons.length; index += 5) rows.push({ type: 1, components: definition.buttons.slice(index, index + 5).map((button: any) => ({ type: 2, style: button.style, label: button.label, custom_id: button.id })) });
  if (donation) rows.push({ type: 1, components: [{ type: 2, style: 5, label: 'Donează pentru dezvoltare', url: 'https://revolut.me/mariomihail' }] });
  return { username: 'Panel Pro', allowed_mentions: { parse: [] }, embeds: [{ title: definition.title, description: definition.description, color: definition.color, footer: { text: 'Panel Pro · configurat din pagina botului' } }], components: rows };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: headersFor(request) });
  try {
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default;
    if (!key) throw new Error('Cheia Supabase lipsește.');
    const db = createClient(Deno.env.get('SUPABASE_URL')!, key);
    const body = await request.json().catch(() => ({}));
    const accessToken = clean(body.access_token, 500);
    if (!accessToken) return reply(request, { error: 'Conectarea Discord este necesară.' }, 401);
    const discord = await discordUser(accessToken);
    let platformAdmin = await isPlatformAdminAccount(db, discord.id);
    const panelSessionToken = clean(request.headers.get('x-panel-session'), 500);
    if (!platformAdmin && panelSessionToken) {
      try {
        const panelSession = await requirePanelSession(db, request, 0, true);
        platformAdmin = await isPlatformAdminAccount(db, panelSession.discord_id);
      } catch (_) {
        // Sesiunea panel este opțională pentru utilizatorii Discord-only.
      }
    }
    const applicationId = id(body.application_id) ? String(body.application_id) : '1531023771211792384';
    const action = clean(body.action, 30) || 'bootstrap';
    const diagnostics: Record<string, any> = {};
    const reconciliation = action === 'bootstrap' ? await reconcileInstallations(db) : null;
    const guilds = await ownedGuilds(db, { ...discord, access_token: accessToken }, applicationId, platformAdmin, diagnostics);
    if (action === 'bootstrap') return reply(request, { ok: true, user: { id: String(discord.id), username: clean(discord.global_name || discord.username, 120), platform_admin: platformAdmin }, platform_admin: platformAdmin, guilds, diagnostics, reconciliation, modules: Object.fromEntries(Object.entries(MODULES).map(([key, value]) => [key, { label: value.label, premium: value.premium, log_key: LOG_ROUTES[key] || '', log_label: LOG_LABELS[LOG_ROUTES[key] || ''] || '' }])) });
    const guildId = clean(body.guild_id, 30);
    const selectedGuild = guilds.find((guild: any) => guild.id === guildId);
    if (!selectedGuild) return reply(request, { error: platformAdmin ? 'Serverul nu este disponibil sau botul nu este instalat.' : 'Serverul nu este disponibil: trebuie să fii owner și botul trebuie să fie instalat.' }, 403);
    if (action === 'grant_premium') {
      if (!platformAdmin) return reply(request, { error: 'Doar administratorul global poate acorda Premium manual.' }, 403);
      const skuId = String(Deno.env.get('DISCORD_PREMIUM_GUILD_SKU_ID') || Deno.env.get('DISCORD_PREMIUM_GUILD_SKU_IDS') || '1545022271117066260').split(',').map((value) => value.trim()).find((value) => id(value)) || '';
      if (!skuId) return reply(request, { error: 'SKU-ul Premium nu este configurat în secretele Supabase.' }, 500);
      const days = Number(body.days);
      if (!Number.isFinite(days) || (days !== 0 && (!Number.isInteger(days) || days < 1 || days > 3650))) return reply(request, { error: 'Durata Premium trebuie să fie între 1 și 3650 zile sau 0 pentru fără expirare.' }, 400);
      await db.from('discord_guild_entitlements').update({ active: false, updated_at: new Date().toISOString() }).eq('guild_id', guildId).eq('active', true);
      const now = new Date().toISOString();
      const endsAt = days === 0 ? null : new Date(Date.now() + days * 86400000).toISOString();
      const { data: entitlement, error } = await db.from('discord_guild_entitlements').insert({ guild_id: guildId, organization_id: selectedGuild.organization_id, sku_id: skuId, owner_type: 2, active: true, starts_at: now, ends_at: endsAt, purchaser_user_id: String(discord.id), raw_entitlement: { source: 'platform_admin_grant', granted_by: String(discord.id), days } }).select('id,guild_id,sku_id,starts_at,ends_at,active').single();
      if (error) throw error;
      return reply(request, { ok: true, entitlement });
    }
    const { data: settings, error: settingsError } = await db.from('organization_settings').select('discord_channel_routes').eq('organization_id', selectedGuild.organization_id).maybeSingle();
    if (settingsError) throw settingsError;
    if (action === 'channels') return reply(request, { ok: true, channels: await channels(db, guildId), routes: settings?.discord_channel_routes || {} });
    const allowedPremium = selectedGuild.plan !== 'free';
    if (action === 'contract_template' || action === 'save_contract_template') {
      if (!allowedPremium) return reply(request, { error: 'Editorul de contracte este disponibil în Trial sau Premium.' }, 403);
      if (action === 'contract_template') {
        const { data: templateSetting, error } = await db.from('app_settings').select('value').eq('organization_id', selectedGuild.organization_id).eq('key', 'contract_template').maybeSingle();
        if (error) throw error;
        return reply(request, { ok: true, contract_template: templateSetting?.value || null });
      }
      const title = clean(body.title, 160);
      const template = clean(body.template, 50000);
      const position = clean(body.position, 120);
      const salary = clean(body.salary, 120);
      const schedule = clean(body.schedule, 120);
      if (template.length < 20) return reply(request, { error: 'Șablonul contractului este prea scurt.' }, 400);
      const allowedVariables = new Set(['COMPANY','ADDRESS','MANAGER','EMPLOYEE_NAME','CNP','PHONE','POSITION','START_DATE','PROGRAM','SALARY']);
      const unknownVariables = [...template.matchAll(/{{([A-Z0-9_]+)}}/g)].map((match) => match[1]).filter((value, index, values) => !allowedVariables.has(value) && values.indexOf(value) === index);
      if (unknownVariables.length) return reply(request, { error: `Variabile necunoscute: ${unknownVariables.map((value) => `{{${value}}}`).join(', ')}.` }, 400);
      const { data: saved, error } = await db.from('app_settings').upsert({ organization_id: selectedGuild.organization_id, key: 'contract_template', value: { title: title || 'Contract de muncă', template, defaults: { position, salary, schedule } }, updated_at: new Date().toISOString() }, { onConflict: 'organization_id,key' }).select('value').single();
      if (error) throw error;
      return reply(request, { ok: true, contract_template: saved?.value || null });
    }
    if (action === 'save') {
      const requested = body.routes && typeof body.routes === 'object' ? body.routes : {};
      const available = new Set((await channels(db, guildId)).map((channel: any) => channel.id));
      const routeKeys = Object.keys(MODULES);
      const nextRoutes: Record<string, any> = { ...(settings?.discord_channel_routes || {}) };
      for (const routeKey of routeKeys) {
        if (MODULES[routeKey].premium && !allowedPremium && requested[routeKey]) continue;
        const selected = requested[routeKey] && typeof requested[routeKey] === 'object' ? requested[routeKey] : { embed: requested[routeKey] };
        const channelId = clean(selected.embed, 30);
        const logChannelId = clean(selected.log, 30);
        if (!channelId) { delete nextRoutes[routeKey]; if (LOG_ROUTES[routeKey]) delete nextRoutes[LOG_ROUTES[routeKey]]; continue; }
        if (!validDiscordChannelId(channelId) || !available.has(channelId)) return reply(request, { error: `Canal invalid pentru modulul ${MODULES[routeKey].label}.` }, 400);
        nextRoutes[routeKey] = { ...(nextRoutes[routeKey] || {}), primary: { ...(nextRoutes[routeKey]?.primary || {}), channel_id: channelId, guild_id: guildId, enabled: true } };
        if (LOG_ROUTES[routeKey]) {
          if (logChannelId && (!validDiscordChannelId(logChannelId) || !available.has(logChannelId))) return reply(request, { error: `Canal de log invalid pentru modulul ${MODULES[routeKey].label}.` }, 400);
          if (logChannelId) nextRoutes[LOG_ROUTES[routeKey]] = { ...(nextRoutes[LOG_ROUTES[routeKey]] || {}), primary: { ...(nextRoutes[LOG_ROUTES[routeKey]]?.primary || {}), channel_id: logChannelId, guild_id: guildId, enabled: true } };
          else delete nextRoutes[LOG_ROUTES[routeKey]];
        }
      }
      const { error } = await db.from('organization_settings').update({ discord_channel_routes: nextRoutes, updated_at: new Date().toISOString(), updated_by_discord_id: String(discord.id) }).eq('organization_id', selectedGuild.organization_id);
      if (error) throw error;
      return reply(request, { ok: true, routes: nextRoutes });
    }
    if (action === 'publish') {
      const moduleKey = clean(body.module, 50);
      const definition = MODULES[moduleKey];
      if (!definition) return reply(request, { error: 'Modul invalid.' }, 400);
      if (definition.premium && !allowedPremium) return reply(request, { error: 'Acest modul este disponibil după activarea Premium sau pe durata trialului.' }, 403);
      const configured = settings?.discord_channel_routes?.[moduleKey]?.primary;
      if (!configured?.channel_id) return reply(request, { error: `Alege mai întâi canalul pentru ${definition.label}.` }, 400);
      const delivery = await deliverDiscordRoute(db, { ...settings, discord_channel_routes: { [moduleKey]: { primary: configured } } }, moduleKey, JSON.stringify(payload(moduleKey, !allowedPremium)), { postOnly: false });
      const result = delivery.results?.[0];
      if (result?.id) {
        const nextRoutes = { ...(settings?.discord_channel_routes || {}) };
        nextRoutes[moduleKey] = { ...(nextRoutes[moduleKey] || {}), primary: { ...configured, message_id: String(result.id) } };
        await db.from('organization_settings').update({ discord_channel_routes: nextRoutes, updated_at: new Date().toISOString(), updated_by_discord_id: String(discord.id) }).eq('organization_id', selectedGuild.organization_id);
      }
      return reply(request, { ok: true, result, failures: delivery.failures || [] });
    }
    return reply(request, { error: 'Acțiune necunoscută.' }, 400);
  } catch (error) { return reply(request, { error: error instanceof Error ? error.message : 'Eroare internă.' }, 400); }
});
