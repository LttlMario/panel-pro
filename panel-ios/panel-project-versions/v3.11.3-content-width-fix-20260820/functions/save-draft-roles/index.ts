import { createClient } from 'jsr:@supabase/supabase-js@2.112.3';
import { getPlatformSecret } from '../_shared/platform-secrets.ts';

const headers = { 'Access-Control-Allow-Origin': 'https://lttlmario.github.io', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-panel-session', 'Access-Control-Max-Age': '86400', 'Content-Type': 'application/json' };
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers });

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers });
  try {
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default;
    const db = createClient(Deno.env.get('SUPABASE_URL')!, key);
    const body = await request.json();
    const token = String(body.access_token || '').trim();
    const code = String(body.voucher_code || '').trim().toUpperCase();
    const primaryGuildId = String(body.guild_id || '').trim();
    const organizationId = String(body.organization_id || '').trim();
    const roles = Array.isArray(body.roles) ? body.roles : [];
    if (!token || !code || !organizationId || !/^\d{15,22}$/.test(primaryGuildId) || !roles.length) return reply({ error: 'Datele rolurilor sunt incomplete.' }, 400);

    const meResponse = await fetch('https://discord.com/api/v10/users/@me', { headers: { Authorization: `Bearer ${token}` } });
    if (!meResponse.ok) return reply({ error: 'Sesiunea Discord a expirat.' }, 401);
    const user = await meResponse.json();
    const { data: voucher } = await db.from('organization_vouchers').select('redeemed_by_discord_id,redeemed_organization_id,guild_id').eq('code', code).maybeSingle();
    if (!voucher || String(voucher.redeemed_by_discord_id) !== String(user.id) || String(voucher.redeemed_organization_id) !== organizationId) return reply({ error: 'Voucherul sau organizația nu corespunde.' }, 403);
    if (voucher.guild_id && String(voucher.guild_id) !== primaryGuildId) return reply({ error: 'Guild ID-ul nu corespunde voucherului.' }, 403);
    const { data: guildRows } = await db.from('organization_guilds').select('guild_id').eq('organization_id', organizationId).eq('enabled', true);
    const allowedGuilds = new Set((guildRows || []).map((row: any) => String(row.guild_id)));
    allowedGuilds.add(primaryGuildId);
    if (roles.some((role: any) => !/^\d{15,22}$/.test(String(role.guild_id || primaryGuildId)) || !allowedGuilds.has(String(role.guild_id || primaryGuildId)))) return reply({ error: 'Un rol selectat nu aparține unui server configurat.' }, 400);
    const guildIds = [...new Set(roles.map((role: any) => String(role.guild_id || primaryGuildId)))];
    const bot = await getPlatformSecret(db, 'discord_bot_token');
    if (!bot) return reply({ error: 'Botul Discord nu este configurat în Supabase.' }, 500);
    const availableRoles = new Set<string>();
    for (const guildId of guildIds) {
      const response = await fetch(`https://discord.com/api/v10/guilds/${guildId}/roles`, { headers: { Authorization: `Bot ${bot}` } });
      if (!response.ok) return reply({ error: 'Botul nu poate verifica rolurile de pe server.' }, 400);
      for (const role of await response.json()) if (!role.managed) availableRoles.add(`${guildId}:${String(role.id)}`);
    }
    if (roles.some((role: any) => !availableRoles.has(`${String(role.guild_id || primaryGuildId)}:${String(role.id)}`))) return reply({ error: 'Un rol selectat nu există pe server.' }, 400);
    const { data: packageSetting } = await db.from('app_settings').select('value').eq('organization_id', organizationId).eq('key', 'organization_package').maybeSingle();
    if (packageSetting?.value?.code !== 'full' && roles.length > 10) return reply({ error: 'Pachetul Standard permite maximum 10 roluri.' }, 400);
    await db.from('organization_role_mappings').delete().eq('organization_id', organizationId);
    const { error } = await db.from('organization_role_mappings').insert(roles.map((role: any, index: number) => ({ organization_id: organizationId, guild_id: String(role.guild_id || primaryGuildId), discord_role_id: String(role.id), discord_role_name: String(role.name || ''), panel_role: String(role.panel_role || role.name || ''), permission_level: 1, priority: roles.length - index, enabled: true })));
    if (error) throw error;
    return reply({ ok: true, count: roles.length });
  } catch (error) {
    return reply({ error: error instanceof Error ? error.message : 'Eroare internă.' }, 500);
  }
});
