import { createClient } from 'jsr:@supabase/supabase-js@2';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization,apikey,content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers });
const botHeaders = (token: string) => ({
  Authorization: `Bot ${token}`,
  'User-Agent': 'PanelManagement/1.0 (+https://panel-management.netlify.app)',
});

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers });
  if (request.method !== 'POST') return reply({ error: 'MetodÄƒ invalidÄƒ.' }, 405);

  try {
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ||
      JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default;
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const botToken = String(Deno.env.get('DISCORD_BOT_TOKEN') || '').trim();
    const jwt = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();

    if (!serviceKey || !supabaseUrl || !botToken) throw new Error('ConfiguraÈ›ia serverului lipseÈ™te.');
    if (!jwt) return reply({ error: 'Sesiunea email lipseÈ™te sau a expirat.' }, 401);

    const db = createClient(supabaseUrl, serviceKey);
    const { data: authData, error: authError } = await db.auth.getUser(jwt);
    if (authError || !authData.user) return reply({ error: 'Sesiunea email nu este validÄƒ.' }, 401);
    if (!authData.user.email_confirmed_at) return reply({ error: 'ConfirmÄƒ mai Ã®ntÃ¢i adresa de email.' }, 403);

    const { data: account, error: accountError } = await db
      .from('user_accounts')
      .select('auth_user_id')
      .eq('auth_user_id', authData.user.id)
      .maybeSingle();
    if (accountError) throw accountError;
    if (!account) return reply({ error: 'Profilul contului nu existÄƒ Ã®ncÄƒ.' }, 404);

    const { data: rows, error: guildError } = await db
      .from('organization_guilds')
      .select('guild_id,guild_name,kind,organization_id,organizations!inner(id,name,active)')
      .eq('enabled', true)
      .eq('organizations.active', true)
      .order('guild_name');
    if (guildError) throw guildError;

    const guilds = await Promise.all((rows || []).map(async (row: any) => {
      const guildId = String(row.guild_id || '').trim();
      const response = await fetch(`https://discord.com/api/v10/guilds/${guildId}`, { headers: botHeaders(botToken) });
      return {
        guild_id: guildId,
        guild_name: String(row.guild_name || row.organizations?.name || 'Server Discord'),
        kind: String(row.kind || 'primary'),
        organization_id: String(row.organization_id),
        organization_name: String(row.organizations?.name || ''),
        bot_available: response.ok,
      };
    }));

    return reply({ ok: true, guilds });
  } catch (error) {
    console.error(error);
    return reply({ error: error instanceof Error ? error.message : 'Serverele Discord nu au putut fi Ã®ncÄƒrcate.' }, 500);
  }
});
