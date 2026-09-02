import { createClient } from 'jsr:@supabase/supabase-js@2.112.3';
import { getPlatformSecret } from '../_shared/platform-secrets.ts';
import { deliverDiscordRoute, routeCandidates } from '../_shared/discord-delivery.ts';

const headers = {
  'Access-Control-Allow-Origin': 'https://panel-pro.ro',
  'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers });
const serviceKey = () => Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}').default;

function localParts(date = new Date()) {
  const values = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Bucharest', weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(date).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  return { weekday: values.weekday, year: Number(values.year), month: Number(values.month), day: Number(values.day), hour: Number(values.hour), minute: Number(values.minute) };
}

function weeklyPeriod(now = new Date()) {
  const parts = localParts(now);
  const end = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 23, 59, 59));
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 6);
  return { start: start.toISOString(), end: end.toISOString(), startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) };
}

async function claimRun(db: any, organizationId: string, period: any) {
  const base = { organization_id: organizationId, period_start: period.startDate, period_end: period.endDate };
  const { data: existing, error: readError } = await db.from('organization_action_report_runs').select('id,status,updated_at').match(base).maybeSingle();
  if (readError) throw readError;
  if (!existing) {
    const { data: created, error } = await db.from('organization_action_report_runs').insert({ ...base, status: 'processing' }).select('id').maybeSingle();
    if (!error) return created?.id || null;
    if (error.code !== '23505') throw error;
    return null;
  }
  if (['sent', 'skipped'].includes(existing.status)) return null;
  const updatedAt = Date.parse(String(existing.updated_at || ''));
  if (Number.isFinite(updatedAt) && Date.now() - updatedAt < 10 * 60 * 1000) return null;
  const { data: reclaimed, error } = await db.from('organization_action_report_runs').update({ status: 'processing', error: null, updated_at: new Date().toISOString() }).eq('id', existing.id).select('id').maybeSingle();
  if (error) throw error;
  return reclaimed?.id || null;
}

async function finishRun(db: any, id: string, status: string, error: string | null = null) {
  await db.from('organization_action_report_runs').update({ status, error: error?.slice(0, 1000) || null, sent_at: status === 'sent' ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq('id', id);
}

function buildRanking(rows: any[]) {
  const people = new Map<string, any>();
  for (const row of rows) {
    const type = String(row.action_label || row.action_type || 'Acțiune').trim();
    for (const participant of Array.isArray(row.participants) ? row.participants : []) {
      const id = String(participant?.discord_id || participant?.id || '').trim();
      if (!id) continue;
      const current = people.get(id) || { id, name: String(participant?.name || participant?.username || id), participations: 0, actions: new Set<string>(), types: new Map<string, number>(), last_activity_at: null };
      current.participations += 1;
      current.actions.add(String(row.id));
      current.types.set(type, (current.types.get(type) || 0) + 1);
      if (!current.last_activity_at || String(row.created_at) > current.last_activity_at) current.last_activity_at = row.created_at;
      people.set(id, current);
    }
  }
  return [...people.values()].sort((left, right) => right.participations - left.participations || right.actions.size - left.actions.size || left.name.localeCompare(right.name, 'ro'));
}

function csvCell(value: unknown) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

function buildCsv(ranking: any[]) {
  const rows: unknown[][] = [['Loc', 'Membru', 'Discord ID', 'Participări', 'Acțiuni distincte', 'Tipuri de acțiuni', 'Ultima activitate']];
  ranking.forEach((person, index) => rows.push([
    index + 1,
    person.name,
    person.id,
    person.participations,
    person.actions.size,
    [...person.types.entries()].map(([label, count]) => `${label} x${count}`).join('; '),
    person.last_activity_at || ''
  ]));
  return `\ufeff${rows.map((row) => row.map(csvCell).join(',')).join('\n')}`;
}

async function sendReport(db: any, settings: any, embed: any, csv: string, filename: string) {
  const form = new FormData();
  form.append('payload_json', JSON.stringify({ allowed_mentions: { parse: [] }, embeds: [embed] }));
  form.append('files[0]', new Blob([csv], { type: 'text/csv;charset=utf-8' }), filename);
  return deliverDiscordRoute(db, settings, 'actions_organization_weekly', form, { fallbackRouteKey: 'actions_organization' });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return reply({ error: 'Metodă invalidă.' }, 405);
  try {
    const body = await request.json().catch(() => ({}));
    const now = new Date();
    const parts = localParts(now);
    const forced = body?.force === true;
    if (!forced && (parts.weekday !== 'Sun' || parts.hour !== 19 || parts.minute < 30 || parts.minute > 35)) return reply({ ok: true, skipped: 'outside_schedule_window' });
    const key = serviceKey();
    if (!key) throw new Error('Cheia secretă Supabase lipsește.');
    const db = createClient(Deno.env.get('SUPABASE_URL')!, key);
    const cronSecret = await getPlatformSecret(db, 'cron_secret');
    if (!cronSecret || request.headers.get('x-cron-secret') !== cronSecret) return reply({ error: 'Unauthorized' }, 401);
    const period = weeklyPeriod(now);
    const { data: organizations, error: organizationsError } = await db.from('organizations').select('id,name').eq('active', true).order('name');
    if (organizationsError) throw organizationsError;
    const results = [];
    for (const organization of organizations || []) {
      const runId = await claimRun(db, String(organization.id), period);
      if (!runId) { results.push({ organization_id: organization.id, status: 'already_processed' }); continue; }
      try {
        const [{ data: rows, error: rowsError }, { data: settings, error: settingsError }] = await Promise.all([
          db.from('organization_actions').select('id,action_type,action_label,participants,created_at').eq('organization_id', organization.id).gte('created_at', period.start).lte('created_at', period.end).order('created_at', { ascending: false }),
          db.from('organization_settings').select('webhook_routes,discord_channel_routes').eq('organization_id', organization.id).maybeSingle()
        ]);
        if (rowsError) throw rowsError;
        if (settingsError) throw settingsError;
        if (!rows?.length) { await finishRun(db, runId, 'skipped', 'Nu există acțiuni în perioada raportată.'); results.push({ organization_id: organization.id, status: 'skipped_no_actions' }); continue; }
        if (!routeCandidates(settings, 'actions_organization_weekly', [], 'actions_organization').some((item) => item.candidates.length)) throw new Error('Canalul Discord sau webhook-ul pentru Acțiuni nu este configurat.');
        const ranking = buildRanking(rows);
        const totalParticipations = ranking.reduce((sum, person) => sum + person.participations, 0);
        const lines = ranking.slice(0, 15).map((person, index) => `${index + 1}. **${person.name}** — ${person.participations} participări · ${person.actions.size} acțiuni distincte`);
        const description = `Perioada: **${period.startDate} – ${period.endDate}**\nAcțiuni înregistrate: **${rows.length}** · Participări: **${totalParticipations}** · Persoane implicate: **${ranking.length}**\n\n${lines.join('\n') || 'Nu există participanți selectați.'}${ranking.length > 15 ? `\n…și încă ${ranking.length - 15} persoane.` : ''}`;
        const embeds = [{ title: `🏆 Clasament implicare · ${organization.name || 'Organizație'}`, description: description.slice(0, 4000), color: 16753920, timestamp: now.toISOString(), footer: { text: 'Panel Pro · Raport automat Acțiuni' } }];
        const delivery = await sendReport(db, settings, embeds[0], buildCsv(ranking), `clasament-actiuni-${period.startDate}-${period.endDate}.csv`);
        const failures = delivery.failures || [];
        if (!delivery.results.length) throw new Error(failures.join(' | ') || 'Discord nu a acceptat raportul.');
        await finishRun(db, runId, 'sent', failures.length ? `Unele webhook-uri au eșuat: ${failures.join(' | ')}` : null);
        results.push({ organization_id: organization.id, status: failures.length ? 'sent_partial' : 'sent', people: ranking.length });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Eroare necunoscută.';
        await finishRun(db, runId, 'failed', message);
        results.push({ organization_id: organization.id, status: 'failed', error: message });
      }
    }
    return reply({ ok: true, period: { start: period.startDate, end: period.endDate }, results });
  } catch (error) { return reply({ error: error instanceof Error ? error.message : 'Eroare internă.' }, 500); }
});
