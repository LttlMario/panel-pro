import { createClient } from 'jsr:@supabase/supabase-js@2';
import { requirePanelSession } from '../_shared/panel-session.ts';

const headers = {
  'Access-Control-Allow-Origin': '*',
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
    const body = await request.json().catch(() => ({}));

    const cronSecret =
      Deno.env.get('STATUS_LIVE_CRON_SECRET') ||
      Deno.env.get('CRON_SECRET') ||
      '';

    const receivedCronSecret =
      request.headers.get('x-cron-secret') || '';

    const isCronRequest: boolean =
      cronSecret.length > 0 &&
      receivedCronSecret === cronSecret;

    const directWebhookUrl = String(body.webhook_url || '').trim();
    const persistDirectWebhook = directWebhookUrl && body.persist_direct === true;
    if (directWebhookUrl && !isCronRequest) {
      return reply({ error: 'Webhookul direct poate fi folosit doar pentru testarea autorizată.' }, 403);
    }

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
    const line = (shift: any, icon: string) =>
    `${icon} **${shift.colleague_name || names.get(String(shift.discord_id)) || 'Utilizator'}** — ${elapsed(shift, now)}`;
    const section = (title: string, items: any[], icon: string) => `${title} (${items.length})\n${items.length ? items.map((shift) => line(shift, icon)).join('\n') : '_Nimeni_'}`;
    const description = `${section('🟢 În pontaj', active, '🟢')}\n\n${section('☕ În pauză', paused, '☕')}\n\n📊 **Total:** ${rows.length}\n⏱️ **Actualizat:** <t:${Math.floor(now / 1000)}:R>`;
    const payload = { embeds: [{ title: `📡 STATUS LIVE · ${organization?.name || 'Organizație'}`, description, color: 3066993, timestamp: new Date(now).toISOString(), footer: { text: 'Panel · actualizare live' } }] };
    const route = directWebhookUrl
      ? { direct: { enabled: true, url: directWebhookUrl } }
      : settings?.webhook_routes?.status_live || {};
    const storedMessageId = String(
      organization?.live_status_message_id || ''
    ).trim();

    const messageIds: Record<string, string> = {};

    const targets = directWebhookUrl ? ['direct'] : ['primary', 'secondary'];
    for (const target of targets) {
      const configured = route[target];
      if (!configured?.enabled || !configured.url) continue;
      const webhook = discordUrl(String(configured.url));
      const existingId = target === 'primary'
        ? storedMessageId
        : target === 'secondary'
          ? String(configured.message_id || '').trim()
          : '';
      let response: Response;

      if (existingId && /^\d{15,22}$/.test(existingId)) {
          const patchUrl =
              `${webhook.origin}${webhook.pathname}/messages/${existingId}`;

          console.log('Status Live PATCH:', {
              organizationId,
              organizationName: organization?.name,
              target,
              existingId,
              patchUrl
          });

          response = await fetch(
              patchUrl,
              {
                  method: 'PATCH',
                  headers: {
                      'Content-Type': 'application/json'
                  },
                  body: JSON.stringify(payload)
              }
          );

          console.log(
              'Status Live PATCH response:',
              response.status,
              await response.clone().text()
          );
      }

      else {
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
        const primaryMessageId = messageIds.primary || storedMessageId || null;

        // Pentru webhookul secundar păstrăm ID-ul în configurația organizației,
        // astfel încât actualizările viitoare să editeze primul embed.
        if (!directWebhookUrl && messageIds.secondary && route.secondary) {
          route.secondary = {
            ...route.secondary,
            message_id: messageIds.secondary
          };
          const { error: secondaryRouteError } = await db
            .from('organization_settings')
            .update({
              webhook_routes: {
                ...settings?.webhook_routes,
                status_live: route
              },
              updated_at: new Date(now).toISOString()
            })
            .eq('organization_id', organizationId);
          if (secondaryRouteError) throw secondaryRouteError;
        }

        if (persistDirectWebhook && messageIds.direct) {
          const currentRoutes = settings?.webhook_routes && typeof settings.webhook_routes === 'object'
            ? settings.webhook_routes
            : {};
          const { error: directRouteError } = await db
            .from('organization_settings')
            .update({
              webhook_routes: {
                ...currentRoutes,
                status_live: {
                  ...(currentRoutes.status_live || {}),
                  primary: currentRoutes.status_live?.primary || null,
                  secondary: {
                    enabled: true,
                    url: directWebhookUrl,
                    message_id: messageIds.direct
                  }
                }
              },
              updated_at: new Date(now).toISOString()
            })
            .eq('organization_id', organizationId);
          if (directRouteError) throw directRouteError;
        }

        if (!directWebhookUrl) {
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
        }
    return reply({ ok: true, organization: organization?.name || '', active: active.length, paused: paused.length, message_ids: messageIds, updated_at: new Date(now).toISOString() });
  } catch (error) {
    console.error(error);
    return reply({ error: error instanceof Error ? error.message : 'Eroare Status Live.' }, 400);
  }
});
