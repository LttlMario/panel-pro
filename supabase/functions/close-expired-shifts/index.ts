import { createClient } from 'jsr:@supabase/supabase-js@2.112.3';
import { getPlatformSecret } from '../_shared/platform-secrets.ts';

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': 'https://lttlmario.github.io',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function getSecretKey() {
  const legacyKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (legacyKey) return legacyKey;
  const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}');
  return keys.default;
}

function romanianTime(date = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Bucharest', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  return `${parts.hour}:${parts.minute}:${parts.second}`;
}

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600).toString().padStart(2, '0');
  const minutes = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
  const secs = (seconds % 60).toString().padStart(2, '0');
  return `${hours}:${minutes}:${secs}`;
}

function workedSeconds(shift: Record<string, unknown>, now: Date) {
  const started = new Date(String(shift.started_at)).getTime();
  let paused = Number(shift.paused_seconds) || 0;
  if (shift.status === 'paused' && shift.paused_at) {
    paused += Math.max(0, Math.floor((now.getTime() - new Date(String(shift.paused_at)).getTime()) / 1000));
  }
  return Math.max(0, Math.floor((now.getTime() - started) / 1000) - paused);
}

Deno.serve(async (request) => {
  // Verificările de disponibilitate și preflight-ul browserului nu execută
  // închiderea turelor și trebuie să răspundă înainte de validarea secretului.
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, getSecretKey());
  const cronSecret = await getPlatformSecret(supabase, 'cron_secret');
  if (!cronSecret || request.headers.get('x-cron-secret') !== cronSecret) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
  }
  const fallbackPontajWebhook = await getPlatformSecret(supabase, 'discord_pontaj_webhook_url');
  const now = new Date();
  const { data: accessRows } = await supabase.from('app_settings').select('organization_id,value').eq('key', 'organization_access');
  const expiredOrganizationIds = (accessRows || []).filter((row: any) => row.value?.expires_at && Date.parse(String(row.value.expires_at)) <= now.getTime()).map((row: any) => row.organization_id);
  if (expiredOrganizationIds.length) await supabase.from('organizations').update({ active: false, updated_at: now.toISOString() }).in('id', expiredOrganizationIds);
  // Preluăm atât turele care trebuie închise, cât și turele închise automat
  // pentru care confirmarea Discord nu a fost încă livrată.
  const { data: expired, error } = await supabase.from('shifts').select('*')
    .or(`and(status.in.(active,paused),auto_stop_at.lte.${now.toISOString()}),and(status.eq.auto_completed,discord_close_notified_at.is.null)`)
    .order('auto_stop_at', { ascending: true })
    .limit(100);

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });

  const results = await Promise.all((expired ?? []).map(async (shift) => {
    const { data: panelConfig } = await supabase.from('organization_settings').select('webhook_routes,pontaj_webhook_url').eq('organization_id', shift.organization_id).maybeSingle();
    const webhookUrl = panelConfig?.webhook_routes?.pontaj?.primary?.url
      || panelConfig?.webhook_routes?.pontaj?.secondary?.url
      || panelConfig?.pontaj_webhook_url
      || fallbackPontajWebhook;
    const alreadyClosed = shift.status === 'auto_completed';
    const finishedAt = alreadyClosed && shift.ended_at ? new Date(String(shift.ended_at)) : now;
    const seconds = alreadyClosed && Number(shift.duration_ms) >= 0
      ? Math.floor(Number(shift.duration_ms) / 1000)
      : workedSeconds(shift, finishedAt);
    const reason = 'Încheiere automată – program maxim atins';
    let colleagueName = String(shift.colleague_name || '').trim();
    if (!colleagueName) {
      const { data: member } = await supabase.from('users')
        .select('display_name, username').eq('discord_id', shift.discord_id).maybeSingle();
      colleagueName = String(member?.display_name || member?.username || shift.discord_id || 'Necunoscut');
    }
    if (!alreadyClosed) {
      const { data: updated, error: updateError } = await supabase.from('shifts').update({
        status: 'auto_completed', ended_at: now.toISOString(), end_time: romanianTime(now),
        duration: formatDuration(seconds), duration_ms: seconds * 1000, stop_reason: reason,
        colleague_name: colleagueName,
      }).eq('id', shift.id).in('status', ['active', 'paused']).select('id');
      if (updateError || !updated?.length) return { id: shift.id, closed: false, notified: false };
    }

    if (!webhookUrl) {
      await supabase.from('shifts').update({ discord_close_notification_error: 'Webhook-ul de pontaj nu este configurat.' }).eq('id', shift.id);
      return { id: shift.id, closed: true, notified: false };
    }

    try {
      const webhookResponse = await fetch(webhookUrl, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ embeds: [{
          title: `⏹️ Pontaj Încheiat - Tură de ${String(shift.shift_type).toUpperCase()}`,
          color: shift.shift_type === 'zi' ? 16766720 : 65535,
          fields: [
            { name: '👤 Mecanic', value: colleagueName, inline: true },
            { name: '📅 Data', value: String(shift.date || ''), inline: true },
            { name: '⏳ Timp Total Lucrat', value: `**${formatDuration(seconds)}**`, inline: true },
            { name: '📝 Motiv', value: reason, inline: false },
          ], timestamp: finishedAt.toISOString(),
        }] }),
      });
      if (!webhookResponse.ok) {
        const details = (await webhookResponse.text()).slice(0, 500);
        throw new Error(`Discord HTTP ${webhookResponse.status}${details ? `: ${details}` : ''}`);
      }
      await supabase.from('shifts').update({
        discord_close_notified_at: new Date().toISOString(),
        discord_close_notification_error: null,
      }).eq('id', shift.id);
      return { id: shift.id, closed: true, notified: true };
    } catch (notificationError) {
      const message = notificationError instanceof Error ? notificationError.message : 'Eroare Discord necunoscută.';
      console.error(`Notificarea automată pentru tura ${shift.id} a eșuat:`, message);
      await supabase.from('shifts').update({ discord_close_notification_error: message.slice(0, 1000) }).eq('id', shift.id);
      return { id: shift.id, closed: true, notified: false };
    }
  }));

  return new Response(JSON.stringify({
    processed: results.length,
    closed: results.filter((item) => item.closed).length,
    notified: results.filter((item) => item.notified).length,
    pending_notifications: results.filter((item) => item.closed && !item.notified).length,
  }), { headers: corsHeaders });
});
