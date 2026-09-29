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

const DISCORD_API = 'https://discord.com/api/v10';
const WHEEL_DURATION_MS = 6 * 60 * 60 * 1000;

async function notifyDiscord(db: any, discordId: string, content: string) {
  const token = await getPlatformSecret(db, 'discord_bot_token');
  if (!token) throw new Error('Tokenul botului Discord lipsește.');
  if (!/^\d{15,22}$/.test(discordId)) throw new Error('ID-ul Discord al utilizatorului este invalid.');
  const headers = { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' };
  const channelResponse = await fetch(`${DISCORD_API}/users/@me/channels`, {
    method: 'POST', headers, body: JSON.stringify({ recipient_id: discordId }),
  });
  const channel = await channelResponse.json().catch(() => ({}));
  if (!channelResponse.ok || !channel?.id) {
    const details = String(channel?.message || '').trim();
    throw new Error(`Discord nu a putut deschide mesajul privat (HTTP ${channelResponse.status}${details ? `: ${details}` : ''}).`);
  }
  const messageResponse = await fetch(`${DISCORD_API}/channels/${channel.id}/messages`, {
    method: 'POST', headers, body: JSON.stringify({ allowed_mentions: { parse: [] }, content }),
  });
  if (!messageResponse.ok) {
    const details = await messageResponse.clone().json().catch(() => ({}));
    const message = String(details?.message || '').trim();
    throw new Error(`Discord nu a putut trimite mesajul privat (HTTP ${messageResponse.status}${message ? `: ${message}` : ''}).`);
  }
  return true;
}

async function processDueTimers(db: any, discordId?: string, organizationId?: string) {
  const now = new Date();
  const nowIso = now.toISOString();
  const staleClaimIso = new Date(now.getTime() - 10 * 60 * 1000).toISOString();
  let query = db.from('wheel_timers')
    .select('id,organization_id,discord_id,completes_at,completed_at,status,notification_claimed_at,notification_sent_at,notification_attempts,notification_next_attempt_at')
    .or(`and(status.eq.active,completes_at.lte.${now.toISOString()}),and(status.eq.completed,notification_sent_at.is.null)`)
    .order('completes_at', { ascending: true })
    .limit(100);
  if (discordId) query = query.eq('discord_id', discordId);
  if (organizationId) query = query.eq('organization_id', organizationId);
  const { data: timers, error } = await query;
  if (error) throw error;
  const results = [];
  for (const timer of timers || []) {
    if (Number(timer.notification_attempts || 0) >= 3 && !timer.notification_sent_at) continue;
    const nextAttemptAt = timer.notification_next_attempt_at ? Date.parse(String(timer.notification_next_attempt_at)) : NaN;
    if (Number.isFinite(nextAttemptAt) && nextAttemptAt > now.getTime()) continue;
    const claimedAt = timer.notification_claimed_at ? Date.parse(String(timer.notification_claimed_at)) : NaN;
    if (Number.isFinite(claimedAt) && claimedAt > now.getTime() - 10 * 60 * 1000) continue;
    const nextAttempt = Number(timer.notification_attempts || 0) + 1;
    const claim = await db.from('wheel_timers').update({
      status: 'completed',
      completed_at: timer.completed_at || nowIso,
      notification_claimed_at: nowIso,
      notification_attempts: nextAttempt,
      notification_next_attempt_at: new Date(now.getTime() + 10 * 60 * 1000).toISOString(),
    }).eq('id', timer.id).is('notification_sent_at', null)
      .or(`notification_claimed_at.is.null,notification_claimed_at.lt.${staleClaimIso}`)
      .select('id').maybeSingle();
    if (claim.error || !claim.data) continue;
    const message = '🎡 Au trecut cele 6 ore de la roată. Poți apăsa din nou „Am dat la roată” din dashboard.';
    let notificationError = '';
    let discordSent = false;
    try { discordSent = await notifyDiscord(db, String(timer.discord_id), message); } catch (error) { notificationError = error instanceof Error ? error.message : 'Notificarea Discord a eșuat.'; }
    try {
      const { data: existingWebNotification, error: readWebError } = await db.from('panel_notifications').select('id')
        .eq('organization_id', timer.organization_id)
        .eq('notification_type', 'wheel_timer')
        .eq('recipient_discord_id', timer.discord_id)
        .contains('metadata', { wheel_timer_id: timer.id })
        .limit(1).maybeSingle();
      if (readWebError) notificationError = [notificationError, readWebError.message].filter(Boolean).join(' | ');
      if (!readWebError && !existingWebNotification) {
        const { error: webError } = await db.from('panel_notifications').insert({
          organization_id: timer.organization_id,
          title: 'Timer roată finalizat',
          message,
          level: 'success',
          notification_type: 'wheel_timer',
          recipient_discord_id: timer.discord_id,
          metadata: { wheel_timer_id: timer.id },
        });
        if (webError) notificationError = [notificationError, webError.message].filter(Boolean).join(' | ');
      }
    } catch (error) { notificationError = [notificationError, error instanceof Error ? error.message : 'Notificarea web a eșuat.'].filter(Boolean).join(' | '); }
    const { error: updateError } = await db.from('wheel_timers').update({
      status: 'completed', completed_at: timer.completed_at || nowIso,
      notification_sent_at: discordSent ? nowIso : null,
      notification_claimed_at: null,
      notification_next_attempt_at: discordSent ? null : new Date(now.getTime() + 10 * 60 * 1000).toISOString(),
      notification_error: notificationError || null,
    }).eq('id', timer.id);
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
    const suppliedCronSecret = String(request.headers.get('x-cron-secret') || '').trim();
    const configuredCronSecret = await getPlatformSecret(db, 'cron_secret');
    if (suppliedCronSecret && configuredCronSecret && suppliedCronSecret === configuredCronSecret && String(body.action || '') === 'process') {
      return new Response(JSON.stringify({ ok: true, processed: await processDueTimers(db) }), { status: 200, headers });
    }
    const session = await requirePanelSession(db, request);
    const action = String(body.action || 'status');
    // Finalizează imediat timerul expirat al utilizatorului. Nu depindem de
    // următoarea rulare cron pentru deblocarea butonului după cele 6 ore.
    if (action === 'start' || action === 'status') {
      await processDueTimers(db, session.discord_id, session.organization_id);
    }
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
