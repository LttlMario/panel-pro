import { createClient } from 'jsr:@supabase/supabase-js@2';
import { requirePanelSession } from '../_shared/panel-session.ts';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-panel-session',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Content-Type': 'application/json',
};
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers });

function elapsed(shift: any, now: number) {
  const start = new Date(`${shift.date}T${shift.start_time || '00:00:00'}`).getTime();
  if (!Number.isFinite(start)) return '00:00:00';
  const seconds = Math.max(0, Math.floor((now - start) / 1000));
  return [Math.floor(seconds / 3600), Math.floor((seconds % 3600) / 60), seconds % 60]
    .map((value, index) => index === 0 ? String(value).padStart(2, '0') : String(value).padStart(2, '0')).join(':');
}

function discordUrl(value: string) {
  const parsed = new URL(value);
  if (parsed.protocol !== 'https:' || !['discord.com', 'discordapp.com'].includes(parsed.hostname) || !parsed.pathname.startsWith('/api/webhooks/')) throw new Error('Webhook Discord invalid.');
  return parsed;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers });
  if (request.method !== 'POST') return reply({ error: 'Metodă invalidă.' }, 405);
  try {
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default;
    const db = createClient(Deno.env.get('SUPABASE_URL')!, key);
    const session = await requirePanelSession(db, request, 1, true);
    const body = await request.json().catch(() => ({}));
    const requestedOrganization = String(body.organization_id || '').trim();
    if (requestedOrganization && requestedOrganization !== String(session.organization_id)) return reply({ error: 'Organizația activă nu corespunde sesiunii.' }, 403);

    const organizationId = String(session.organization_id);
    const [{ data: organization }, { data: settings }, { data: shifts, error: shiftsError }] = await Promise.all([
      db.from('organizations').select('name').eq('id', organizationId).maybeSingle(),
      db.from('organization_settings').select('webhook_routes').eq('organization_id', organizationId).maybeSingle(),
      db.from('shifts').select('*').eq('organization_id', organizationId).in('status', ['active', 'paused']).is('end_time', null),
    ]);
    if (shiftsError) throw shiftsError;

    const rows = shifts || [];
    const ids = [...new Set(rows.map((shift: any) => String(shift.discord_id || '')).filter(Boolean))];
    const { data: users } = ids.length ? await db.from('users').select('discord_id,display_name,username').in('discord_id', ids) : { data: [] };
    const names = new Map((users || []).map((user: any) => [String(user.discord_id), user.display_name || user.username || user.discord_id]));
    const active = rows.filter((shift: any) => shift.status !== 'paused');
    const paused = rows.filter((shift: any) => shift.status === 'paused');
    const now = Date.now();
    const line = (shift: any, icon: string) => `${icon} **${shift.colleague_name || names.get(String(shift.discord_id)) || 'Mecanic'}** — ${elapsed(shift, now)}`;
    const section = (title: string, items: any[], icon: string) => `${title} (${items.length})\n${items.length ? items.map((shift) => line(shift, icon)).join('\n') : '_Nimeni_'}`;
    const description = `${section('🟢 În pontaj', active, '🟢')}\n\n${section('☕ În pauză', paused, '☕')}\n\n📊 **Total:** ${rows.length}\n⏱️ **Actualizat:** <t:${Math.floor(now / 1000)}:R>`;
    const payload = { embeds: [{ title: `📡 STATUS LIVE · ${organization?.name || 'Organizație'}`, description, color: 3066993, timestamp: new Date(now).toISOString(), footer: { text: 'Panel · actualizare live' } }] };
    const route = settings?.webhook_routes?.status_live || {};
    const requestedIds = body.message_ids && typeof body.message_ids === 'object' ? body.message_ids : {};
    const messageIds: Record<string, string> = {};

    for (const target of ['primary', 'secondary']) {
      const configured = route[target];
      if (!configured?.enabled || !configured.url) continue;
      const webhook = discordUrl(String(configured.url));
      const existingId = String(requestedIds[target] || '');
      let response: Response;
      if (existingId && /^\d{15,22}$/.test(existingId)) {
        response = await fetch(`${webhook.origin}${webhook.pathname}/messages/${existingId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      } else {
        webhook.searchParams.set('wait', 'true');
        response = await fetch(webhook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      }
      if (response.status === 404 && existingId) {
        webhook.searchParams.set('wait', 'true');
        response = await fetch(webhook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      }
      if (!response.ok) throw new Error(`Discord a răspuns cu HTTP ${response.status}.`);
      const data = await response.json().catch(() => ({}));
      if (data.id) messageIds[target] = String(data.id); else if (existingId) messageIds[target] = existingId;
    }
    return reply({ ok: true, organization: organization?.name || '', active: active.length, paused: paused.length, message_ids: messageIds, updated_at: new Date(now).toISOString() });
  } catch (error) {
    console.error(error);
    return reply({ error: error instanceof Error ? error.message : 'Eroare Status Live.' }, 400);
  }
});
