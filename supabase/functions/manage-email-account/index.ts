import { createClient } from 'jsr:@supabase/supabase-js@2';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-panel-session',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers });

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers });
  if (request.method !== 'POST') return reply({ error: 'MetodÄƒ invalidÄƒ.' }, 405);

  try {
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ||
      JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default;
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const jwt = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || '').trim();

    if (!serviceKey || !supabaseUrl) throw new Error('ConfiguraÈ›ia serverului lipseÈ™te.');
    if (!jwt) return reply({ error: 'Sesiunea contului lipseÈ™te sau a expirat.' }, 401);
    if (!['disconnect_discord', 'clear_data', 'revoke_sessions', 'delete_account'].includes(action)) {
      return reply({ error: 'AcÈ›iunea contului este invalidÄƒ.' }, 400);
    }

    const db = createClient(supabaseUrl, serviceKey);
    const { data: authData, error: authError } = await db.auth.getUser(jwt);
    if (authError || !authData.user) return reply({ error: 'Sesiunea contului nu este validÄƒ.' }, 401);
    if (!authData.user.email_confirmed_at) return reply({ error: 'ConfirmÄƒ mai Ã®ntÃ¢i adresa de email.' }, 403);

    const { data: account, error: accountError } = await db
      .from('user_accounts')
      .select('auth_user_id,discord_id')
      .eq('auth_user_id', authData.user.id)
      .maybeSingle();
    if (accountError) throw accountError;
    if (!account) return reply({ error: 'Profilul contului nu existÄƒ.' }, 404);

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
      return reply({ ok: true, action, message: action === 'clear_data' ? 'Datele opÈ›ionale au fost È™terse.' : 'LegÄƒtura Discord a fost eliminatÄƒ.' });
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
    return reply({ error: error instanceof Error ? error.message : 'Setarea contului nu a putut fi aplicatÄƒ.' }, 500);
  }
});
