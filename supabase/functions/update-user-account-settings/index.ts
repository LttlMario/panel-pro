import { createClient } from 'jsr:@supabase/supabase-js@2';

const headers = {
  'Access-Control-Allow-Origin': 'https://lttlmario.github.io',
  'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-panel-session',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

const reply = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers });

function normalizeAvatarUrl(value: unknown) {
  const avatar = String(value || '').trim();
  if (!avatar) return null;
  if (avatar.length > 500) throw new Error('Linkul pozei este prea lung.');

  let parsed: URL;
  try {
    parsed = new URL(avatar);
  } catch {
    throw new Error('Linkul pozei nu este valid.');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Poza trebuie să folosească un link HTTP sau HTTPS.');
  }
  return parsed.toString();
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers });
  if (request.method !== 'POST') return reply({ error: 'Metodă invalidă.' }, 405);

  try {
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ||
      JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default;
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const authorization = request.headers.get('authorization') || '';
    const jwt = authorization.replace(/^Bearer\s+/i, '').trim();

    if (!serviceKey || !supabaseUrl) throw new Error('Configurația Supabase lipsește.');
    if (!jwt) return reply({ error: 'Sesiunea contului lipsește sau a expirat.' }, 401);

    const body = await request.json().catch(() => ({}));
    const avatarUrl = normalizeAvatarUrl(body.avatar_url);
    const db = createClient(supabaseUrl, serviceKey);
    const { data: authData, error: authError } = await db.auth.getUser(jwt);
    if (authError || !authData.user) return reply({ error: 'Sesiunea contului nu este validă.' }, 401);

    const requestIp = String(request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'unknown')
      .split(',')[0].trim().slice(0, 120);
    const { data: updateAllowed, error: updateRateError } = await db.rpc('consume_panel_rate_limit', {
      p_key: `email-profile-update:${authData.user.id}:${requestIp}`,
      p_limit: 30,
      p_window_seconds: 900,
    });
    if (updateRateError) {
      console.error('Email profile update rate-limit unavailable:', updateRateError.message);
      return reply({ error: 'Protecția anti-abuz este temporar indisponibilă. Încearcă din nou în câteva minute.' }, 503);
    }
    if (updateAllowed === false) return reply({ error: 'Prea multe modificări de profil. Așteaptă câteva minute și încearcă din nou.' }, 429);

    const { data: account, error } = await db
      .from('user_accounts')
      .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
      .eq('auth_user_id', authData.user.id)
      .select('username,avatar_url,discord_id')
      .maybeSingle();

    if (error) throw error;
    if (!account) return reply({ error: 'Profilul contului nu a fost găsit.' }, 404);
    return reply({ ok: true, account });
  } catch (error) {
    console.error(error);
    return reply({ error: error instanceof Error ? error.message : 'Setarea nu a putut fi salvată.' }, 500);
  }
});
