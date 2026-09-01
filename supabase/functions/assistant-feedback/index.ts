import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { requirePanelSession } from '../_shared/panel-session.ts';

const headers = {
  'Access-Control-Allow-Origin': 'https://panel-pro.ro',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-panel-session',
  'Access-Control-Max-Age': '86400',
  'Content-Type': 'application/json'
};
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers });
const db = createClient(String(Deno.env.get('SUPABASE_URL')), String(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')));

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers });
  if (request.method !== 'POST') return reply({ error: 'Metodă invalidă.' }, 405);
  try {
    const session = await requirePanelSession(db, request, 0);
    const body = await request.json();
    const question = String(body?.question || '').trim().slice(0, 500);
    const answer = String(body?.answer || '').trim().slice(0, 3000);
    const page = String(body?.page || '').trim().split('?')[0].split('#')[0].slice(0, 120);
    if (question.length < 2 || answer.length < 2) return reply({ error: 'Feedback incomplet.' }, 400);
    const { data: setting, error: readError } = await db.from('app_settings').select('value').eq('organization_id', session.organization_id).eq('key', 'assistant_feedback').maybeSingle();
    if (readError) throw readError;
    const feedback = Array.isArray(setting?.value) ? setting.value : [];
    feedback.push({ discord_id: session.discord_id, question, answer, helpful: body?.helpful === true, page, created_at: new Date().toISOString() });
    const { error } = await db.from('app_settings').upsert({ organization_id: session.organization_id, key: 'assistant_feedback', value: feedback.slice(-500), updated_at: new Date().toISOString() }, { onConflict: 'organization_id,key' });
    if (error) throw error;
    return reply({ ok: true });
  } catch (error) {
    return reply({ error: error instanceof Error ? error.message : 'Feedbackul nu a putut fi salvat.' }, 400);
  }
});
