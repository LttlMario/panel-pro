import { createClient } from 'jsr:@supabase/supabase-js@2';
import { requirePanelSession } from '../_shared/panel-session.ts';

const headers = {
  'Access-Control-Allow-Origin': 'https://lttlmario.github.io',
  'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-panel-session',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers });

function normalizeAvatarUrl(value: unknown) {
  const avatarUrl = String(value || '').trim();
  if (!avatarUrl) return null;
  if (avatarUrl.length > 500 || !/^https?:\/\//i.test(avatarUrl)) throw new Error('Poza trebuie să fie un link http:// sau https:// de maximum 500 de caractere.');
  return avatarUrl;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers });
  if (request.method !== 'POST') return reply({ error: 'Metodă invalidă.' }, 405);

  try {
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default;
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    if (!serviceKey || !supabaseUrl) throw new Error('Configurația serverului lipsește.');

    const db = createClient(supabaseUrl, serviceKey);
    let session;
    try {
      session = await requirePanelSession(db, request);
    } catch (error) {
      return reply({ error: error instanceof Error ? error.message : 'Sesiunea Discord nu este validă.' }, 401);
    }

    const requestIp = String(request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'unknown')
      .split(',')[0].trim().slice(0, 120);
    const { data: accountActionAllowed, error: accountRateError } = await db.rpc('consume_panel_rate_limit', {
      p_key: `discord-account:${session.discord_id}:${requestIp}`,
      p_limit: 30,
      p_window_seconds: 900,
    });
    if (accountRateError) {
      console.error('Discord account rate-limit unavailable:', accountRateError.message);
      return reply({ error: 'Protecția anti-abuz este temporar indisponibilă. Încearcă din nou în câteva minute.' }, 503);
    }
    if (accountActionAllowed === false) return reply({ error: 'Prea multe acțiuni asupra contului. Așteaptă câteva minute și încearcă din nou.' }, 429);

    const body = await request.json().catch(() => ({}));
    const action = String(body.action || 'get_account').trim();
    if (!['get_account', 'update_avatar', 'revoke_sessions'].includes(action)) {
      return reply({ error: 'Acțiunea contului este invalidă.' }, 400);
    }

    const { data: account, error: accountError } = await db
      .from('users')
      .select('discord_id,username,display_name,avatar,avatar_url,role,default_role')
      .eq('discord_id', session.discord_id)
      .maybeSingle();
    if (accountError) throw accountError;
    if (!account) return reply({ error: 'Profilul Discord nu există încă în panel.' }, 404);

    if (action === 'get_account') return reply({ ok: true, mode: 'discord', account });

    if (action === 'update_avatar') {
      const avatarUrl = normalizeAvatarUrl(body.avatar_url);
      const { data: updated, error: updateError } = await db
        .from('users')
        .update({ avatar: avatarUrl, avatar_url: avatarUrl, updated_at: new Date().toISOString() })
        .eq('discord_id', session.discord_id)
        .select('discord_id,username,display_name,avatar,avatar_url,role,default_role')
        .single();
      if (updateError) throw updateError;
      return reply({ ok: true, mode: 'discord', account: updated, message: 'Poza de profil a fost salvată.' });
    }

    const { error: revokeError } = await db.from('panel_sessions').delete().eq('discord_id', session.discord_id);
    if (revokeError) throw revokeError;
    return reply({ ok: true, mode: 'discord', action, message: 'Sesiunile Discord au fost revocate. Autentifică-te din nou.' });
  } catch (error) {
    console.error(error);
    return reply({ error: error instanceof Error ? error.message : 'Setarea contului nu a putut fi aplicată.' }, 500);
  }
});
