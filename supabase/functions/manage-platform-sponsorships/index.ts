import { createClient } from 'jsr:@supabase/supabase-js@2.112.3';
import { requirePanelSession } from '../_shared/panel-session.ts';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-panel-session',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers });
const key = () => Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default;
const db = () => createClient(Deno.env.get('SUPABASE_URL')!, key(), { auth: { persistSession: false } });
const sizes = new Set(['small', 'medium', 'large', 'wide', 'leaderboard']);
const placements = new Set(['top', 'dashboard', 'footer', 'sidebar']);

function clean(body: any) {
  const startsAt = new Date(String(body.starts_at || '')).toISOString();
  const endsAt = body.ends_at ? new Date(String(body.ends_at)).toISOString() : null;
  if (endsAt && Date.parse(endsAt) <= Date.parse(startsAt)) throw new Error('Data expirării trebuie să fie după data începerii.');
  const pages = Array.isArray(body.pages) ? body.pages.map(String).map((x: string) => x.trim()).filter(Boolean).slice(0, 40) : ['*'];
  return {
    sponsor_name: String(body.sponsor_name || '').trim().slice(0, 120),
    title: String(body.title || '').trim().slice(0, 160),
    image_url: String(body.image_url || '').trim().slice(0, 1000),
    target_url: String(body.target_url || '').trim().slice(0, 1000),
    size: sizes.has(String(body.size)) ? String(body.size) : 'medium',
    placement: placements.has(String(body.placement)) ? String(body.placement) : 'footer',
    pages: pages.length ? pages : ['*'], starts_at: startsAt, ends_at: endsAt,
    priority: Math.max(0, Math.min(9999, Number(body.priority) || 100)), active: body.active !== false,
  };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers });
  try {
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || 'active');
    const client = db();
    if (action === 'active') {
      const page = String(body.page || '').trim();
      const now = new Date().toISOString();
      const { data, error } = await client.from('platform_sponsorships').select('id,sponsor_name,title,image_url,target_url,size,placement,pages,starts_at,ends_at,priority').eq('active', true).lte('starts_at', now).or(`ends_at.is.null,ends_at.gt.${now}`).order('priority', { ascending: true }).limit(30);
      if (error) throw error;
      const matches = (data || []).filter((item: any) => Array.isArray(item.pages) && (item.pages.includes('*') || item.pages.includes(page) || item.pages.includes(page.replace(/^\//, ''))));
      return reply({ sponsorships: matches.slice(0, 3) });
    }
    if (action === 'track') {
      const metric = String(body.metric || '');
      if (!['click', 'impression'].includes(metric)) return reply({ error: 'Metrică invalidă.' }, 400);
      const { error } = await client.rpc('increment_platform_sponsorship_metric', { sponsorship_id: String(body.id), metric });
      if (error) throw error;
      return reply({ ok: true });
    }
    const session = await requirePanelSession(client, request, 0);
    if (!session.is_platform_admin) return reply({ error: 'Acces permis doar administratorului global.' }, 403);
    if (action === 'list') {
      const { data, error } = await client.from('platform_sponsorships').select('*').order('active', { ascending: false }).order('priority').order('created_at', { ascending: false });
      if (error) throw error; return reply({ sponsorships: data || [] });
    }
    if (action === 'save') {
      const item = clean(body); if (item.sponsor_name.length < 2 || item.title.length < 2 || !/^https?:\/\//i.test(item.image_url) || !/^https?:\/\//i.test(item.target_url)) throw new Error('Completează sponsorul, titlul și adresele valide pentru imagine și link.');
      const payload = { ...item, ...(body.id ? { id: String(body.id) } : {}), updated_by_discord_id: session.discord_id, created_by_discord_id: session.discord_id, updated_at: new Date().toISOString() };
      const { data, error } = await client.from('platform_sponsorships').upsert(payload).select('*').single(); if (error) throw error; return reply({ sponsorship: data });
    }
    if (action === 'delete') { const { error } = await client.from('platform_sponsorships').delete().eq('id', String(body.id)); if (error) throw error; return reply({ ok: true }); }
    if (action === 'toggle') { const { data, error } = await client.from('platform_sponsorships').update({ active: body.active === true, updated_by_discord_id: session.discord_id, updated_at: new Date().toISOString() }).eq('id', String(body.id)).select('id,active').single(); if (error) throw error; return reply({ sponsorship: data }); }
    return reply({ error: 'Acțiune necunoscută.' }, 400);
  } catch (error) { return reply({ error: error instanceof Error ? error.message : 'Eroare internă.' }, 400); }
});
