import { createClient } from 'jsr:@supabase/supabase-js@2.112.3';
import { requirePanelSession } from '../_shared/panel-session.ts';

const headers = {
  'Access-Control-Allow-Origin': 'https://lttlmario.github.io',
  'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-panel-session',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Content-Type': 'application/json',
};
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers });

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers });
  if (request.method !== 'POST') return reply({ error: 'Metodă invalidă.' }, 405);

  try {
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}').default;
    if (!key) return reply({ error: 'Cheia secretă Supabase lipsește.' }, 500);

    const db = createClient(Deno.env.get('SUPABASE_URL')!, key);
    const session = await requirePanelSession(db, request, 0);

    const { data, error } = await db
      .from('users')
      .update({ tutorial_read: true, updated_at: new Date().toISOString() })
      .eq('discord_id', session.discord_id)
      .select('discord_id,tutorial_read')
      .maybeSingle();

    if (error) throw error;
    if (!data) return reply({ error: 'Utilizatorul nu există în panel.' }, 404);

    return reply({ ok: true, tutorial_read: data.tutorial_read === true });
  } catch (error) {
    return reply({
      error: error instanceof Error ? error.message : 'Tutorialul nu a putut fi salvat.'
    }, 500);
  }
});
