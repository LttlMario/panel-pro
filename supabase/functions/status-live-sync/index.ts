import { createClient } from 'jsr:@supabase/supabase-js@2.112.3';
import { requirePanelSession } from '../_shared/panel-session.ts';
import { getPlatformSecret } from '../_shared/platform-secrets.ts';
import { requestDiscordTarget, routeCandidates } from '../_shared/discord-delivery.ts';

const headers = {
  'Access-Control-Allow-Origin': 'https://panel-pro.ro',
  'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-panel-session,x-cron-secret',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Content-Type': 'application/json',
};
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers });

function elapsed(shift: any, now: number) {
  let seconds = 0;

  if (shift.status === 'paused') {
    seconds = Math.max(
      0,
      Math.floor((Number(shift.duration_ms) || 0) / 1000)
    );
  } else {
    const startedAt = new Date(shift.started_at).getTime();

    if (!Number.isFinite(startedAt)) {
      return '00:00:00';
    }

    const totalSeconds = Math.floor(
      (now - startedAt) / 1000
    );

    const pausedSeconds =
      Number(shift.paused_seconds) || 0;

    seconds = Math.max(
      0,
      totalSeconds - pausedSeconds
    );
  }

  const hours =
    Math.floor(seconds / 3600)
      .toString()
      .padStart(2, '0');

  const minutes =
    Math.floor((seconds % 3600) / 60)
      .toString()
      .padStart(2, '0');

  const secs =
    (seconds % 60)
      .toString()
      .padStart(2, '0');

  return `${hours}:${minutes}:${secs}`;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers });
  if (request.method !== 'POST') return reply({ error: 'Metodă invalidă.' }, 405);
  try {
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default;
    const db = createClient(Deno.env.get('SUPABASE_URL')!, key);
    const body = await request.json().catch(() => ({}));

    const cronSecret = await getPlatformSecret(db, 'status_live_cron_secret');

    const receivedCronSecret =
      request.headers.get('x-cron-secret') || '';

    const isCronRequest: boolean =
      cronSecret.length > 0 &&
      receivedCronSecret === cronSecret;

    console.log('STATUS LIVE AUTH DEBUG', {
      hasCronSecret: Boolean(cronSecret),
      hasReceivedSecret: Boolean(receivedCronSecret),
      isCronRequest
    });

    let organizationId = '';

    if (isCronRequest) {
      organizationId = String(body.organization_id || '').trim();

      if (!organizationId) {
        return reply({
          error: 'organization_id este obligatoriu pentru rularea automată.'
        }, 400);
      }
    } else {
      const session = await requirePanelSession(
        db,
        request,
        1,
        true
      );

      const requestedOrganization =
        String(body.organization_id || '').trim();

      if (
        requestedOrganization &&
        requestedOrganization !== String(session.organization_id)
      ) {
        return reply({
          error: 'Organizația activă nu corespunde sesiunii.'
        }, 403);
      }

      organizationId = String(session.organization_id);
    }
    const [{ data: organization }, { data: settings }, { data: shifts, error: shiftsError }] = await Promise.all([
    db.from('organizations')
      .select('name,live_status_message_id,live_status_last_update')
      .eq('id', organizationId)
      .maybeSingle(),      
      db.from('organization_settings').select('webhook_routes,discord_channel_routes').eq('organization_id', organizationId).maybeSingle(),
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
    const line = (shift: any, icon: string) =>
    `${icon} **${shift.colleague_name || names.get(String(shift.discord_id)) || 'Utilizator'}** — ${elapsed(shift, now)}`;
    const section = (title: string, items: any[], icon: string) => `${title} (${items.length})\n${items.length ? items.map((shift) => line(shift, icon)).join('\n') : '_Nimeni_'}`;
    const description = `${section('🟢 În pontaj', active, '🟢')}\n\n${section('☕ În pauză', paused, '☕')}\n\n📊 **Total:** ${rows.length}\n⏱️ **Actualizat:** <t:${Math.floor(now / 1000)}:R>`;
    const payload = { embeds: [{ title: `📡 STATUS LIVE · ${organization?.name || 'Organizație'}`, description, color: 3066993, timestamp: new Date(now).toISOString(), footer: { text: 'Panel · actualizare live' } }] };
    const configuredTargets = routeCandidates(settings, 'status_live');
    if (!configuredTargets.some((destination) => destination.candidates.length)) {
      throw new Error('Canalul Discord pentru Status Live nu este configurat.');
    }
    const storedMessageId = String(
      organization?.live_status_message_id || ''
    ).trim();
    const requestedMessageIds = body?.message_ids && typeof body.message_ids === 'object'
      ? body.message_ids
      : {};

    // Cronul și pagina pot porni sincronizarea în același minut. Rezervăm
    // atomic fereastra de actualizare ca să nu existe două POST-uri Discord
    // înainte ca primul apel să salveze message_id-ul.
    const lockNow = new Date(now).toISOString();
    const lockCutoff = new Date(now - 45000).toISOString();
    const { data: lockRow, error: lockError } = await db
      .from('organizations')
      .update({ live_status_last_update: lockNow })
      .eq('id', organizationId)
      .or(`live_status_last_update.is.null,live_status_last_update.lt.${lockCutoff}`)
      .select('id')
      .maybeSingle();
    if (lockError) throw lockError;
    if (!lockRow && body?.force !== true) {
      return reply({
        ok: true,
        skipped: true,
        organization: organization?.name || '',
        message_ids: {},
        updated_at: organization?.live_status_last_update || lockNow
      });
    }

    const messageIds: Record<string, string> = {};

    const usedTargets: Record<string, any> = {};
    for (const destination of configuredTargets) {
      const target = destination.target;
      if (!destination.candidates.length) continue;
      let response: Response | null = null;
      let selectedMessageId = '';
      for (const candidate of destination.candidates) {
        // Prioritatea este ID-ul salvat pe rută, apoi ID-ul păstrat în browser,
        // iar pentru canalul principal folosim și ID-ul istoric al organizației.
        // Dacă ID-ul vechi aparține unui webhook șters/dezactivat, PATCH-ul
        // eșuează și se face automat un singur POST de înlocuire.
        const existingId = String(
          candidate.message_id || requestedMessageIds[target] || (target === 'primary' ? storedMessageId : '') || ''
        ).trim();
        selectedMessageId = existingId;
        response = await requestDiscordTarget(db, candidate, JSON.stringify(payload), { messageId: existingId });
        if (!response.ok && existingId && response.status === 404) response = await requestDiscordTarget(db, { ...candidate, message_id: '' }, JSON.stringify(payload));
        if (response.ok) { usedTargets[target] = candidate; break; }
      }
      if (!response?.ok) throw new Error(`Discord a răspuns cu HTTP ${response?.status || 500}.`);
      const data = await response.json().catch(() => ({}));
      if (data.id) messageIds[target] = String(data.id); else if (selectedMessageId) messageIds[target] = selectedMessageId;
    }
        const primaryMessageId = messageIds.primary || storedMessageId || null;

        if (Object.keys(messageIds).length) {
          const channelRoutes = settings?.discord_channel_routes && typeof settings.discord_channel_routes === 'object'
            ? settings.discord_channel_routes
            : {};
          const statusRoute = { ...(channelRoutes.status_live || {}) };
          for (const target of ['primary', 'secondary']) {
            if (usedTargets[target] && messageIds[target]) {
              statusRoute[target] = { ...(statusRoute[target] || {}), enabled: true, message_id: messageIds[target] };
            }
          }
          const { error: channelRouteError } = await db
            .from('organization_settings')
            .update({ discord_channel_routes: { ...channelRoutes, status_live: statusRoute }, updated_at: new Date(now).toISOString() })
            .eq('organization_id', organizationId);
          if (channelRouteError) throw channelRouteError;
        }

        const { error: updateOrganizationError } = await db
          .from('organizations')
          .update({
            live_status_message_id: primaryMessageId,
            live_status_last_update: new Date(now).toISOString()
          })
          .eq('id', organizationId);

        if (updateOrganizationError) {
          throw updateOrganizationError;
        }
    return reply({ ok: true, organization: organization?.name || '', active: active.length, paused: paused.length, message_ids: messageIds, updated_at: new Date(now).toISOString() });
  } catch (error) {
    console.error(error);
    return reply({ error: error instanceof Error ? error.message : 'Eroare Status Live.' }, 400);
  }
});
