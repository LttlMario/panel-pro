import { createClient } from 'jsr:@supabase/supabase-js@2';

const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization,apikey,content-type', 'Content-Type': 'application/json' };
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers });
const validGuild = (value: string) => /^\d{15,22}$/.test(value);
const webhookChannels = new Set(['organization', 'departments', 'pontaj', 'requests', 'contracts', 'marketplace', 'illegal_marketplace']);
const validWebhook = (value: unknown) => {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:' && ['discord.com', 'discordapp.com'].includes(url.hostname) && url.pathname.startsWith('/api/webhooks/');
  } catch { return false; }
};
const sanitizeWebhookRoutes = (raw: unknown) => {
  if (!raw || typeof raw !== 'object') return {};
  return Object.fromEntries(Object.entries(raw as Record<string, any>).filter(([channel, route]) => {
    if (!webhookChannels.has(channel) || !route || typeof route !== 'object') return false;
    return Boolean(route.primary?.enabled && validWebhook(route.primary.url)) || Boolean(route.secondary?.enabled && validWebhook(route.secondary.url));
  }).map(([channel, route]) => [channel, {
    primary: route.primary?.enabled && validWebhook(route.primary.url) ? { enabled: true, url: String(route.primary.url).trim() } : null,
    secondary: route.secondary?.enabled && validWebhook(route.secondary.url) ? { enabled: true, url: String(route.secondary.url).trim() } : null,
  }]));
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
    const { data: voucher } = await db.from('organization_vouchers').select('redeemed_by_discord_id,redeemed_organization_id,guild_id').eq('redeemed_organization_id', id).maybeSingle();
    if (!voucher || String(voucher.redeemed_by_discord_id) !== discordId) return reply({ error: 'Nu ești creatorul acestei organizații Draft.' }, 403);

    if (action === 'attach_guild') {
      const guildId = String(body.guild_id || '').trim();
      if (!validGuild(guildId)) return reply({ error: 'Guild ID invalid.' }, 400);
      if (voucher.guild_id && String(voucher.guild_id) !== guildId) return reply({ error: 'Guild ID-ul nu corespunde voucherului.' }, 400);
      const botToken = String(Deno.env.get('DISCORD_BOT_TOKEN') || '').trim();
      if (!botToken) throw new Error('Botul aplicației nu este configurat în Supabase.');
      const botHeaders = { Authorization: `Bot ${botToken}` };
      const [guildResponse, memberResponse] = await Promise.all([
        fetch(`https://discord.com/api/v10/guilds/${guildId}`, { headers: botHeaders }),
        fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${discordId}`, { headers: botHeaders })
      ]);
      if (!guildResponse.ok) return reply({ error: 'Botul nu este pe serverul indicat.' }, 400);
      if (!memberResponse.ok) return reply({ error: 'Utilizatorul nu este membru pe serverul indicat.' }, 403);
      const guild = await guildResponse.json();
      const { error } = await db.from('organization_guilds').upsert({ organization_id: id, guild_id: guildId, guild_name: String(guild.name || ''), kind: 'primary', enabled: true }, { onConflict: 'organization_id,kind' });
      if (error) throw error;
      await db.from('organization_lifecycle_events').insert({ organization_id: id, event_type: 'draft_guild_attached', actor_discord_id: discordId, details: { guild_id: guildId } });
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
      const { error } = await db.from('organization_settings').upsert({ organization_id: id, discord_client_id: String(body.discord_client_id || currentSettings?.discord_client_id || ''), panel_public_url: String(body.panel_public_url || currentSettings?.panel_public_url || ''), webhook_routes: sanitizeWebhookRoutes(body.webhook_routes), updated_at: new Date().toISOString() }, { onConflict: 'organization_id' });
      if (error) throw error;
    }
    if (body.page_permissions) {
      const { error } = await db.from('app_settings').upsert({ organization_id: id, key: 'page_permissions', value: body.page_permissions, updated_at: new Date().toISOString() }, { onConflict: 'organization_id,key' });
      if (error) throw error;
    }
    if (body.contract_template) {
      const title = String(body.contract_template.title || '').trim();
      const template = String(body.contract_template.template || '').trim();
      if (title.length < 2) return reply({ error: 'Numele contractului este obligatoriu.' }, 400);
      if (template.length < 20) return reply({ error: 'Textul contractului este prea scurt.' }, 400);
      const unknown = [...template.matchAll(/{{[A-Z0-9_]+}}/g)].map((match) => match[0]).filter((value) => !allowedContractPlaceholders.has(value));
      if (unknown.length) return reply({ error: `C�mpuri necunoscute în contract: ${[...new Set(unknown)].join(', ')}` }, 400);
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
