import { createClient } from 'jsr:@supabase/supabase-js@2.112.3';

const headers = {
  'Access-Control-Allow-Origin': 'https://lttlmario.github.io',
  'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-panel-session',
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
  if (request.method !== 'POST') return reply({ error: 'Metodă invalidă.' }, 405);

  try {
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ||
      JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default;
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const botToken = String(Deno.env.get('DISCORD_BOT_TOKEN') || '').trim();
    const jwt = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
    const body = await request.json().catch(() => ({}));
    const discordAccessToken = String(body.discord_access_token || '').trim();

    if (!serviceKey || !supabaseUrl || !botToken) throw new Error('Configurația serverului lipsește.');
    if (!jwt) return reply({ error: 'Sesiunea email lipsește sau a expirat.' }, 401);
    if (!discordAccessToken) return reply({ error: 'Aprobarea Discord lipsește sau a expirat.' }, 400);

    const db = createClient(supabaseUrl, serviceKey);
    const { data: authData, error: authError } = await db.auth.getUser(jwt);
    if (authError || !authData.user) return reply({ error: 'Sesiunea email nu este validă.' }, 401);
    if (!authData.user.email_confirmed_at) return reply({ error: 'Confirmă mai întâi adresa de email.' }, 403);

    const requestIp = String(request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'unknown')
      .split(',')[0].trim().slice(0, 120);
    const { data: listAllowed, error: listRateError } = await db.rpc('consume_panel_rate_limit', {
      p_key: `email-discord-guilds:${authData.user.id}:${requestIp}`,
      p_limit: 20,
      p_window_seconds: 900,
    });
    if (listRateError) {
      console.error('Email/Discord guild list rate-limit unavailable:', listRateError.message);
      return reply({ error: 'Protecția anti-abuz este temporar indisponibilă. Încearcă din nou în câteva minute.' }, 503);
    }
    if (listAllowed === false) return reply({ error: 'Prea multe încercări. Așteaptă 15 minute și încearcă din nou.' }, 429);

    const { data: account, error: accountError } = await db
      .from('user_accounts')
      .select('auth_user_id')
      .eq('auth_user_id', authData.user.id)
      .maybeSingle();
    if (accountError) throw accountError;
    if (!account) return reply({ error: 'Profilul contului nu există încă.' }, 404);

    const discordGuildsResponse = await fetch('https://discord.com/api/v10/users/@me/guilds', {
      headers: { Authorization: `Bearer ${discordAccessToken}` },
    });
    if (!discordGuildsResponse.ok) return reply({ error: 'Aprobarea Discord a expirat. Reia conectarea pentru a citi guildurile.' }, 401);
    const discordGuilds = await discordGuildsResponse.json().catch(() => []);
    const memberGuildIds = new Set((Array.isArray(discordGuilds) ? discordGuilds : []).map((guild: any) => String(guild.id || '')));

    const { data: rows, error: guildError } = await db
      .from('organization_guilds')
      .select('guild_id,guild_name,kind,organization_id,organizations!inner(id,name,active)')
      .eq('enabled', true)
      .eq('organizations.active', true)
      .order('guild_name');
    if (guildError) throw guildError;

    const guilds = await Promise.all((rows || []).map(async (row: any) => {
      const guildId = String(row.guild_id || '').trim();
      if (!memberGuildIds.has(guildId)) return null;
      const response = await fetch(`https://discord.com/api/v10/guilds/${guildId}`, { headers: botHeaders(botToken) });
      return {
        guild_id: guildId,
        guild_name: String(row.guild_name || row.organizations?.name || 'Server Discord'),
        kind: String(row.kind || 'primary'),
        organization_id: String(row.organization_id || row.organizations?.id || ''),
        organization_name: String(row.organizations?.name || ''),
        bot_available: response.ok,
      };
    }));

    return reply({ ok: true, guilds: guilds.filter(Boolean) });
  } catch (error) {
    console.error(error);
    return reply({ error: error instanceof Error ? error.message : 'Serverele Discord nu au putut fi încărcate.' }, 500);
  }
});

