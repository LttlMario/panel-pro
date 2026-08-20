import { createClient } from 'jsr:@supabase/supabase-js@2.112.3';

const headers = { 'Access-Control-Allow-Origin': 'https://lttlmario.github.io', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-panel-session', 'Access-Control-Max-Age': '86400', 'Content-Type': 'application/json' };
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers });
const discordBotHeaders = (bot: string) => ({ Authorization: `Bot ${bot}`, 'User-Agent': 'PanelManagement/1.0 (+https://panel-management.netlify.app)' });

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers });
  try {
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default;
    const db = createClient(Deno.env.get('SUPABASE_URL')!, key);
    const body = await request.json();
    const token = String(body.access_token || '').trim();
    const code = String(body.voucher_code || '').trim().toUpperCase();
    const guildId = String(body.guild_id || '').trim();
    const kind = body.kind === 'secondary' ? 'secondary' : 'primary';
    if (!token || !code || !/^\d{15,22}$/.test(guildId)) return reply({ error: 'Datele de verificare sunt incomplete.' }, 400);

    const meResponse = await fetch('https://discord.com/api/v10/users/@me', { headers: { Authorization: `Bearer ${token}` } });
    if (!meResponse.ok) return reply({ error: 'Sesiunea Discord a expirat.' }, 401);
    const user = await meResponse.json();
    const { data: voucher } = await db.from('organization_vouchers').select('redeemed_by_discord_id,redeemed_organization_id,guild_id,package_code').eq('code', code).maybeSingle();
    if (!voucher || String(voucher.redeemed_by_discord_id) !== String(user.id)) return reply({ error: 'Voucherul nu aparține contului autentificat.' }, 403);
    if (kind === 'secondary' && String(voucher.package_code || 'standard').toLowerCase() !== 'full') return reply({ error: 'Pachetul Standard permite un singur server Discord.' }, 403);
    if (kind === 'primary' && voucher.guild_id && String(voucher.guild_id) !== guildId) return reply({ error: 'Guild ID-ul nu corespunde voucherului.' }, 403);

    const bot = String(Deno.env.get('DISCORD_BOT_TOKEN') || '').trim();
    if (!bot) return reply({ error: 'Botul Discord nu este configurat în Supabase.' }, 500);
    const botHeaders = discordBotHeaders(bot);
    const [guildResponse, rolesResponse] = await Promise.all([
      fetch(`https://discord.com/api/v10/guilds/${guildId}`, { headers: botHeaders }),
      fetch(`https://discord.com/api/v10/guilds/${guildId}/roles`, { headers: botHeaders })
    ]);
    if (!guildResponse.ok || !rolesResponse.ok) return reply({ error: 'Botul nu poate citi serverul sau rolurile Discord.' }, 400);
    const guild = await guildResponse.json();
    const roles = await rolesResponse.json();
    return reply({ organization_id: voucher.redeemed_organization_id, guild: { id: String(guild.id), name: String(guild.name || guildId) }, roles: (roles || []).filter((role: any) => !role.managed && String(role.id) !== guildId).map((role: any) => ({ id: String(role.id), name: String(role.name), position: Number(role.position) || 0 })).sort((a: any, b: any) => b.position - a.position) });
  } catch (error) {
    return reply({ error: error instanceof Error ? error.message : 'Eroare internă.' }, 500);
  }
});
