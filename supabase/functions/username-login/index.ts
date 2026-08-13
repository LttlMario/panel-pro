import { createClient } from 'jsr:@supabase/supabase-js@2';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'apikey,authorization,content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

const reply = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers });

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers });
  if (request.method !== 'POST') return reply({ error: 'Metodă invalidă.' }, 405);

  try {
    const body = await request.json().catch(() => ({}));
    const username = String(body.username || '').trim().toLowerCase();
    const password = String(body.password || '');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ||
      JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');

    if (!serviceKey || !anonKey || !supabaseUrl) throw new Error('Configurația Supabase lipsește.');
    if (!/^[a-z0-9][a-z0-9_.-]{2,31}$/.test(username) || password.length < 8) {
      return reply({ error: 'Usernameul sau parola sunt incorecte.' }, 401);
    }

    const db = createClient(supabaseUrl, serviceKey);
    const { data: account, error: accountError } = await db
      .from('user_accounts')
      .select('auth_user_id')
      .eq('username', username)
      .maybeSingle();
    if (accountError) throw accountError;
    if (!account) return reply({ error: 'Usernameul sau parola sunt incorecte.' }, 401);

    const { data: authData, error: authError } = await db.auth.admin.getUserById(account.auth_user_id);
    const email = authData.user?.email;
    if (authError || !email) return reply({ error: 'Usernameul sau parola sunt incorecte.' }, 401);

    const tokenResponse = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const tokenResult = await tokenResponse.json().catch(() => ({}));
    if (!tokenResponse.ok) {
      const description = String(tokenResult.error_description || '').toLowerCase();
      if (description.includes('email not confirmed')) {
        return reply({ error: 'Confirmă adresa de email înainte de autentificare.', code: 'EMAIL_NOT_CONFIRMED' }, 403);
      }
      return reply({ error: 'Usernameul sau parola sunt incorecte.' }, 401);
    }

    return reply({
      access_token: tokenResult.access_token,
      refresh_token: tokenResult.refresh_token,
      expires_in: tokenResult.expires_in,
      token_type: tokenResult.token_type,
    });
  } catch (error) {
    return reply({ error: error instanceof Error ? error.message : 'Autentificarea a eșuat.' }, 500);
  }
});
