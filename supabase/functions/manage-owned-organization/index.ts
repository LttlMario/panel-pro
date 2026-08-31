import { createClient } from 'jsr:@supabase/supabase-js@2.112.3';
import { isPlatformAdminAccount } from '../_shared/platform-admin.ts';
import { requirePanelSession } from '../_shared/panel-session.ts';
import { getPlatformSecret } from '../_shared/platform-secrets.ts';
import { packageAllowsPage as packagePageAllowed, resolvePackageFeatures } from '../_shared/package-features.ts';

const headers = {
  'Access-Control-Allow-Origin': 'https://lttlmario.github.io',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-panel-session',
  'Access-Control-Max-Age': '86400',
  'Content-Type': 'application/json'
};

const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers });
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const webhookChannels = new Set([
  'organization', 'departments', 'pontaj', 'weekly_reports', 'requests', 'requests_organization',
  'requests_departments', 'contracts', 'contract_identity_weekly', 'marketplace', 'illegal_marketplace',
  'fines_organization', 'fines_departments', 'warnings_organization', 'warnings_departments',
  'sanctions_organization', 'sanctions_departments', 'actions_organization', 'status_live', 'organization_expiration', 'stash', 'stash_requests', 'stash_donations'
]);
const allowedContractPlaceholders = new Set([
  '{{COMPANY}}', '{{ADDRESS}}', '{{MANAGER}}', '{{EMPLOYEE_NAME}}', '{{CNP}}',
  '{{PHONE}}', '{{POSITION}}', '{{SALARY}}', '{{PROGRAM}}', '{{START_DATE}}',
  '{{CONTRACT_NUMBER}}'
]);
const allowedPages = new Map([
  ['index.html', 'Dashboard'],
  ['anunturi.html', 'Anunțuri și sondaje'],
  ['pontaj.html', 'Pontaj'],
  ['cereri.html', 'Cereri / Învoiri'],
  ['calculator.html', 'Calculator'],
  ['bucatarie.html', 'Bucătărie'],
  ['contracte.html', 'Contracte'],
  ['calculatorilegal.html', 'Calculator ilegal'],
  ['craftmecanics.html', 'Craft Mecanics'],
  ['locatiiilegale.html', 'Locații ilegale'],
  ['marketplace.html', 'Marketplace'],
  ['marketplace-ilegal.html', 'Marketplace ilegal'],
  ['minigames.html', 'Minigames'],
  ['rapoarte.html', 'Rapoarte'],
  ['status-live.html', 'Status Live'],
  ['asistent.html', 'Asistent Panel'],
  ['stash.html', 'Stash organizație']
]);
const allowedAssistantPages = new Set([...allowedPages.keys()]);
const allowedActionKeys = new Set(['anunturi.publish', 'marketplace.delete', 'cereri.organization', 'cereri.departments', 'actions.organization.read', 'actions.organization.write', 'actions.organization.delete', 'stash.write', 'stash.request', 'stash.manage_requests', 'stash.donate', 'stash.approve_donation', 'stash.log']);
const fullOnlyWebhookChannels = new Set(['organization', 'requests_organization', 'illegal_marketplace', 'fines_organization', 'warnings_organization', 'sanctions_organization']);
const operationsWebhookChannels = new Set(['organization', 'requests_organization', 'fines_organization', 'warnings_organization', 'sanctions_organization', 'actions_organization', 'illegal_marketplace', 'organization_expiration']);
const standardWebhookChannels = new Set(['departments', 'pontaj', 'weekly_reports', 'contracts', 'contract_identity_weekly', 'marketplace', 'fines_departments', 'warnings_departments', 'sanctions_departments', 'status_live', 'organization_expiration']);
const fullOnlyPageFeatures = new Map([
  ['calculatorilegal.html', 'illegal_calculator'],
  ['locatiiilegale.html', 'illegal_locations'],
  ['marketplace-ilegal.html', 'illegal_marketplace'],
  ['minigames.html', 'illegal_minigames'],
  ['stash.html', 'stash']
]);
const standardPackageFeatures = new Set([
  'core', 'announcements', 'requests', 'contracts', 'reports', 'legal_marketplace',
  'legal_tools', 'assistant', 'status_live', 'announcements_departments',
  'requests_departments', 'discipline_departments'
]);

const sanitizeAssistantKnowledge = (raw: unknown) => {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 100).map((item: any, index) => {
    const question = String(item?.question || '').trim().slice(0, 500);
    const answer = String(item?.answer || '').trim().slice(0, 3000);
    const title = String(item?.title || question).trim().slice(0, 160);
    const page = String(item?.page || '').trim().split('?')[0].split('#')[0];
    return {
      id: UUID_RE.test(String(item?.id || '')) ? String(item.id) : `assistant-${Date.now()}-${index}`,
      title, question, answer,
      page: allowedAssistantPages.has(page) ? page : '',
      keywords: [...new Set((Array.isArray(item?.keywords) ? item.keywords : []).map((value: any) => String(value || '').trim().slice(0, 60)).filter(Boolean))].slice(0, 20),
      enabled: item?.enabled !== false
    };
  }).filter((item) => item.question.length >= 2 && item.answer.length >= 2);
};

const packageAllowsFeature = (packageValue: any, feature: string) =>
  resolvePackageFeatures(packageValue).includes(feature);

const packageAllowsWebhook = (packageValue: any, channel: string) => {
  const code = String(packageValue?.code || 'standard').toLowerCase();
  if (code === 'operations') return operationsWebhookChannels.has(channel);
  if (code === 'standard') return standardWebhookChannels.has(channel);
  return true;
};

const normalizeContract = (raw: unknown) => {
  if (raw === undefined) return undefined;
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, any>;
  const title = String(value.title || '').trim();
  const template = String(value.template || '').trim();
  const salary = String(value.defaults?.salary || '').trim() || null;
  if (!title && !template && !salary) return null;
  if (title.length < 2) throw new Error('Numele contractului este obligatoriu.');
  if (template.length < 20) throw new Error('Textul contractului este prea scurt.');
  const unknown = [...template.matchAll(/{{[A-Z0-9_]+}}/g)]
    .map((match) => match[0])
    .filter((placeholder) => !allowedContractPlaceholders.has(placeholder));
  if (unknown.length) throw new Error(`Câmpuri necunoscute în contract: ${[...new Set(unknown)].join(', ')}`);
  return { title, template, defaults: { salary } };
};

const validWebhook = (value: unknown) => {
  try {
    const url = new URL(String(value || '').trim());
    return url.protocol === 'https:'
      && ['discord.com', 'discordapp.com'].includes(url.hostname)
      && url.pathname.startsWith('/api/webhooks/');
  } catch {
    return false;
  }
};

const sanitizeWebhookRoutes = (raw: unknown) => {
  if (!raw || typeof raw !== 'object') return {};
  const result: Record<string, unknown> = {};
  for (const [channel, route] of Object.entries(raw as Record<string, any>)) {
    if (!webhookChannels.has(channel) || !route || typeof route !== 'object') continue;
    const clean = (value: any) => value?.enabled && validWebhook(value.url)
      ? { enabled: true, url: String(value.url).trim() }
      : null;
    const primary = clean(route.primary);
    const secondary = clean(route.secondary);
    if (primary || secondary) result[channel] = { primary, secondary };
  }
  return result;
};

const WEBHOOK_MASK = '••••••••';
const maskWebhookRoutes = (raw: unknown) => {
  if (!raw || typeof raw !== 'object') return {};
  const result: Record<string, any> = {};
  for (const [channel, route] of Object.entries(raw as Record<string, any>)) {
    if (!webhookChannels.has(channel) || !route || typeof route !== 'object') continue;
    result[channel] = {};
    for (const target of ['primary', 'secondary']) {
      const item = (route as any)[target];
      if (!item || typeof item !== 'object') continue;
      result[channel][target] = {
        enabled: item.enabled === true && Boolean(item.url),
        url: item.url ? WEBHOOK_MASK : ''
      };
    }
  }
  return result;
};

const mergeWebhookRoutes = (current: unknown, submitted: unknown) => {
  if (!submitted || typeof submitted !== 'object') return sanitizeWebhookRoutes(current);
  const existing = sanitizeWebhookRoutes(current);
  const result: Record<string, any> = {};
  for (const [channel, route] of Object.entries(submitted as Record<string, any>)) {
    if (!webhookChannels.has(channel) || !route || typeof route !== 'object') continue;
    const cleanTarget = (target: string) => {
      const incoming = (route as any)[target];
      if (!incoming || typeof incoming !== 'object' || incoming.enabled !== true) return null;
      const incomingUrl = String(incoming.url || '').trim();
      if (incomingUrl && incomingUrl !== WEBHOOK_MASK) {
        if (!validWebhook(incomingUrl)) throw new Error('Unul dintre webhook-urile Discord nu este valid.');
        return { enabled: true, url: incomingUrl };
      }
      const previous = (existing as any)[channel]?.[target];
      return previous?.url ? { enabled: true, url: previous.url } : null;
    };
    const primary = cleanTarget('primary');
    const secondary = cleanTarget('secondary');
    if (primary || secondary) result[channel] = { primary, secondary };
  }
  return result;
};

const maskSettings = (settings: any) => {
  const value = { ...(settings || {}) };
  for (const key of [
    'family_webhook_url', 'mechanics_webhook_url', 'pontaj_webhook_url',
    'requests_webhook_url', 'contracts_webhook_url', 'marketplace_webhook_url',
    'illegal_marketplace_webhook_url'
  ]) value[key] = value[key] ? WEBHOOK_MASK : null;
  value.webhook_routes = maskWebhookRoutes(value.webhook_routes);
  return value;
};

const safeAssetUrl = (value: unknown, label: string) => {
  const url = String(value || '').trim();
  if (!url) return null;
  try {
    if (new URL(url).protocol !== 'https:') throw new Error();
  } catch {
    throw new Error(`${label} trebuie să fie un link HTTPS valid.`);
  }
  return url;
};

const discordGuild = async (guildId: string, botToken: string) => {
  const response = await fetch(`https://discord.com/api/v10/guilds/${guildId}`, {
    headers: { Authorization: `Bot ${botToken}` }
  });
  if (!response.ok) return null;
  return await response.json();
};

const discordGuildRoles = async (guildId: string, guildName: string, botToken: string) => {
  const response = await fetch(`https://discord.com/api/v10/guilds/${guildId}/roles`, {
    headers: { Authorization: `Bot ${botToken}` }
  });
  if (!response.ok) throw new Error(`Rolurile pentru serverul ${guildName || guildId} nu pot fi citite (HTTP ${response.status}).`);
  const roles = await response.json();
  return (Array.isArray(roles) ? roles : [])
    .filter((role: any) => !role.managed && String(role.id) !== String(guildId))
    .map((role: any) => ({
      id: String(role.id),
      name: String(role.name || '').trim(),
      guild_id: String(guildId),
      guild_name: String(guildName || guildId),
      position: Number(role.position || 0)
    }))
    .filter((role: any) => /^\d{15,22}$/.test(role.id) && role.name)
    .sort((a: any, b: any) => b.position - a.position);
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers });
  if (request.method !== 'POST') return reply({ error: 'Metodă invalidă.' }, 405);

  try {
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
      || JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default;
    if (!key) throw new Error('Cheia secretă Supabase lipsește.');

    const db = createClient(Deno.env.get('SUPABASE_URL')!, key);
    const botToken = await getPlatformSecret(db, 'discord_bot_token');
    if (!botToken) throw new Error('DISCORD_BOT_TOKEN lipsește din configurația Supabase.');
    const body = await request.json();
    const action = String(body.action || 'owner_get').trim();
    if (!['owner_get', 'owner_update'].includes(action)) return reply({ error: 'Acțiune necunoscută.' }, 400);

    const accessToken = String(body.access_token || '').trim();
    let discordId = '';
    if (accessToken) {
      const userResponse = await fetch('https://discord.com/api/v10/users/@me', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (userResponse.ok) {
        const discordUser = await userResponse.json();
        discordId = String(discordUser.id || '').trim();
      }
    }
    if (!discordId) {
      try {
        const panelSession = await requirePanelSession(db, request, 0, true);
        discordId = panelSession.discord_id;
      } catch (error) {
        return reply({ error: accessToken ? 'Sesiunea Discord a expirat.' : (error instanceof Error ? error.message : 'Sesiunea panelului lipsește sau a expirat.') }, 401);
      }
    }
    if (!discordId) return reply({ error: 'Contul Discord nu a putut fi identificat.' }, 401);

    const requestIp = String(request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'unknown')
      .split(',')[0].trim().slice(0, 120);
    const { data: ownerActionAllowed, error: ownerRateError } = await db.rpc('consume_panel_rate_limit', {
      p_key: `owned-organization:${discordId}:${requestIp}`,
      p_limit: 60,
      p_window_seconds: 900,
    });
    if (ownerRateError) {
      console.error('Owned organization rate-limit unavailable:', ownerRateError.message);
      return reply({ error: 'Protecția anti-abuz este temporar indisponibilă. Încearcă din nou în câteva minute.' }, 503);
    }
    if (ownerActionAllowed === false) return reply({ error: 'Prea multe modificări asupra organizației. Așteaptă câteva minute și încearcă din nou.' }, 429);

    const requestedOrganizationId = String(body.organization_id || '').trim();
    if (requestedOrganizationId && !UUID_RE.test(requestedOrganizationId)) {
      return reply({ error: 'ID-ul organizației este vechi sau invalid. Selectează din nou organizația.' }, 400);
    }
    let candidates: any[] = [];
    if (requestedOrganizationId) {
      const [{ data: organization }, { data: guild }] = await Promise.all([
        db.from('organizations').select('id,name,slug,code,illegal_name,address,description,logo_url,active,lifecycle_status,deactivation_reason,deactivated_at,last_discord_check_at,last_discord_check_status').eq('id', requestedOrganizationId).maybeSingle(),
        db.from('organization_guilds').select('organization_id,guild_id,guild_name,kind,enabled').eq('organization_id', requestedOrganizationId).eq('kind', 'primary').eq('enabled', true).maybeSingle()
      ]);
      if (organization && guild) candidates = [{ organization, guild }];
    } else {
      const { data: guilds, error: guildError } = await db.from('organization_guilds')
        .select('organization_id,guild_id,guild_name,kind,enabled')
        .eq('kind', 'primary').eq('enabled', true);
      if (guildError) throw guildError;
      const ids = [...new Set((guilds || []).map((item: any) => String(item.organization_id)).filter(Boolean))];
      if (ids.length) {
        const { data: organizations, error: organizationError } = await db.from('organizations')
          .select('id,name,slug,code,illegal_name,address,description,logo_url,active,lifecycle_status,deactivation_reason,deactivated_at,last_discord_check_at,last_discord_check_status')
          .in('id', ids);
        if (organizationError) throw organizationError;
        candidates = (guilds || []).map((guild: any) => ({
          organization: (organizations || []).find((item: any) => item.id === guild.organization_id),
          guild
        })).filter((item: any) => item.organization);
      }
    }

    let owned: { organization: any; guild: any } | null = null;
    for (const candidate of candidates) {
      const guild = await discordGuild(String(candidate.guild.guild_id), botToken);
      if (guild && String(guild.owner_id) === discordId) {
        owned = { organization: candidate.organization, guild: { ...candidate.guild, name: guild.name || candidate.guild.guild_name, owner_id: guild.owner_id } };
        break;
      }
    }
    const isPlatformAdmin = await isPlatformAdminAccount(db, discordId);
    if (!owned && !isPlatformAdmin) return reply({ error: 'Acces refuzat. Doar proprietarul serverului Discord sau administratorul platformei poate administra această organizație.' }, 403);

    if (!owned && isPlatformAdmin) {
      const fallbackOrganizationId = requestedOrganizationId;
      if (!fallbackOrganizationId) return reply({ error: 'Administratorul platformei trebuie să selecteze o organizație.' }, 400);
      const { data: fallbackOrganization, error: fallbackError } = await db.from('organizations')
        .select('id,name,slug,code,illegal_name,address,description,logo_url,active,lifecycle_status,deactivation_reason,deactivated_at,last_discord_check_at,last_discord_check_status')
        .eq('id', fallbackOrganizationId).maybeSingle();
      if (fallbackError) throw fallbackError;
      if (!fallbackOrganization) return reply({ error: 'Organizația selectată nu există.' }, 404);
      const { data: fallbackGuild, error: fallbackGuildError } = await db.from('organization_guilds')
        .select('organization_id,guild_id,guild_name,kind,enabled')
        .eq('organization_id', fallbackOrganizationId).eq('kind', 'primary').eq('enabled', true).maybeSingle();
      if (fallbackGuildError) throw fallbackGuildError;
      owned = { organization: fallbackOrganization, guild: fallbackGuild || { organization_id: fallbackOrganizationId, guild_id: '', guild_name: 'Organizație fără Guild principal', kind: 'primary', enabled: true } };
    }
    if (!owned) return reply({ error: 'Organizația nu a putut fi identificată.' }, 404);

    const organizationId = String(owned.organization.id);
    const loadSettings = async () => {
      const [{ data: settings }, { data: contractSetting }, { data: roleMappings }, { data: pageSetting }, { data: guilds }, { data: accessSetting }, { data: packageSetting }, { data: actionSetting }, { data: assistantPageSetting }, { data: communicationSetting }, { data: disciplineSetting }, { data: assistantKnowledgeSetting }] = await Promise.all([
        db.from('organization_settings').select('*').eq('organization_id', organizationId).maybeSingle(),
        db.from('app_settings').select('value').eq('organization_id', organizationId).eq('key', 'contract_template').maybeSingle(),
        db.from('organization_role_mappings').select('guild_id,discord_role_id,discord_role_name,panel_role,permission_level,priority,enabled').eq('organization_id', organizationId).order('priority', { ascending: false }),
        db.from('app_settings').select('value').eq('organization_id', organizationId).eq('key', 'page_permissions').maybeSingle(),
        db.from('organization_guilds').select('guild_id,guild_name,kind,enabled').eq('organization_id', organizationId).eq('enabled', true).order('kind'),
        db.from('app_settings').select('value').eq('organization_id', organizationId).eq('key', 'organization_access').maybeSingle(),
        db.from('app_settings').select('value').eq('organization_id', organizationId).eq('key', 'organization_package').maybeSingle(),
        db.from('app_settings').select('value').eq('organization_id', organizationId).eq('key', 'action_permissions').maybeSingle(),
        db.from('app_settings').select('value').eq('organization_id', organizationId).eq('key', 'assistant_page_permissions').maybeSingle(),
        db.from('app_settings').select('value').eq('organization_id', organizationId).eq('key', 'communication_permissions').maybeSingle(),
        db.from('app_settings').select('value').eq('organization_id', organizationId).eq('key', 'discipline_permissions').maybeSingle(),
        db.from('app_settings').select('value').eq('organization_id', organizationId).eq('key', 'assistant_knowledge').maybeSingle()
      ]);
      return {
        settings: settings || {},
        contract_template: contractSetting?.value || {},
        role_mappings: roleMappings || [],
        page_permissions: pageSetting?.value || {},
        guilds: guilds || [],
        access: accessSetting?.value || {},
        package: packageSetting?.value || {},
        action_permissions: actionSetting?.value || {},
        assistant_page_permissions: assistantPageSetting?.value || {},
        communication_permissions: communicationSetting?.value || {},
        discipline_permissions: disciplineSetting?.value || {},
        assistant_knowledge: sanitizeAssistantKnowledge(assistantKnowledgeSetting?.value || [])
      };
    };

    const loadDiscordRoles = async (guilds: any[]) => {
      const roles = await Promise.all((guilds || []).map((guild) =>
        discordGuildRoles(String(guild.guild_id), String(guild.guild_name || guild.guild_id), botToken)
      ));
      return roles.flat();
    };

    if (action === 'owner_get') {
      const state = await loadSettings();
      const discordRoles = await loadDiscordRoles(state.guilds);
      return reply({
        ok: true,
        organization: owned.organization,
        guild: owned.guild,
        guilds: state.guilds,
        settings: maskSettings(state.settings),
        contract_template: state.contract_template,
        role_mappings: state.role_mappings,
        page_permissions: state.page_permissions,
        access: state.access,
        package: state.package,
        action_permissions: state.action_permissions,
        assistant_page_permissions: state.assistant_page_permissions,
        communication_permissions: state.communication_permissions,
        discipline_permissions: state.discipline_permissions,
        assistant_knowledge: state.assistant_knowledge,
        discord_roles: discordRoles
      });
    }

    const input = body.organization && typeof body.organization === 'object' ? body.organization : {};
    const name = String(input.name ?? owned.organization.name ?? '').trim();
    if (name.length < 2 || name.length > 100) return reply({ error: 'Numele organizației trebuie să aibă între 2 și 100 de caractere.' }, 400);
    const illegalName = String(input.illegal_name ?? owned.organization.illegal_name ?? '').trim();
    if (illegalName.length > 120) return reply({ error: 'Numele organizației ilegale nu poate depăși 120 de caractere.' }, 400);
    const organizationCode = String(input.code ?? owned.organization.code ?? '').trim();
    if (organizationCode.length > 50) return reply({ error: 'Codul organizației nu poate depăși 50 de caractere.' }, 400);
    const state = await loadSettings();
    const settings = state.settings || {};
    const publicUrl = String(input.panel_public_url ?? settings.panel_public_url ?? '').trim().replace(/\/$/, '');
    if (!publicUrl) return reply({ error: 'Adresa publică a panelului este obligatorie.' }, 400);
    try {
      const parsedPublicUrl = new URL(publicUrl);
      if (!['http:', 'https:'].includes(parsedPublicUrl.protocol)) throw new Error();
    } catch {
      return reply({ error: 'Adresa publică a panelului trebuie să fie un URL valid.' }, 400);
    }
    const organizationPatch = {
      name,
      code: organizationCode || null,
      illegal_name: illegalName || null,
      address: String(input.address ?? '').trim() || null,
      description: String(input.description ?? '').trim() || null,
      logo_url: safeAssetUrl(input.logo_url, 'Logo-ul'),
      updated_at: new Date().toISOString()
    };
    const contract = normalizeContract(body.contract_template);
    const { error: organizationError } = await db.from('organizations').update(organizationPatch).eq('id', organizationId);
    if (organizationError) throw organizationError;

    const webhookRoutes = body.webhook_routes === undefined
      ? (settings.webhook_routes || {})
      : mergeWebhookRoutes(settings.webhook_routes, body.webhook_routes);
    const packageWebhookRoutes = Object.fromEntries(Object.entries(webhookRoutes).filter(([channel]) => packageAllowsWebhook(state.package, channel)));
    const settingsPatch = {
      organization_id: organizationId,
      discord_client_id: String(settings.discord_client_id ?? ''),
      panel_public_url: publicUrl,
      family_webhook_url: settings.family_webhook_url || null,
      mechanics_webhook_url: settings.mechanics_webhook_url || null,
      pontaj_webhook_url: settings.pontaj_webhook_url || null,
      requests_webhook_url: settings.requests_webhook_url || null,
      contracts_webhook_url: settings.contracts_webhook_url || null,
      marketplace_webhook_url: settings.marketplace_webhook_url || null,
      illegal_marketplace_webhook_url: settings.illegal_marketplace_webhook_url || null,
      webhook_routes: packageWebhookRoutes,
      updated_by_discord_id: discordId,
      updated_at: new Date().toISOString()
    };
    const { error: settingsError } = await db.from('organization_settings').upsert(settingsPatch, { onConflict: 'organization_id' });
    if (settingsError) throw settingsError;

    if (body.contract_template !== undefined) {
      if (!contract) {
        const { error } = await db.from('app_settings').delete().eq('organization_id', organizationId).eq('key', 'contract_template');
        if (error) throw error;
      } else {
        const { error } = await db.from('app_settings').upsert({ organization_id: organizationId, key: 'contract_template', value: contract, updated_at: new Date().toISOString() }, { onConflict: 'organization_id,key' });
        if (error) throw error;
      }
    }

    const currentState = await loadSettings();
    const availableDiscordRoles = await loadDiscordRoles(currentState.guilds);
    let savedRoleIds = new Set((currentState.role_mappings || []).map((role: any) => String(role.discord_role_id)));

    if (body.roles !== undefined) {
      if (!Array.isArray(body.roles) || body.roles.length < 1) {
        return reply({ error: 'Configurează cel puțin un rol Discord pentru organizație.' }, 400);
      }
      const { data: packageSetting, error: packageError } = await db.from('app_settings').select('value').eq('organization_id', organizationId).eq('key', 'organization_package').maybeSingle();
      if (packageError) throw packageError;
      if (packageSetting?.value?.code !== 'full' && body.roles.length > 10) return reply({ error: 'Pachetele Standard și Operations permit maximum 10 roluri.' }, 400);

      const seen = new Set<string>();
      const cleanRoles = body.roles.map((rawRole: any, index: number) => {
        const guildId = String(rawRole?.guild_id || '').trim();
        const roleId = String(rawRole?.discord_role_id || '').trim();
        const role = availableDiscordRoles.find((item: any) => item.guild_id === guildId && item.id === roleId);
        if (!role) throw new Error(`Rolul Discord de pe rândul ${index + 1} nu aparține serverului organizației.`);
        const key = `${guildId}:${roleId}`;
        if (seen.has(key)) throw new Error(`Rolul Discord „${role.name}” este selectat de două ori.`);
        seen.add(key);
        const panelRole = String(rawRole?.panel_role || role.name).trim();
        if (panelRole.length < 1 || panelRole.length > 100) throw new Error(`Numele rolului de pe rândul ${index + 1} este invalid.`);
        const level = body.roles.length - index;
        return {
          organization_id: organizationId,
          guild_id: guildId,
          discord_role_id: roleId,
          discord_role_name: role.name,
          panel_role: panelRole,
          permission_level: Math.max(1, Math.min(99, level)),
          priority: Math.max(1, level) * 10,
          enabled: true
        };
      });

      const { error: deleteRolesError } = await db.from('organization_role_mappings').delete().eq('organization_id', organizationId);
      if (deleteRolesError) throw deleteRolesError;
      const { error: insertRolesError } = await db.from('organization_role_mappings').insert(cleanRoles);
      if (insertRolesError) throw insertRolesError;
      savedRoleIds = new Set(cleanRoles.map((role: any) => String(role.discord_role_id)));
    }

    if (body.page_permissions !== undefined) {
      if (!body.page_permissions || typeof body.page_permissions !== 'object') {
        return reply({ error: 'Permisiunile pe pagini sunt invalide.' }, 400);
      }
      const pageRules = Object.fromEntries(
        Object.entries(body.page_permissions)
          .filter(([page]) => allowedPages.has(page) && packagePageAllowed(page, currentState.package))
          .map(([page, ids]: any) => [
            page,
            [...new Set((Array.isArray(ids) ? ids : [])
              .map(String)
              .filter((id: string) => savedRoleIds.has(id)))]
          ])
      );
      const { error: pagePermissionError } = await db.from('app_settings').upsert({
        organization_id: organizationId,
        key: 'page_permissions',
        value: pageRules,
        updated_at: new Date().toISOString()
      }, { onConflict: 'organization_id,key' });
      if (pagePermissionError) throw pagePermissionError;
    }

    const cleanRoleIds = (value: unknown, validRoleIds: Set<string>) => [
      ...new Set((Array.isArray(value) ? value : []).map(String).filter((id) => validRoleIds.has(id)))
    ];
    if (body.action_permissions !== undefined) {
      const actionRules = Object.fromEntries(
        Object.entries(body.action_permissions && typeof body.action_permissions === 'object' ? body.action_permissions : {})
          .filter(([action]) => allowedActionKeys.has(action))
          .map(([action, ids]) => [action, cleanRoleIds(ids, savedRoleIds)])
      ) as Record<string, string[]>;
      if (!packageAllowsFeature(currentState.package, 'requests_organization')) {
        actionRules['cereri.organization'] = [];
      }
      if (!packageAllowsFeature(currentState.package, 'actions_organization')) {
        actionRules['actions.organization.read'] = [];
        actionRules['actions.organization.write'] = [];
        actionRules['actions.organization.delete'] = [];
      }
      const organizationRequestRoles = new Set(actionRules['cereri.organization'] || []);
      if (!packageAllowsFeature(currentState.package, 'requests_departments')) actionRules['cereri.departments'] = [];
      actionRules['cereri.departments'] = (actionRules['cereri.departments'] || []).filter((id) => !organizationRequestRoles.has(id));
      const { error } = await db.from('app_settings').upsert({ organization_id: organizationId, key: 'action_permissions', value: actionRules, updated_at: new Date().toISOString() }, { onConflict: 'organization_id,key' });
      if (error) throw error;
    }
    if (body.assistant_page_permissions !== undefined) {
      const assistantRules = Object.fromEntries(
        Object.entries(body.assistant_page_permissions && typeof body.assistant_page_permissions === 'object' ? body.assistant_page_permissions : {})
          .filter(([page]) => allowedAssistantPages.has(page) && packagePageAllowed(page, currentState.package))
          .map(([page, ids]) => [page, cleanRoleIds(ids, savedRoleIds)])
      );
      const { error } = await db.from('app_settings').upsert({ organization_id: organizationId, key: 'assistant_page_permissions', value: assistantRules, updated_at: new Date().toISOString() }, { onConflict: 'organization_id,key' });
      if (error) throw error;
    }
    if (body.assistant_knowledge !== undefined) {
      const knowledge = sanitizeAssistantKnowledge(body.assistant_knowledge);
      const { error } = await db.from('app_settings').upsert({ organization_id: organizationId, key: 'assistant_knowledge', value: knowledge, updated_at: new Date().toISOString() }, { onConflict: 'organization_id,key' });
      if (error) throw error;
    }
    if (body.communication_permissions !== undefined) {
      const input = body.communication_permissions && typeof body.communication_permissions === 'object' ? body.communication_permissions as Record<string, any> : {};
      const communicationRules = Object.fromEntries(['organization', 'departments'].map((audience) => [audience, {
        read: cleanRoleIds(input[audience]?.read, savedRoleIds),
        write: cleanRoleIds(input[audience]?.write, savedRoleIds)
      }]));
      if (!packageAllowsFeature(currentState.package, 'announcements_organization')) communicationRules.organization = { read: [], write: [] };
      if (!packageAllowsFeature(currentState.package, 'announcements_departments')) communicationRules.departments = { read: [], write: [] };
      const { error } = await db.from('app_settings').upsert({ organization_id: organizationId, key: 'communication_permissions', value: communicationRules, updated_at: new Date().toISOString() }, { onConflict: 'organization_id,key' });
      if (error) throw error;
    }
    if (body.discipline_permissions !== undefined) {
      const input = body.discipline_permissions && typeof body.discipline_permissions === 'object' ? body.discipline_permissions as Record<string, any> : {};
      const disciplineRules = Object.fromEntries(['organization', 'departments'].map((audience) => [audience, {
        read: cleanRoleIds(input[audience]?.read, savedRoleIds),
        write: cleanRoleIds(input[audience]?.write, savedRoleIds),
        sanction: cleanRoleIds(input[audience]?.sanction, savedRoleIds)
      }]));
      if (!packageAllowsFeature(currentState.package, 'discipline_organization')) disciplineRules.organization = { read: [], write: [], sanction: [] };
      if (!packageAllowsFeature(currentState.package, 'discipline_departments')) disciplineRules.departments = { read: [], write: [], sanction: [] };
      const { error } = await db.from('app_settings').upsert({ organization_id: organizationId, key: 'discipline_permissions', value: disciplineRules, updated_at: new Date().toISOString() }, { onConflict: 'organization_id,key' });
      if (error) throw error;
    }

    const { data: updatedOrganization, error: updatedError } = await db.from('organizations')
      .select('id,name,slug,code,illegal_name,address,description,logo_url,active,lifecycle_status,deactivation_reason,deactivated_at,last_discord_check_at,last_discord_check_status')
      .eq('id', organizationId).single();
    if (updatedError) throw updatedError;
    const updatedState = await loadSettings();
    return reply({
      ok: true,
      organization: updatedOrganization,
      guild: owned.guild,
      guilds: updatedState.guilds,
      settings: maskSettings(updatedState.settings),
      contract_template: updatedState.contract_template,
      role_mappings: updatedState.role_mappings,
      page_permissions: updatedState.page_permissions,
      access: updatedState.access,
      package: updatedState.package,
      action_permissions: updatedState.action_permissions,
      assistant_page_permissions: updatedState.assistant_page_permissions,
      communication_permissions: updatedState.communication_permissions,
      discipline_permissions: updatedState.discipline_permissions,
      assistant_knowledge: updatedState.assistant_knowledge,
      discord_roles: availableDiscordRoles
    });
  } catch (error) {
    console.error(error);
    return reply({ error: error instanceof Error ? error.message : 'Eroare internă.' }, 500);
  }
});
