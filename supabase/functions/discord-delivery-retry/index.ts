import { createClient } from 'jsr:@supabase/supabase-js@2.112.3';
import { getPlatformSecret } from '../_shared/platform-secrets.ts';
import { recordDiscordDeliveryEvent, requestDiscordTarget, validDiscordChannelId } from '../_shared/discord-delivery.ts';
import { corsOptions, getCorsHeaders } from '../_shared/cors.ts';

const reply = (request: Request, data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: getCorsHeaders(request) });
const serviceKey = () => {
  const direct = String(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '').trim();
  if (direct) return direct;
  try { return String(JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default || '').trim(); } catch (_) { return ''; }
};
const errorText = (value: any) => String(value?.message || value?.details || value || 'Eroare Discord.').slice(0, 2000);

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return corsOptions(request);
  if (request.method !== 'POST') return reply(request, { error: 'Metodă invalidă.' }, 405);
  try {
    const key = serviceKey();
    if (!key) throw new Error('Cheia secretă Supabase lipsește.');
    const db = createClient(Deno.env.get('SUPABASE_URL')!, key);
    const body = await request.json().catch(() => ({}));
    const supplied = String(request.headers.get('x-cron-secret') || '').trim();
    const configured = await getPlatformSecret(db, 'cron_secret');
    if (!supplied || !configured || supplied !== configured || String(body.action || 'process') !== 'process') return reply(request, { error: 'Acces neautorizat.' }, 401);

    const now = new Date().toISOString();
    const { data: jobs, error } = await db.from('discord_delivery_queue')
      .select('id,organization_id,route_key,message_key,target,channel_id,message_id,payload,headers,attempts')
      .eq('status', 'pending')
      .lte('next_attempt_at', now)
      .order('created_at', { ascending: true })
      .limit(50);
    if (error) throw error;
    const results: any[] = [];
    for (const job of jobs || []) {
      const claim = await db.from('discord_delivery_queue').update({ status: 'processing', locked_at: now, updated_at: now }).eq('id', job.id).eq('status', 'pending').select('id').maybeSingle();
      if (claim.error || !claim.data) continue;
      let status = 'failed';
      let messageId = String(job.message_id || '').trim();
      let lastError = '';
      let httpStatus: number | undefined;
      let operation: 'create' | 'edit' | 'recreate' = messageId ? 'edit' : 'create';
      try {
        const { data: settings, error: settingsError } = await db.from('organization_settings').select('discord_channel_routes').eq('organization_id', job.organization_id).maybeSingle();
        if (settingsError) throw settingsError;
        const configuredRoute = settings?.discord_channel_routes?.[job.route_key]?.[job.target];
        if (!configuredRoute || configuredRoute.enabled === false || String(configuredRoute.channel_id || '') !== String(job.channel_id || '') || !validDiscordChannelId(job.channel_id)) throw new Error('Ruta Discord nu mai este configurată pentru canalul salvat.');
        const target = { target: job.target, transport: 'bot' as const, channel_id: String(job.channel_id), guild_id: String(configuredRoute.guild_id || ''), message_id: messageId };
        let response = await requestDiscordTarget(db, target, JSON.stringify(job.payload || {}), { messageId: validDiscordChannelId(messageId) ? messageId : undefined, headers: job.headers || {} });
        httpStatus = response.status;
        if (!response.ok && response.status === 404 && validDiscordChannelId(messageId)) {
          response = await requestDiscordTarget(db, target, JSON.stringify(job.payload || {}), { method: 'POST', headers: job.headers || {} });
          httpStatus = response.status;
          operation = 'recreate';
        }
        const responseBody = await response.clone().json().catch(() => ({}));
        if (!response.ok) throw new Error(`Discord HTTP ${response.status}: ${errorText(responseBody)}`);
        messageId = String(responseBody?.id || messageId || '').trim();
        status = 'succeeded';
        await db.from('discord_delivery_queue').update({ status, message_id: messageId || null, attempts: Number(job.attempts || 0) + 1, completed_at: new Date().toISOString(), last_error: null, updated_at: new Date().toISOString() }).eq('id', job.id);
        await recordDiscordDeliveryEvent(db, {
          organizationId: job.organization_id,
          messageKey: job.message_key,
          retryPayload: job.payload,
          retryHeaders: job.headers || {},
        }, job.route_key, target, {
          messageId,
          operation,
          status: 'success',
          httpStatus,
          metadata: { retry_queue_id: job.id, retry_attempt: Number(job.attempts || 0) + 1 },
        });
      } catch (error) {
        lastError = errorText(error);
        const attempts = Number(job.attempts || 0) + 1;
        const permanentlyFailed = attempts >= 8;
        const delayMinutes = Math.min(60, Math.max(1, 2 ** Math.min(attempts - 1, 6)));
        await db.from('discord_delivery_queue').update({ status: permanentlyFailed ? 'failed' : 'pending', attempts, next_attempt_at: new Date(Date.now() + delayMinutes * 60 * 1000).toISOString(), last_error: lastError, updated_at: new Date().toISOString() }).eq('id', job.id);
        await recordDiscordDeliveryEvent(db, {
          organizationId: job.organization_id,
          messageKey: job.message_key,
        }, job.route_key, { ...target, message_id: messageId }, {
          messageId,
          operation,
          status: 'failure',
          httpStatus,
          errorMessage: lastError,
          metadata: { retry_queue_id: job.id, retry_attempt: attempts, permanently_failed: permanentlyFailed },
        });
      }
      results.push({ id: job.id, status, error: lastError || null });
    }
    return reply(request, { ok: true, processed: results.length, results });
  } catch (error) {
    return reply(request, { error: errorText(error) }, 500);
  }
});
