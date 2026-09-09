import { createClient } from 'jsr:@supabase/supabase-js@2.112.3';
import { getPlatformSecret } from '../_shared/platform-secrets.ts';
import { requirePanelSession } from '../_shared/panel-session.ts';
import { corsOptions, getCorsHeaders } from '../_shared/cors.ts';

const reply = (request: Request, data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: getCorsHeaders(request) });

const serviceKey = () => {
  const direct = String(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '').trim();
  if (direct) return direct;
  try { return String(JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default || '').trim(); } catch (_) { return ''; }
};

const cronSecret = () => String(Deno.env.get('CRON_SECRET') || '').trim();
const DISCORD_API = 'https://discord.com/api/v10';
const WHEEL_DURATION_MS = 6 * 60 * 60 * 1000;

async function notifyDiscord(db: any, discordId: string, content: string) {
  const token = await getPlatformSecret(db, 'discord_bot_token');
  if (!token || !/^\d{15,22}$/.test(discordId)) return false;
  const headers = { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' };
  const channelResponse = await fetch(`${DISCORD_API}/users/@me/channels`, {
    method: 'POST', headers, body: JSON.stringify({ recipient_id: discordId }),
  });
  const channel = await channelResponse.json().catch(() => ({}));
  if (!channelResponse.ok || !channel?.id) return false;
  const messageResponse = await fetch(`${DISCORD_API}/channels/${channel.id}/messages`, {
    method: 'POST', headers, body: JSON.stringify({ allowed_mentions: { parse: [] }, content }),
  });
  return messageResponse.ok;
}

async function processDueTimers(db: any) {
  const now = new Date();
  const { data: timers, error } = await db.from('wheel_timers')
    .select('id,organization_id,discord_id,completes_at')
    .eq('status', 'active')
    .lte('completes_at', now.toISOString())
    .order('completes_at', { ascending: true })
    .limit(100);
  if (error) throw error;
  const results = [];
  for (const timer of timers || []) {
    const message = '🎡 Au trecut cele 6 ore de la roată. Poți apăsa din nou „Am dat la roată” din dashboard.';
    let notificationError = '';
    let discordSent = false;
    try { discordSent = await notifyDiscord(db, String(timer.discord_id), message); } catch (error) { notificationError = error instanceof Error ? error.message : 'Notificarea Discord a eșuat.'; }
    try {
      const { error: webError } = await db.from('panel_notifications').insert({
        organization_id: timer.organization_id,
        title: 'Timer roată finalizat',
        message,
        level: 'success',
        notification_type: 'wheel_timer',
        recipient_discord_id: timer.discord_id,
      });
      if (webError) notificationError = [notificationError, webError.message].filter(Boolean).join(' | ');
    } catch (error) { notificationError = [notificationError, error instanceof Error ? error.message : 'Notificarea web a eșuat.'].filter(Boolean).join(' | '); }
    const { error: updateError } = await db.from('wheel_timers').update({
      status: 'completed', completed_at: now.toISOString(), notification_sent_at: (discordSent || !notificationError) ? now.toISOString() : null,
      notification_error: notificationError || null,
    }).eq('id', timer.id).eq('status', 'active');
    if (updateError) throw updateError;
    results.push({ id: timer.id, discord_sent: discordSent, notification_error: notificationError || null });
  }
  return results;
}

Deno.serve(async (request) => {
  const headers = getCorsHeaders(request);
  if (request.method === 'OPTIONS') return corsOptions(request);
  if (request.method !== 'POST') return reply(request, { error: 'Metodă invalidă.' }, 405);
  try {
    const key = serviceKey();
    if (!key) throw new Error('Cheia secretă Supabase lipsește.');
    const db = createClient(Deno.env.get('SUPABASE_URL')!, key);
    const body = await request.json().catch(() => ({}));
    if (String(request.headers.get('x-cron-secret') || '').trim() === cronSecret() && String(body.action || '') === 'process') {
      return new Response(JSON.stringify({ ok: true, processed: await processDueTimers(db) }), { status: 200, headers });
    }
    const session = await requirePanelSession(db, request);
    const action = String(body.action || 'status');
    if (action === 'start') {
      const { data: active, error: activeError } = await db.from('wheel_timers').select('*').eq('organization_id', session.organization_id).eq('discord_id', session.discord_id).eq('status', 'active').maybeSingle();
      if (activeError) throw activeError;
      if (active) return reply(request, { error: 'Timerul este deja activ.', timer: active }, 409);
      const started = new Date();
      const completes = new Date(started.getTime() + WHEEL_DURATION_MS);
      const { data: timer, error } = await db.from('wheel_timers').insert({ organization_id: session.organization_id, discord_id: session.discord_id, started_at: started.toISOString(), completes_at: completes.toISOString() }).select('*').single();
      if (error) throw error;
      return reply(request, { ok: true, timer });
    }
    if (action !== 'status') return reply(request, { error: 'Acțiune invalidă.' }, 400);
    const { data: timer, error } = await db.from('wheel_timers').select('*').eq('organization_id', session.organization_id).eq('discord_id', session.discord_id).eq('status', 'active').maybeSingle();
    if (error) throw error;
    return reply(request, { ok: true, timer: timer || null });
  } catch (error) {
    return reply(request, { error: error instanceof Error ? error.message : 'Operația a eșuat.' }, 500);
  }
});
