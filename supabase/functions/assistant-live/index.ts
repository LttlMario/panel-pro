import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { requirePanelSession } from '../_shared/panel-session.ts';

const headers = {
  'Access-Control-Allow-Origin': 'https://panel-pro.ro',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-panel-session',
  'Access-Control-Max-Age': '86400',
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store'
};
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers });

const db = createClient(String(Deno.env.get('SUPABASE_URL')), String(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')));
const blockedPages = new Set(['admin.html', 'logs.html', 'diagnostic.html', 'secrete-platforma.html', 'setari-platforma.html', 'discord-configurare.html', 'organizatii.html', 'vouchere.html', 'developer.html', 'administrare-organizatie.html']);

async function canManageAssistantFeedback(session: any) {
  if (session.is_platform_admin) return true;
  const { data: member } = await db.from('organization_members')
    .select('panel_role,permission_level,active')
    .eq('organization_id', session.organization_id)
    .eq('discord_id', session.discord_id)
    .eq('active', true)
    .maybeSingle();
  const role = String(member?.panel_role || '').trim().toLocaleLowerCase('ro-RO');
  return Number(member?.permission_level || 0) >= 90
    || new Set(['owner', 'administrator', 'administrator organizație', 'administrator organizatie', 'admin']).has(role);
}

async function allowedPages(session: any) {
  if (session.is_platform_admin) return new Set(['*']);
  const [{ data: regular }, { data: assistant }] = await Promise.all([
    db.from('app_settings').select('value').eq('organization_id', session.organization_id).eq('key', 'page_permissions').maybeSingle(),
    db.from('app_settings').select('value').eq('organization_id', session.organization_id).eq('key', 'assistant_page_permissions').maybeSingle()
  ]);
  const rules = assistant?.value && typeof assistant.value === 'object' && Object.keys(assistant.value).length ? assistant.value : regular?.value;
  const roles = new Set((session.discord_role_ids || []).map(String));
  const pages = new Set<string>();
  Object.entries(rules && typeof rules === 'object' ? rules : {}).forEach(([page, ids]: any) => {
    if (!blockedPages.has(page) && Array.isArray(ids) && ids.some((id: any) => roles.has(String(id)))) pages.add(page);
  });
  if (roles.size) { pages.add('index.html'); pages.add('pontaj.html'); }
  return pages;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers });
  if (request.method !== 'GET') return reply({ error: 'Metodă invalidă.' }, 405);
  try {
    const session = await requirePanelSession(db, request, 0);
    const mode = new URL(request.url).searchParams.get('mode') || 'knowledge';
    const pages = await allowedPages(session);
    if (mode === 'knowledge') {
      const { data, error } = await db.from('app_settings').select('value').eq('organization_id', session.organization_id).eq('key', 'assistant_knowledge').maybeSingle();
      if (error) throw error;
      const entries = Array.isArray(data?.value) ? data.value.filter((item: any) => item?.enabled !== false && (!item.page || pages.has(String(item.page)) || pages.has('*'))) : [];
      return reply({ entries });
    }
    if (mode === 'shifts') {
      if (!pages.has('status-live.html') && !pages.has('rapoarte.html') && !pages.has('*')) return reply({ error: 'Nu ai permisiunea pentru pontaje live.' }, 403);
      const { data, error } = await db.from('shifts').select('discord_id,colleague_name,status,shift_type,date,start_time,started_at,paused_at').eq('organization_id', session.organization_id).in('status', ['active', 'paused']).is('end_time', null).order('started_at', { ascending: true });
      if (error) throw error;
      return reply({ shifts: (data || []).map((item: any) => ({ discord_id: String(item.discord_id || ''), colleague_name: String(item.colleague_name || ''), status: String(item.status || ''), shift_type: String(item.shift_type || ''), date: item.date, start_time: item.start_time, started_at: item.started_at, paused_at: item.paused_at })) });
    }
    if (mode === 'feedback') {
      if (!await canManageAssistantFeedback(session)) return reply({ error: 'Feedbackul este disponibil doar ownerului sau administratorului organizației.' }, 403);
      const { data: setting, error } = await db.from('app_settings').select('value').eq('organization_id', session.organization_id).eq('key', 'assistant_feedback').maybeSingle();
      if (error) throw error;
      const rows = Array.isArray(setting?.value) ? setting.value.slice(-500).reverse() : [];
      const ids = [...new Set(rows.map((item: any) => String(item?.discord_id || '')).filter(Boolean))];
      const { data: users } = ids.length ? await db.from('users').select('discord_id,display_name,username').in('discord_id', ids) : { data: [] };
      const names = new Map((users || []).map((user: any) => [String(user.discord_id), String(user.display_name || user.username || user.discord_id)]));
      return reply({
        feedback: rows.map((item: any) => ({
          discord_id: String(item?.discord_id || ''),
          author: names.get(String(item?.discord_id || '')) || String(item?.discord_id || 'Utilizator'),
          question: String(item?.question || ''),
          answer: String(item?.answer || ''),
          helpful: item?.helpful === true,
          page: String(item?.page || ''),
          created_at: item?.created_at || null
        }))
      });
    }
    return reply({ error: 'Mod live necunoscut.' }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Sesiune invalidă.';
    return reply({ error: message }, /permisiune|Acces refuzat/i.test(message) ? 403 : 401);
  }
});
