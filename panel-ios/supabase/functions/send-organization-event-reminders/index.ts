import { createClient } from 'jsr:@supabase/supabase-js@2.112.3';
import { getPlatformSecret } from '../_shared/platform-secrets.ts';
import { deliverDiscordRoute, routeCandidates } from '../_shared/discord-delivery.ts';

const headers = { 'Access-Control-Allow-Origin': 'https://panel-pro.ro', 'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-cron-secret', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Content-Type': 'application/json' };
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers });
const serviceKey = () => Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default;
const DAY_MS = 86400000;
const MAX_DAYS = 14;
const EVENT_TYPES: Record<string, string> = { car_meet: 'Car Meet', convoy: 'Convoy', race: 'Cursă / Race', party: 'Petrecere', community: 'Eveniment comunitar', roleplay: 'Eveniment RP', other: 'Alt eveniment' };

function localDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Bucharest', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

async function claimRun(db: any, event: any, reminderDate: string, daysRemaining: number) {
  const { data: existing, error: readError } = await db.from('organization_event_reminder_runs').select('id,status,updated_at').eq('event_id', event.id).eq('reminder_date', reminderDate).maybeSingle();
  if (readError) throw readError;
  if (existing?.status === 'sent') return null;
  if (existing?.status === 'processing' && Date.parse(String(existing.updated_at || '')) > Date.now() - 10 * 60 * 1000) return null;
  if (existing) {
    const { data, error } = await db.from('organization_event_reminder_runs').update({ status: 'processing', days_remaining: daysRemaining, error: null, updated_at: new Date().toISOString() }).eq('id', existing.id).select('id').single();
    if (error) throw error;
    return data?.id || null;
  }
  const { data, error } = await db.from('organization_event_reminder_runs').insert({ organization_id: event.organization_id, event_id: event.id, reminder_date: reminderDate, days_remaining: daysRemaining, status: 'processing' }).select('id').single();
  if (!error) return data?.id || null;
  if (error.code === '23505') return null;
  throw error;
}

async function finishRun(db: any, id: string, status: string, errorMessage: string | null = null) {
  await db.from('organization_event_reminder_runs').update({ status, error: errorMessage?.slice(0, 1000) || null, sent_at: status === 'sent' ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq('id', id);
}

async function send(db: any, settings: any, event: any, daysRemaining: number) {
  const eventType = EVENT_TYPES[String(event.event_type || 'other')] || EVENT_TYPES.other;
  const ending = daysRemaining === 0 ? 'Perioada de 14 zile se încheie astăzi.' : `Mai sunt **${daysRemaining} ${daysRemaining === 1 ? 'zi' : 'zile'}** până la împlinirea celor 14 zile.`;
  const payload = { allowed_mentions: { parse: [] }, embeds: [{ title: `🗓️ ${eventType} · ${event.title}`, description: `Evenimentul a fost înregistrat la data de **${event.event_date}**.\n\n${ending}${event.details ? `\n\n**Detalii:**\n${String(event.details).slice(0, 1800)}` : ''}`, color: daysRemaining <= 1 ? 15158332 : 16753920, fields: [{ name: 'Tip eveniment', value: eventType, inline: true }, { name: 'Progres', value: `${MAX_DAYS - daysRemaining} / ${MAX_DAYS} zile trecute`, inline: true }, ...(event.evidence_url ? [{ name: 'Dovadă', value: `[Deschide linkul](${event.evidence_url})`, inline: true }] : [])], footer: { text: 'Panel Pro · reminder automat zilnic' }, timestamp: new Date().toISOString() }] };
  const candidates = routeCandidates(settings, 'event_reminders');
  if (!candidates.some((item) => item.candidates.length)) throw new Error('Nu există nicio destinație Discord configurată.');
  const result = await deliverDiscordRoute(db, settings, 'event_reminders', JSON.stringify(payload), { postOnly: true });
  if (!result.results.length) throw new Error(result.failures.join(' | ') || 'Discord nu a acceptat notificarea.');
  return result;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return reply({ error: 'Metodă invalidă.' }, 405);
  try {
    const key = serviceKey();
    if (!key) throw new Error('Cheia secretă Supabase lipsește.');
    const db = createClient(Deno.env.get('SUPABASE_URL')!, key);
    const cronSecret = await getPlatformSecret(db, 'cron_secret');
    if (!cronSecret || request.headers.get('x-cron-secret') !== cronSecret) return reply({ error: 'Unauthorized' }, 401);
    await request.json().catch(() => ({}));
    const today = localDate();
    const todayUtc = new Date(`${today}T00:00:00Z`);
    const oldest = new Date(todayUtc.getTime() - MAX_DAYS * DAY_MS).toISOString().slice(0, 10);
    const { data: organizations, error: organizationError } = await db.from('organizations').select('id').eq('active', true);
    if (organizationError) throw organizationError;
    const organizationIds = (organizations || []).map((row: any) => row.id);
    if (!organizationIds.length) return reply({ ok: true, reminder_date: today, results: [] });
    const [{ data: events, error: eventError }, { data: settings, error: settingsError }] = await Promise.all([
      db.from('organization_events').select('id,organization_id,title,event_type,event_date,details,evidence_url,status').eq('status', 'active').in('organization_id', organizationIds).gte('event_date', oldest).lte('event_date', today).order('event_date'),
      db.from('organization_settings').select('organization_id,webhook_routes,discord_channel_routes').in('organization_id', organizationIds),
    ]);
    if (eventError) throw eventError;
    if (settingsError) throw settingsError;
    const settingsByOrg = new Map((settings || []).map((row: any) => [String(row.organization_id), row]));
    const results = [];
    for (const event of events || []) {
      const eventUtc = new Date(`${event.event_date}T00:00:00Z`);
      const elapsed = Math.floor((todayUtc.getTime() - eventUtc.getTime()) / DAY_MS);
      const daysRemaining = MAX_DAYS - elapsed;
      const eventSettings = settingsByOrg.get(String(event.organization_id));
      const destinations = routeCandidates(eventSettings, 'event_reminders');
      if (!destinations.some((item) => item.candidates.length)) { results.push({ event_id: event.id, status: 'skipped_no_destination', days_remaining: daysRemaining }); continue; }
      const runId = await claimRun(db, event, today, daysRemaining);
      if (!runId) { results.push({ event_id: event.id, status: 'already_processed', days_remaining: daysRemaining }); continue; }
      const failures: string[] = [];
      let delivery: any = null;
      try { delivery = await send(db, eventSettings, event, daysRemaining); failures.push(...(delivery.failures || [])); } catch (error) { failures.push(error instanceof Error ? error.message : 'Eroare Discord.'); }
      if (!delivery?.results?.length) { await finishRun(db, runId, 'failed', failures.join(' | ')); results.push({ event_id: event.id, status: 'failed', error: failures.join(' | ') }); continue; }
      await finishRun(db, runId, 'sent', failures.length ? `Unele canale Discord au eșuat: ${failures.join(' | ')}` : null);
      if (daysRemaining === 0) await db.from('organization_events').update({ status: 'completed', updated_at: new Date().toISOString() }).eq('id', event.id).eq('status', 'active');
      results.push({ event_id: event.id, status: failures.length ? 'sent_partial' : 'sent', days_remaining: daysRemaining });
    }
    return reply({ ok: true, reminder_date: today, results });
  } catch (error) { return reply({ error: error instanceof Error ? error.message : 'Eroare internă.' }, 500); }
});
