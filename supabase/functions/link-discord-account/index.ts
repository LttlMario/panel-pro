import { createClient } from 'jsr:@supabase/supabase-js@2';

const headers = {
  'Access-Control-Allow-Origin': 'https://lttlmario.github.io',
  'Access-Control-Allow-Headers': 'authorization,apikey,content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

const reply = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers });

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers });
  if (request.method !== 'POST') return reply({ error: 'Metodă invalidă.' }, 405);

  try {
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ||
      JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default;
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const authorization = request.headers.get('authorization') || '';
    const jwt = authorization.replace(/^Bearer\s+/i, '').trim();
    const body = await request.json().catch(() => ({}));
    const discordAccessToken = String(body.discord_access_token || '').trim();

    if (!serviceKey || !supabaseUrl) throw new Error('Configurația Supabase lipsește.');
    if (!jwt) return reply({ error: 'Sesiunea email lipsește sau a expirat.' }, 401);
    if (!discordAccessToken) return reply({ error: 'Tokenul Discord lipsește.' }, 400);

    const db = createClient(supabaseUrl, serviceKey);
    const { data: authData, error: authError } = await db.auth.getUser(jwt);
    if (authError || !authData.user) return reply({ error: 'Sesiunea email nu este validă.' }, 401);
    if (!authData.user.email_confirmed_at) return reply({ error: 'Confirmă mai întâi adresa de email.' }, 403);

    const requestIp = String(request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'unknown')
      .split(',')[0].trim().slice(0, 120);
    const { data: linkAllowed, error: linkRateError } = await db.rpc('consume_panel_rate_limit', {
      p_key: `discord-account-link:${authData.user.id}:${requestIp}`,
      p_limit: 10,
      p_window_seconds: 900,
    });
    if (linkRateError) {
      console.error('Discord account link rate-limit unavailable:', linkRateError.message);
      return reply({ error: 'Protecția anti-abuz este temporar indisponibilă. Încearcă din nou în câteva minute.' }, 503);
    }
    if (linkAllowed === false) return reply({ error: 'Prea multe încercări. Așteaptă 15 minute și încearcă din nou.' }, 429);

    const discordResponse = await fetch('https://discord.com/api/v10/users/@me', {
      headers: { Authorization: `Bearer ${discordAccessToken}` },
    });
    if (!discordResponse.ok) return reply({ error: 'Sesiunea Discord nu este validă sau a expirat.' }, 401);
    const discordUser = await discordResponse.json();
    const discordId = String(discordUser.id || '').trim();
    if (!discordId) return reply({ error: 'Contul Discord nu a putut fi identificat.' }, 401);

    const { data: account, error: accountError } = await db
      .from('user_accounts')
      .select('auth_user_id,username,discord_id')
      .eq('auth_user_id', authData.user.id)
      .maybeSingle();
    if (accountError) throw accountError;
    if (!account) return reply({ error: 'Profilul contului nu există încă. Reîncearcă înregistrarea.' }, 404);
    if (account.discord_id && String(account.discord_id) !== discordId) {
      return reply({ error: 'Acest cont email este deja conectat la alt cont Discord.' }, 409);
    }

    const { data: conflict, error: conflictError } = await db
      .from('user_accounts')
      .select('auth_user_id')
      .eq('discord_id', discordId)
      .neq('auth_user_id', authData.user.id)
      .maybeSingle();
    if (conflictError) throw conflictError;
    if (conflict) return reply({ error: 'Contul Discord este deja conectat la alt cont email.' }, 409);

    const { error: updateError } = await db
      .from('user_accounts')
      .update({ discord_id: discordId, updated_at: new Date().toISOString() })
      .eq('auth_user_id', authData.user.id);
    if (updateError) {
      // Protecția UNIQUE pe discord_id rămâne ultima linie de apărare și în
      // cazul a două încercări simultane de conectare.
      if (String((updateError as any).code || '') === '23505') {
        return reply({ error: 'Contul Discord este deja conectat la alt cont email.' }, 409);
      }
      throw updateError;
    }

    return reply({ ok: true, auth_user_id: authData.user.id, discord_id: discordId, username: account.username });
  } catch (error) {
    console.error(error);
    return reply({ error: error instanceof Error ? error.message : 'Conectarea Discord a eșuat.' }, 500);
  }
});
