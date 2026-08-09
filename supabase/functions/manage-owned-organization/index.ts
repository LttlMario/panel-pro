import { createClient } from 'jsr:@supabase/supabase-js@2';
import { isPlatformAdminDiscordId } from '../_shared/platform-admin.ts';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-panel-session',
  'Access-Control-Max-Age': '86400',
  'Content-Type': 'application/json'
};

const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers });
const webhookChannels = new Set([
  'organization', 'departments', 'pontaj', 'requests', 'requests_organization',
  'requests_departments', 'contracts', 'marketplace', 'illegal_marketplace',
  'fines_organization', 'fines_departments', 'status_live'
]);
const allowedContractPlaceholders = new Set([
  '{{COMPANY}}', '{{ADDRESS}}', '{{MANAGER}}', '{{EMPLOYEE_NAME}}', '{{CNP}}',
  '{{PHONE}}', '{{POSITION}}', '{{SALARY}}', '{{PROGRAM}}', '{{START_DATE}}',
  '{{CONTRACT_NUMBER}}'
]);

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

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers });
  if (request.method !== 'POST') return reply({ error: 'Metodă invalidă.' }, 405);

  try {
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
      || JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default;
    const botToken = String(Deno.env.get('DISCORD_BOT_TOKEN') || '').trim();
    if (!key) throw new Error('Cheia secretă Supabase lipsește.');
    if (!botToken) throw new Error('DISCORD_BOT_TOKEN lipsește din configurația Supabase.');

    const db = createClient(Deno.env.get('SUPABASE_URL')!, key);
    const body = await request.json();
    const action = String(body.action || 'owner_get').trim();
    if (!['owner_get', 'owner_update'].includes(action)) return reply({ error: 'Acțiune necunoscută.' }, 400);

    const accessToken = String(body.access_token || '').trim();
    if (!accessToken) return reply({ error: 'Sesiunea Discord lipsește sau a expirat.' }, 401);
    const userResponse = await fetch('https://discord.com/api/v10/users/@me', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!userResponse.ok) return reply({ error: 'Sesiunea Discord a expirat.' }, 401);
    const discordUser = await userResponse.json();
    const discordId = String(discordUser.id || '').trim();
    if (!discordId) return reply({ error: 'Contul Discord nu a putut fi identificat.' }, 401);

    const requestedOrganizationId = String(body.organization_id || '').trim();
    let candidates: any[] = [];
    if (requestedOrganizationId) {
      const [{ data: organization }, { data: guild }] = await Promise.all([
        db.from('organizations').select('id,name,slug,address,description,logo_url,banner_url,active,lifecycle_status').eq('id', requestedOrganizationId).maybeSingle(),
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
          .select('id,name,slug,address,description,logo_url,banner_url,active,lifecycle_status')
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
    if (!owned && !isPlatformAdminDiscordId(discordId)) return reply({ error: 'Acces refuzat. Doar proprietarul serverului Discord sau administratorul platformei poate administra această organizație.' }, 403);

    if (!owned && isPlatformAdminDiscordId(discordId)) {
      const fallbackOrganizationId = requestedOrganizationId;
      if (!fallbackOrganizationId) return reply({ error: 'Administratorul platformei trebuie să selecteze o organizație.' }, 400);
      const { data: fallbackOrganization, error: fallbackError } = await db.from('organizations')
        .select('id,name,slug,address,description,logo_url,banner_url,active,lifecycle_status')
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
      const [{ data: settings }, { data: contractSetting }] = await Promise.all([
        db.from('organization_settings').select('*').eq('organization_id', organizationId).maybeSingle(),
        db.from('app_settings').select('value').eq('organization_id', organizationId).eq('key', 'contract_template').maybeSingle()
      ]);
      return { settings: settings || {}, contract_template: contractSetting?.value || {} };
    };

    if (action === 'owner_get') {
      const state = await loadSettings();
      return reply({ ok: true, organization: owned.organization, guild: owned.guild, settings: state.settings, contract_template: state.contract_template });
    }

    const input = body.organization && typeof body.organization === 'object' ? body.organization : {};
    const name = String(input.name ?? owned.organization.name ?? '').trim();
    if (name.length < 2 || name.length > 100) return reply({ error: 'Numele organizației trebuie să aibă între 2 și 100 de caractere.' }, 400);
    const organizationPatch = {
      name,
      address: String(input.address ?? '').trim() || null,
      description: String(input.description ?? '').trim() || null,
      logo_url: safeAssetUrl(input.logo_url, 'Logo-ul'),
      banner_url: safeAssetUrl(input.banner_url, 'Bannerul'),
      updated_at: new Date().toISOString()
    };
    const contract = normalizeContract(body.contract_template);
    const { error: organizationError } = await db.from('organizations').update(organizationPatch).eq('id', organizationId);
    if (organizationError) throw organizationError;

    const state = await loadSettings();
    const settings = state.settings || {};
    const webhookRoutes = body.webhook_routes === undefined
      ? (settings.webhook_routes || {})
      : sanitizeWebhookRoutes(body.webhook_routes);
    const settingsPatch = {
      organization_id: organizationId,
      discord_client_id: String(settings.discord_client_id ?? ''),
      panel_public_url: String(settings.panel_public_url ?? ''),
      family_webhook_url: settings.family_webhook_url || null,
      mechanics_webhook_url: settings.mechanics_webhook_url || null,
      pontaj_webhook_url: settings.pontaj_webhook_url || null,
      requests_webhook_url: settings.requests_webhook_url || null,
      contracts_webhook_url: settings.contracts_webhook_url || null,
      marketplace_webhook_url: settings.marketplace_webhook_url || null,
      illegal_marketplace_webhook_url: settings.illegal_marketplace_webhook_url || null,
      webhook_routes: webhookRoutes,
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

    const { data: updatedOrganization, error: updatedError } = await db.from('organizations')
      .select('id,name,slug,address,description,logo_url,banner_url,active,lifecycle_status')
      .eq('id', organizationId).single();
    if (updatedError) throw updatedError;
    const updatedState = await loadSettings();
    return reply({ ok: true, organization: updatedOrganization, guild: owned.guild, settings: updatedState.settings, contract_template: updatedState.contract_template });
  } catch (error) {
    console.error(error);
    return reply({ error: error instanceof Error ? error.message : 'Eroare internă.' }, 500);
  }
});
