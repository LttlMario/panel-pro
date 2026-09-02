import { createClient } from 'jsr:@supabase/supabase-js@2.112.3';
import { corsOptions, getCorsHeaders } from '../_shared/cors.ts';

const buildReply = (data: unknown, status = 200, headers = getCorsHeaders(new Request('https://panel-pro.ro'))) => new Response(JSON.stringify(data), { status, headers });

Deno.serve(async (request) => {
  const headers = getCorsHeaders(request);
  const reply = (data: unknown, status = 200) => buildReply(data, status, headers);
  if (request.method === 'OPTIONS') return corsOptions(request);
  if (request.method !== 'POST') return reply({ error: 'Metodă invalidă.' }, 405);

  try {
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ||
      JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default;
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const jwt = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || '').trim();

    if (!serviceKey || !supabaseUrl) throw new Error('Configurația serverului lipsește.');
    if (!jwt) return reply({ error: 'Sesiunea contului lipsește sau a expirat.' }, 401);
    if (!['get_account', 'disconnect_discord', 'clear_data', 'revoke_sessions', 'delete_account'].includes(action)) {
      return reply({ error: 'Acțiunea contului este invalidă.' }, 400);
    }

    const db = createClient(supabaseUrl, serviceKey);
    const { data: authData, error: authError } = await db.auth.getUser(jwt);
    if (authError || !authData.user) return reply({ error: 'Sesiunea contului nu este validă.' }, 401);
    if (!authData.user.email_confirmed_at) return reply({ error: 'Confirmă mai întâi adresa de email.' }, 403);

    const requestIp = String(request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'unknown')
      .split(',')[0].trim().slice(0, 120);
    const { data: accountActionAllowed, error: accountRateError } = await db.rpc('consume_panel_rate_limit', {
      p_key: `email-account:${authData.user.id}:${requestIp}`,
      p_limit: 30,
      p_window_seconds: 900,
    });
    if (accountRateError) {
      console.error('Email account rate-limit unavailable:', accountRateError.message);
      return reply({ error: 'Protecția anti-abuz este temporar indisponibilă. Încearcă din nou în câteva minute.' }, 503);
    }
    if (accountActionAllowed === false) return reply({ error: 'Prea multe acțiuni asupra contului. Așteaptă câteva minute și încearcă din nou.' }, 429);

    const { data: account, error: accountError } = await db
      .from('user_accounts')
      .select('auth_user_id,discord_id')
      .eq('auth_user_id', authData.user.id)
      .maybeSingle();
    if (accountError) throw accountError;
    if (!account) return reply({ error: 'Profilul contului nu există.' }, 404);

    if (action === 'get_account') {
      const { data: profile, error: profileError } = await db
        .from('user_accounts')
        .select('username,avatar_url,discord_id,discord_guild_id,terms_version,terms_accepted_at')
        .eq('auth_user_id', authData.user.id)
        .maybeSingle();
      if (profileError) throw profileError;
      return reply({ ok: true, account: profile ? { ...profile, auth_user_id: authData.user.id, email: authData.user.email } : null });
    }

    const discordId = String(account.discord_id || '').trim();
    if (discordId) {
      await db.from('panel_sessions').delete().eq('discord_id', discordId);
    }

    if (action === 'disconnect_discord' || action === 'clear_data') {
      const update = action === 'clear_data'
        ? { discord_id: null, discord_guild_id: null, avatar_url: null, updated_at: new Date().toISOString() }
        : { discord_id: null, discord_guild_id: null, updated_at: new Date().toISOString() };
      const { error } = await db.from('user_accounts').update(update).eq('auth_user_id', authData.user.id);
      if (error) throw error;
      return reply({ ok: true, action, message: action === 'clear_data' ? 'Datele opționale au fost șterse.' : 'Legătura Discord a fost eliminată.' });
    }

    if (action === 'revoke_sessions') {
      const { error } = await db.auth.admin.signOut(authData.user.id, 'others');
      if (error) throw error;
      return reply({ ok: true, action, message: 'Celelalte sesiuni au fost revocate.' });
    }

    const { error: deleteAccountError } = await db.auth.admin.deleteUser(authData.user.id);
    if (deleteAccountError) throw deleteAccountError;
    return reply({ ok: true, action, deleted: true });
  } catch (error) {
    console.error(error);
    return reply({ error: error instanceof Error ? error.message : 'Setarea contului nu a putut fi aplicată.' }, 500);
  }
});
