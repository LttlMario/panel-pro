import { createClient } from 'jsr:@supabase/supabase-js@2.112.3';
import { getPlatformSecret } from '../_shared/platform-secrets.ts';
import { packageAllowsPage as packagePageAllowed, resolvePackageFeatures } from '../_shared/package-features.ts';

const headers = { 'Access-Control-Allow-Origin': 'https://lttlmario.github.io', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-panel-session', 'Access-Control-Max-Age': '86400', 'Content-Type': 'application/json' };
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers });
const validGuild = (value: string) => /^\d{15,22}$/.test(value);
const webhookChannels = new Set(['organization', 'departments', 'pontaj', 'requests', 'requests_organization', 'requests_departments', 'contracts', 'contract_identity_weekly', 'marketplace', 'illegal_marketplace', 'fines_organization', 'fines_departments', 'warnings_organization', 'warnings_departments', 'sanctions_organization', 'sanctions_departments', 'status_live', 'organization_expiration']);
const fullOnlyWebhookChannels = new Set(['organization', 'requests_organization', 'illegal_marketplace', 'fines_organization', 'warnings_organization', 'sanctions_organization']);
const operationsWebhookChannels = new Set(['organization', 'requests_organization', 'fines_organization', 'warnings_organization', 'sanctions_organization', 'illegal_marketplace', 'organization_expiration']);
const standardWebhookChannels = new Set(['departments', 'pontaj', 'weekly_reports', 'contracts', 'contract_identity_weekly', 'marketplace', 'fines_departments', 'warnings_departments', 'sanctions_departments', 'status_live', 'organization_expiration']);
const allowedPages = new Set(['index.html', 'anunturi.html', 'pontaj.html', 'cereri.html', 'calculator.html', 'bucatarie.html', 'contracte.html', 'calculatorilegal.html', 'craftmecanics.html', 'locatiiilegale.html', 'marketplace.html', 'marketplace-ilegal.html', 'minigames.html', 'rapoarte.html', 'status-live.html', 'asistent.html']);
const fullOnlyPageFeatures = new Map([['calculatorilegal.html', 'illegal_calculator'], ['locatiiilegale.html', 'illegal_locations'], ['marketplace-ilegal.html', 'illegal_marketplace'], ['minigames.html', 'illegal_minigames']]);
const validWebhook = (value: unknown) => {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:' && ['discord.com', 'discordapp.com'].includes(url.hostname) && url.pathname.startsWith('/api/webhooks/');
  } catch { return false; }
};
const sanitizeWebhookRoutes = (raw: unknown, allowsWebhook: (channel: string) => boolean) => {
  if (!raw || typeof raw !== 'object') return {};
  return Object.fromEntries(Object.entries(raw as Record<string, any>).filter(([channel, route]) => {
    if (!webhookChannels.has(channel) || !allowsWebhook(channel) || !route || typeof route !== 'object') return false;
    return Boolean(route.primary?.enabled && validWebhook(route.primary.url)) || Boolean(route.secondary?.enabled && validWebhook(route.secondary.url));
  }).map(([channel, route]) => [channel, {
    primary: route.primary?.enabled && validWebhook(route.primary.url) ? { enabled: true, url: String(route.primary.url).trim() } : null,
    secondary: route.secondary?.enabled && validWebhook(route.secondary.url) ? { enabled: true, url: String(route.secondary.url).trim() } : null,
  }]));
};
const sanitizePagePermissions = (raw: unknown, allowsPage: (page: string) => boolean) => {
  if (!raw || typeof raw !== 'object') return {};
  return Object.fromEntries(Object.entries(raw as Record<string, any>)
    .filter(([page]) => allowedPages.has(page) && allowsPage(page))
    .map(([page, ids]) => [page, [...new Set((Array.isArray(ids) ? ids : []).map(String).filter((id) => /^\d{15,22}$/.test(id)))]]));
};
const allowedContractPlaceholders = new Set(['{{COMPANY}}', '{{ADDRESS}}', '{{MANAGER}}', '{{EMPLOYEE_NAME}}', '{{CNP}}', '{{PHONE}}', '{{POSITION}}', '{{SALARY}}', '{{PROGRAM}}', '{{START_DATE}}', '{{CONTRACT_NUMBER}}']);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  try {
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default;
    const db = createClient(Deno.env.get('SUPABASE_URL')!, key);
    const body = await req.json();
    const token = String(body.access_token || '').trim();
    const id = String(body.organization_id || '').trim();
    const action = String(body.action || 'update').trim();
    if (!token || !id) return reply({ error: 'Sesiunea Discord și organizația sunt obligatorii.' }, 400);

    const userResponse = await fetch('https://discord.com/api/v10/users/@me', { headers: { Authorization: `Bearer ${token}` } });
    if (!userResponse.ok) return reply({ error: 'Sesiunea Discord a expirat.' }, 401);
    const user = await userResponse.json();
    const discordId = String(user.id || '');
    const { data: org } = await db.from('organizations').select('id,lifecycle_status').eq('id', id).maybeSingle();
    if (!org || org.lifecycle_status !== 'draft') return reply({ error: 'Organizația nu este în starea Draft.' }, 400);
    const { data: voucher } = await db.from('organization_vouchers').select('redeemed_by_discord_id,redeemed_organization_id,guild_id,package_code').eq('redeemed_organization_id', id).maybeSingle();
    if (!voucher || String(voucher.redeemed_by_discord_id) !== discordId) return reply({ error: 'Nu ești creatorul acestei organizații Draft.' }, 403);
    const packageCode = String(voucher.package_code || 'standard').toLowerCase();
    const packageFeatures = new Set(resolvePackageFeatures({ code: packageCode }));
    const fullPackage = packageCode === 'full';
    const packageAllowsFeature = (feature: string) => packageFeatures.has(feature);
    const packageAllowsPage = (page: string) => packagePageAllowed(page, { code: packageCode });
    const packageAllowsWebhook = (channel: string) => packageCode === 'operations'
      ? operationsWebhookChannels.has(channel)
      : packageCode === 'standard' ? standardWebhookChannels.has(channel) : true;
    if (action === 'attach_guild' || action === 'attach_secondary_guild') {
      const guildId = String(body.guild_id || '').trim();
      if (!validGuild(guildId)) return reply({ error: 'Guild ID invalid.' }, 400);
      const kind = action === 'attach_secondary_guild' ? 'secondary' : 'primary';
      if (kind === 'secondary' && !fullPackage) return reply({ error: 'Pachetul Standard permite un singur server Discord.' }, 403);
      if (kind === 'primary' && voucher.guild_id && String(voucher.guild_id) !== guildId) return reply({ error: 'Guild ID-ul nu corespunde voucherului.' }, 400);
      if (kind === 'secondary' && voucher.guild_id && String(voucher.guild_id) === guildId) return reply({ error: 'Serverul secundar trebuie să fie diferit de cel principal.' }, 400);
      const botToken = await getPlatformSecret(db, 'discord_bot_token');
      if (!botToken) throw new Error('Botul aplicației nu este configurat în Supabase.');
      const botHeaders = { Authorization: `Bot ${botToken}` };
      const [guildResponse, memberResponse] = await Promise.all([
        fetch(`https://discord.com/api/v10/guilds/${guildId}`, { headers: botHeaders }),
        fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${discordId}`, { headers: botHeaders })
      ]);
      if (!guildResponse.ok) return reply({ error: 'Botul nu este pe serverul indicat.' }, 400);
      if (!memberResponse.ok) return reply({ error: 'Utilizatorul nu este membru pe serverul indicat.' }, 403);
      const guild = await guildResponse.json();
      const { error } = await db.from('organization_guilds').upsert({ organization_id: id, guild_id: guildId, guild_name: String(guild.name || ''), kind, enabled: true }, { onConflict: 'organization_id,kind' });
      if (error) throw error;
      await db.from('organization_lifecycle_events').insert({ organization_id: id, event_type: kind === 'primary' ? 'draft_guild_attached' : 'draft_secondary_guild_attached', actor_discord_id: discordId, details: { guild_id: guildId, kind } });
      return reply({ ok: true, organization_id: id, guild_id: guildId, guild_name: guild.name });
    }

    const patch: Record<string, unknown> = {};
    for (const field of ['logo_url', 'banner_url', 'address']) if (body[field] !== undefined) patch[field] = String(body[field] || '').trim() || null;
    if (Object.keys(patch).length) {
      const { error } = await db.from('organizations').update(patch).eq('id', id);
      if (error) throw error;
    }
    if (body.webhook_routes) {
      const { data: currentSettings } = await db.from('organization_settings').select('discord_client_id,panel_public_url').eq('organization_id', id).maybeSingle();
       const { error } = await db.from('organization_settings').upsert({ organization_id: id, discord_client_id: String(body.discord_client_id || currentSettings?.discord_client_id || ''), panel_public_url: String(body.panel_public_url || currentSettings?.panel_public_url || ''), webhook_routes: sanitizeWebhookRoutes(body.webhook_routes, packageAllowsWebhook), updated_at: new Date().toISOString() }, { onConflict: 'organization_id' });
      if (error) throw error;
    }
    if (body.page_permissions) {
       const { error } = await db.from('app_settings').upsert({ organization_id: id, key: 'page_permissions', value: sanitizePagePermissions(body.page_permissions, packageAllowsPage), updated_at: new Date().toISOString() }, { onConflict: 'organization_id,key' });
      if (error) throw error;
    }
    if (body.assistant_page_permissions && typeof body.assistant_page_permissions === 'object') {
       const value = sanitizePagePermissions(body.assistant_page_permissions, packageAllowsPage);
      const { error } = await db.from('app_settings').upsert({ organization_id: id, key: 'assistant_page_permissions', value, updated_at: new Date().toISOString() }, { onConflict: 'organization_id,key' });
      if (error) throw error;
    }
    if (body.action_permissions && typeof body.action_permissions === 'object') {
      const allowedActions = new Set(['anunturi.publish', 'cereri.organization', 'cereri.departments']);
      const value = Object.fromEntries(Object.entries(body.action_permissions).filter(([action]) => allowedActions.has(action)).map(([action, ids]: any) => [action, [...new Set((Array.isArray(ids) ? ids : []).map(String).filter((id) => /^\d{15,22}$/.test(id)))] ]));
      if (!packageAllowsFeature('requests_organization')) value['cereri.organization'] = [];
      const organizationRoles = new Set(value['cereri.organization'] || []);
      if (!packageAllowsFeature('requests_departments')) value['cereri.departments'] = [];
      if (Array.isArray(value['cereri.departments'])) value['cereri.departments'] = value['cereri.departments'].filter((id: string) => !organizationRoles.has(id));
      const { error } = await db.from('app_settings').upsert({ organization_id: id, key: 'action_permissions', value, updated_at: new Date().toISOString() }, { onConflict: 'organization_id,key' });
      if (error) throw error;
    }
    if (body.communication_permissions && typeof body.communication_permissions === 'object') {
      const clean = (audience: string, kind: string) => [...new Set((Array.isArray(body.communication_permissions[audience]?.[kind]) ? body.communication_permissions[audience][kind] : []).map(String).filter((id) => /^\d{15,22}$/.test(id)))];
      const value = {
        organization: packageAllowsFeature('announcements_organization') ? { read: clean('organization', 'read'), write: clean('organization', 'write') } : { read: [], write: [] },
        departments: packageAllowsFeature('announcements_departments') ? { read: clean('departments', 'read'), write: clean('departments', 'write') } : { read: [], write: [] }
      };
      const { error } = await db.from('app_settings').upsert({ organization_id: id, key: 'communication_permissions', value, updated_at: new Date().toISOString() }, { onConflict: 'organization_id,key' });
      if (error) throw error;
    }
    if (body.discipline_permissions && typeof body.discipline_permissions === 'object') {
      const clean = (audience: string, kind: string) => [...new Set((Array.isArray(body.discipline_permissions[audience]?.[kind]) ? body.discipline_permissions[audience][kind] : []).map(String).filter((id) => /^\d{15,22}$/.test(id)))];
      const value = {
        organization: packageAllowsFeature('discipline_organization') ? { read: clean('organization', 'read'), write: clean('organization', 'write'), sanction: clean('organization', 'sanction') } : { read: [], write: [], sanction: [] },
        departments: packageAllowsFeature('discipline_departments') ? { read: clean('departments', 'read'), write: clean('departments', 'write'), sanction: clean('departments', 'sanction') } : { read: [], write: [], sanction: [] }
      };
      const { error } = await db.from('app_settings').upsert({ organization_id: id, key: 'discipline_permissions', value, updated_at: new Date().toISOString() }, { onConflict: 'organization_id,key' });
      if (error) throw error;
    }
    if (body.contract_template) {
      const title = String(body.contract_template.title || '').trim();
      const template = String(body.contract_template.template || '').trim();
      if (title.length < 2) return reply({ error: 'Numele contractului este obligatoriu.' }, 400);
      if (template.length < 20) return reply({ error: 'Textul contractului este prea scurt.' }, 400);
      const unknown = [...template.matchAll(/{{[A-Z0-9_]+}}/g)].map((match) => match[0]).filter((value) => !allowedContractPlaceholders.has(value));
      if (unknown.length) return reply({ error: `Câmpuri necunoscute în contract: ${[...new Set(unknown)].join(', ')}` }, 400);
      const defaults = body.contract_template.defaults && typeof body.contract_template.defaults === 'object' ? body.contract_template.defaults : {};
      const { error } = await db.from('app_settings').upsert({ organization_id: id, key: 'contract_template', value: {
        title, template, defaults: { salary: String(defaults.salary || '').trim() || null },
      }, updated_at: new Date().toISOString() }, { onConflict: 'organization_id,key' });
      if (error) throw error;
    }
    return reply({ ok: true, organization_id: id });
  } catch (error) {
    return reply({ error: error instanceof Error ? error.message : 'Eroare internă.' }, 500);
  }
});
