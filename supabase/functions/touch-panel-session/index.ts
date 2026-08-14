import { createClient } from 'jsr:@supabase/supabase-js@2';

const headers = {
  'Access-Control-Allow-Origin': 'https://lttlmario.github.io',
  'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-panel-session',
  'Content-Type': 'application/json',
};

const reply = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers });

const serviceKey = () =>
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ||
  JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}').default;

const sha256 = async (value: string) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(value)
      )
    )
  )
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers });
  if (request.method !== 'POST') return reply({ error: 'Metodă invalidă.' }, 405);

  try {
    const token = String(request.headers.get('x-panel-session') || '').trim();
    const key = serviceKey();
    if (!token) return reply({ error: 'Sesiunea lipsește.' }, 401);
    if (!key) throw new Error('Cheia secretă Supabase lipsește.');

    const db = createClient(Deno.env.get('SUPABASE_URL')!, key);
    const tokenHash = await sha256(token);
    const now = new Date().toISOString();

    const { data, error } = await db
      .from('panel_sessions')
      .update({ last_seen_at: now })
      .eq('token_hash', tokenHash)
      .is('revoked_at', null)
      .gt('expires_at', now)
      .select('discord_id,organization_id,last_seen_at')
      .maybeSingle();

    if (error) throw error;
    if (!data) return reply({ error: 'Sesiunea a expirat sau a fost revocată.' }, 401);

    return reply({ ok: true, last_seen_at: data.last_seen_at });
  } catch (error) {
    return reply({ error: error instanceof Error ? error.message : 'Eroare necunoscută.' }, 500);
  }
});
