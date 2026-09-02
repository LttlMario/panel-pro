import { createClient } from 'jsr:@supabase/supabase-js@2.112.3';
import { requirePanelSession } from '../_shared/panel-session.ts';
import { packageAllowsPage } from '../_shared/package-features.ts';
import { deliverDiscordRoute, routeCandidates } from '../_shared/discord-delivery.ts';

const PAGE = 'organizatie-evenimente.html';
const MAX_DAYS = 14;
const EVENT_TYPES: Record<string, string> = { car_meet: 'Car Meet', convoy: 'Convoy', race: 'Cursă / Race', party: 'Petrecere', community: 'Eveniment comunitar', roleplay: 'Eveniment RP', other: 'Alt eveniment' };
const serviceKey = () => Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default;
const reply = (request: Request, data: unknown, status = 200) => {
  const origin = String(request.headers.get('origin') || '');
  const allowedOrigin = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) || origin === 'https://panel-pro.ro' ? origin : 'https://panel-pro.ro';
  return new Response(JSON.stringify(data), { status, headers: { 'Access-Control-Allow-Origin': allowedOrigin, 'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-panel-session', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Vary': 'Origin', 'Content-Type': 'application/json' } });
};
const clean = (value: unknown, max: number) => String(value ?? '').trim().slice(0, max);
const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
const validEvidenceUrl = (value: string) => {
  if (!value) return true;
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol); } catch { return false; }
};
const eventFields = 'id,organization_id,title,event_type,event_date,details,evidence_url,status,created_by_discord_id,created_at,updated_at,archived_at';

async function canUsePage(db: any, session: any) {
  if (session.is_platform_admin) return true;
  const [{ data: pageSetting, error: pageError }, { data: packageSetting, error: packageError }, { data: actionSetting, error: actionError }] = await Promise.all([
    db.from('app_settings').select('value').eq('organization_id', session.organization_id).eq('key', 'page_permissions').maybeSingle(),
    db.from('app_settings').select('value').eq('organization_id', session.organization_id).eq('key', 'organization_package').maybeSingle(),
    db.from('app_settings').select('value').eq('organization_id', session.organization_id).eq('key', 'action_permissions').maybeSingle(),
  ]);
  if (pageError) throw pageError;
  if (packageError) throw packageError;
  if (actionError) throw actionError;
  if (!packageAllowsPage(PAGE, packageSetting?.value || {})) return false;
  const pageRoles = Array.isArray(pageSetting?.value?.[PAGE]) ? pageSetting.value[PAGE].map(String) : [];
  const readRoles = Array.isArray(actionSetting?.value?.['events.read']) ? actionSetting.value['events.read'].map(String) : [];
  return session.discord_role_ids.some((role: string) => pageRoles.includes(String(role)) || readRoles.includes(String(role)));
}

async function canWrite(db: any, session: any) {
  if (session.is_platform_admin) return true;
  const { data, error } = await db.from('app_settings').select('value').eq('organization_id', session.organization_id).eq('key', 'action_permissions').maybeSingle();
  if (error) throw error;
  const allowedRoles = Array.isArray(data?.value?.['events.write']) ? data.value['events.write'].map(String) : [];
  return session.discord_role_ids.some((role: string) => allowedRoles.includes(String(role)));
}

async function sendReminder(db: any, settings: any, event: any, daysRemaining: number, test = false, startsInDays = 0) {
  const eventType = EVENT_TYPES[String(event.event_type || 'other')] || EVENT_TYPES.other;
  const ending = startsInDays > 0 ? `Reminderul zilnic va începe peste **${startsInDays} ${startsInDays === 1 ? 'zi' : 'zile'}**, la data evenimentului.` : daysRemaining === 0 ? 'Perioada de 14 zile se încheie astăzi.' : `Mai sunt **${daysRemaining} ${daysRemaining === 1 ? 'zi' : 'zile'}** până la împlinirea celor 14 zile.`;
  const payload = { allowed_mentions: { parse: [] }, embeds: [{ title: `${test ? '🧪 Test · ' : ''}🗓️ ${eventType} · ${event.title}`, description: `Evenimentul a fost înregistrat la data de **${event.event_date}**.\n\n${ending}${event.details ? `\n\n**Detalii:**\n${event.details.slice(0, 1800)}` : ''}`, color: daysRemaining <= 1 ? 15158332 : 16753920, fields: [{ name: 'Tip eveniment', value: eventType, inline: true }, { name: 'Progres', value: `${MAX_DAYS - daysRemaining} / ${MAX_DAYS} zile trecute`, inline: true }, ...(event.evidence_url ? [{ name: 'Dovadă', value: `[Deschide linkul](${event.evidence_url})`, inline: true }] : [])], footer: { text: 'Panel Pro · remindere automate evenimente' }, timestamp: new Date().toISOString() }] };
  const destinations = routeCandidates(settings, 'event_reminders');
  if (!destinations.some((item) => item.candidates.length)) throw new Error('Nu există nicio destinație Discord configurată pentru evenimente.');
  return deliverDiscordRoute(db, settings, 'event_reminders', JSON.stringify(payload), { postOnly: true });
}

const localDate = (now = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Bucharest', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);

async function claimAutomaticReminder(db: any, event: any, reminderDate: string, daysRemaining: number) {
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

async function finishAutomaticReminder(db: any, id: string, status: string, errorMessage: string | null = null) {
  const { error } = await db.from('organization_event_reminder_runs').update({ status, error: errorMessage?.slice(0, 1000) || null, sent_at: status === 'sent' ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

async function sendAutomaticReminder(db: any, settings: any, event: any) {
  const today = localDate();
  const eventDay = new Date(`${event.event_date}T00:00:00Z`);
  const todayDay = new Date(`${today}T00:00:00Z`);
  const elapsed = Math.floor((todayDay.getTime() - eventDay.getTime()) / 86400000);
  const startsInDays = elapsed < 0 ? Math.abs(elapsed) : 0;
  if (elapsed > MAX_DAYS) return { status: 'outside_window' };
  const daysRemaining = elapsed < 0 ? MAX_DAYS : Math.max(0, MAX_DAYS - elapsed);
  const destinations = routeCandidates(settings, 'event_reminders');
  if (!destinations.some((item) => item.candidates.length)) return { status: 'not_sent', error: 'Nu există nicio destinație Discord configurată pentru evenimente.' };
  const runId = await claimAutomaticReminder(db, event, today, daysRemaining);
  if (!runId) return { status: 'already_sent' };
  try {
    const delivery = await sendReminder(db, settings, event, daysRemaining, false, startsInDays);
    if (!delivery.results.length) throw new Error(delivery.failures.join(' | ') || 'Discord nu a acceptat notificarea.');
    await finishAutomaticReminder(db, runId, 'sent', delivery.failures.length ? `Unele destinații au eșuat: ${delivery.failures.join(' | ')}` : null);
    return { status: 'sent', sent: delivery.results.length, partial: delivery.failures.length > 0, starts_in_days: startsInDays || 0 };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Eroare Discord.';
    await finishAutomaticReminder(db, runId, 'failed', message);
    return { status: 'not_sent', error: message };
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return reply(request, {}, 204);
  if (request.method !== 'POST') return reply(request, { error: 'Metodă invalidă.' }, 405);
  try {
    const key = serviceKey();
    if (!key) throw new Error('Cheia secretă Supabase lipsește.');
    const db = createClient(Deno.env.get('SUPABASE_URL')!, key);
    const session = await requirePanelSession(db, request, 0);
    if (!(await canUsePage(db, session))) return reply(request, { error: 'Nu ai acces la pagina Evenimente și remindere.' }, 403);
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || 'list');
    if (action === 'list') {
      const [{ data: events, error: eventError }, { data: reminders, error: reminderError }] = await Promise.all([
        db.from('organization_events').select(eventFields).eq('organization_id', session.organization_id).order('event_date', { ascending: false }).order('created_at', { ascending: false }),
        db.from('organization_event_reminder_runs').select('id,event_id,reminder_date,days_remaining,status,error,sent_at,created_at').eq('organization_id', session.organization_id).order('reminder_date', { ascending: false }).limit(500),
      ]);
      if (eventError) throw eventError;
      if (reminderError) throw reminderError;
      return reply(request, { ok: true, can_write: await canWrite(db, session), events: events || [], reminders: reminders || [] });
    }
    if (!(await canWrite(db, session))) return reply(request, { error: 'Ai acces doar pentru citire. Cere permisiunea „Evenimente — scriere și ștergere”.' }, 403);
    if (action === 'create' || action === 'update') {
      const title = clean(body.title, 160);
      const eventType = clean(body.event_type, 40);
      const eventDate = clean(body.event_date, 10);
      const details = clean(body.details, 5000);
      const evidenceUrl = clean(body.evidence_url, 500);
      if (title.length < 2) return reply(request, { error: 'Completează un titlu de cel puțin 2 caractere.' }, 400);
      if (!EVENT_TYPES[eventType]) return reply(request, { error: 'Alege un tip valid de eveniment.' }, 400);
      if (!validDate(eventDate)) return reply(request, { error: 'Data evenimentului nu este validă.' }, 400);
      if (!validEvidenceUrl(evidenceUrl)) return reply(request, { error: 'Linkul de dovadă trebuie să fie un URL HTTP(S) valid.' }, 400);
      const values: Record<string, unknown> = { title, event_type: eventType, event_date: eventDate, details, evidence_url: evidenceUrl || null, updated_at: new Date().toISOString() };
      if (action === 'create') Object.assign(values, { organization_id: session.organization_id, created_by_discord_id: session.discord_id, status: 'active' });
      const query = action === 'create'
        ? db.from('organization_events').insert(values).select(eventFields).single()
        : db.from('organization_events').update(values).eq('id', clean(body.id, 80)).eq('organization_id', session.organization_id).select(eventFields).single();
      const { data, error } = await query;
      if (error) throw error;
      let notification: any = { status: 'not_sent', error: 'Notificarea automată nu a putut fi pregătită.' };
      try {
        const { data: settings, error: settingsError } = await db.from('organization_settings').select('webhook_routes,discord_channel_routes').eq('organization_id', session.organization_id).maybeSingle();
        if (settingsError) throw settingsError;
        notification = await sendAutomaticReminder(db, settings, data);
      } catch (notificationError) {
        notification = { status: 'not_sent', error: notificationError instanceof Error ? notificationError.message : 'Eroare la notificarea Discord.' };
      }
      return reply(request, { ok: true, event: data, notification });
    }
    if (action === 'archive') {
      const { data, error } = await db.from('organization_events').update({ status: 'archived', archived_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', clean(body.id, 80)).eq('organization_id', session.organization_id).select(eventFields).single();
      if (error) throw error;
      return reply(request, { ok: true, event: data });
    }
    if (action === 'delete') {
      const { data, error } = await db.from('organization_events').delete().eq('id', clean(body.id, 80)).eq('organization_id', session.organization_id).select('id').single();
      if (error) throw error;
      return reply(request, { ok: true, deleted_event_id: data.id });
    }
    if (action === 'send_test') {
      const { data: event, error: eventError } = await db.from('organization_events').select(eventFields).eq('id', clean(body.id, 80)).eq('organization_id', session.organization_id).single();
      if (eventError) throw eventError;
      const { data: settings, error: settingsError } = await db.from('organization_settings').select('webhook_routes,discord_channel_routes').eq('organization_id', session.organization_id).maybeSingle();
      if (settingsError) throw settingsError;
      if (!routeCandidates(settings, 'event_reminders').some((item) => item.candidates.length)) return reply(request, { error: 'Configurează întâi canalul Discord sau webhook-ul fallback pentru „Evenimente · remindere 14 zile”.' }, 400);
      const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
      const eventDay = new Date(`${event.event_date}T00:00:00Z`);
      const elapsed = Math.floor((today.getTime() - eventDay.getTime()) / 86400000);
      const daysRemaining = elapsed < 0 ? MAX_DAYS : Math.max(0, MAX_DAYS - elapsed);
      try { const delivery = await sendReminder(db, settings, event, daysRemaining, true, elapsed < 0 ? Math.abs(elapsed) : 0); return reply(request, { ok: true, sent: delivery.results.length, partial: delivery.failures.length > 0, fallback_failures: delivery.failures }); } catch (error) { return reply(request, { error: error instanceof Error ? error.message : 'Eroare Discord.' }, 502); }
    }
    return reply(request, { error: 'Acțiune necunoscută.' }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Eroare internă.';
    return reply(request, { error: message }, /sesiunea|acces|expirat/i.test(message) ? 401 : 500);
  }
});
