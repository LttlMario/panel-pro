import { createClient } from 'jsr:@supabase/supabase-js@2.112.3';
import { getPlatformSecret } from '../_shared/platform-secrets.ts';
import { deliverDiscordRoute, routeCandidates } from '../_shared/discord-delivery.ts';

const headers = {
  'Access-Control-Allow-Origin': 'https://panel-pro.ro',
  'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

const reply = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers });

const serviceKey = () =>
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ||
  JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}').default;

function romanianDateParts(date = new Date()) {
  const values = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Bucharest',
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
    .filter((part) => part.type !== 'literal')
    .map((part) => [part.type, part.value]));

  return {
    weekday: values.weekday,
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
  };
}

function dateValue(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10);
}

function getWeeklyPeriod(now = new Date()) {
  const parts = romanianDateParts(now);
  const end = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 6);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600).toString().padStart(2, '0');
  const minutes = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
  const rest = (seconds % 60).toString().padStart(2, '0');
  return `${hours}:${minutes}:${rest}`;
}

function shiftDurationMs(shift: any) {
  const stored = Number(shift.duration_ms);
  if (Number.isFinite(stored) && stored >= 0) return stored;
  const parts = String(shift.duration || '').split(':').map(Number);
  if (parts.length === 3 && parts.every((part) => Number.isFinite(part))) return ((parts[0] * 3600) + (parts[1] * 60) + parts[2]) * 1000;
  if (parts.length === 2 && parts.every((part) => Number.isFinite(part))) return ((parts[0] * 60) + parts[1]) * 1000;
  return 0;
}

function dateLabel(date: string) {
  const parsed = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return date;
  const formatted = new Intl.DateTimeFormat('ro-RO', { timeZone: 'Europe/Bucharest', weekday: 'long', day: '2-digit', month: '2-digit' }).format(parsed);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function shiftMemberBlocks(shifts: any[]) {
  const grouped = new Map<string, { name: string; totalMs: number; dates: Map<string, number> }>();
  for (const shift of shifts) {
    const key = String(shift.discord_id || shift.colleague_name || 'unknown');
    const durationMs = shiftDurationMs(shift);
    const current = grouped.get(key) || { name: shift.colleague_name || 'Membru necunoscut', totalMs: 0, dates: new Map<string, number>() };
    current.totalMs += durationMs;
    current.dates.set(String(shift.date || ''), (current.dates.get(String(shift.date || '')) || 0) + durationMs);
    grouped.set(key, current);
  }
  return [...grouped.values()]
    .sort((left, right) => left.name.localeCompare(right.name, 'ro'))
    .map((member) => [
      member.name,
      ...[...member.dates.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([date, durationMs]) => `  ${dateLabel(date)} — ${formatDuration(Math.floor(durationMs / 1000))}`),
      `  Total săptămână — ${formatDuration(Math.floor(member.totalMs / 1000))}`,
    ].join('\n'));
}

function shiftEmbedDescription(shifts: any[], label: string, maxLength = 3500) {
  const lines = shiftMemberBlocks(shifts);
  const totalMs = shifts.reduce((sum, shift) => sum + shiftDurationMs(shift), 0);
  const header = `Total ore ${label.toLowerCase()}: **${formatDuration(Math.floor(totalMs / 1000))}**\nMembri: **${new Set(shifts.map((shift: any) => String(shift.discord_id || shift.colleague_name || ''))).size}**`;
  let content = '';
  let shown = 0;
  for (const block of lines) {
    if (content && content.length + block.length + 2 > maxLength) break;
    if (!content && block.length > maxLength) break;
    content += `${content ? '\n\n' : ''}${block}`;
    shown += 1;
  }
  const remaining = lines.length - shown;
  if (remaining > 0) content += `${content ? '\n\n' : ''}…și încă ${remaining} membri.`;
  return `${header}\n\n\`\`\`text\n${content || 'Nicio tură în această categorie.'}\n\`\`\``;
}

async function claimRun(db: any, organizationId: string, periodStart: string, periodEnd: string) {
  const now = new Date().toISOString();
  const base = {
    report_key: 'weekly_shift_report',
    organization_id: organizationId,
    period_start: periodStart,
    period_end: periodEnd,
  };

  const { data: existing, error: readError } = await db
    .from('scheduled_report_runs')
    .select('id,status,updated_at')
    .match(base)
    .maybeSingle();
  if (readError) throw readError;

  if (!existing) {
    const { data: created, error: insertError } = await db
      .from('scheduled_report_runs')
      .insert({ ...base, status: 'processing', updated_at: now })
      .select('id')
      .maybeSingle();
    if (!insertError) return created?.id || null;
    if (insertError.code !== '23505') throw insertError;
    return null;
  }

  if (['sent', 'skipped'].includes(existing.status)) return null;
  const updatedAt = Date.parse(String(existing.updated_at || ''));
  if (Number.isFinite(updatedAt) && Date.now() - updatedAt < 10 * 60 * 1000) return null;

  const { data: reclaimed, error: reclaimError } = await db
    .from('scheduled_report_runs')
    .update({ status: 'processing', error: null, updated_at: now })
    .eq('id', existing.id)
    .select('id')
    .maybeSingle();
  if (reclaimError) throw reclaimError;
  return reclaimed?.id || null;
}

async function finishRun(db: any, runId: string, status: string, error: string | null = null) {
  await db.from('scheduled_report_runs').update({
    status,
    error: error ? error.slice(0, 1000) : null,
    sent_at: status === 'sent' ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  }).eq('id', runId);
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return reply({ error: 'Metodă invalidă.' }, 405);

  try {
    const body = await request.json().catch(() => ({}));
    const now = new Date();
    const parts = romanianDateParts(now);
    const forced = body?.force === true;
    if (!forced && (parts.weekday !== 'Sun' || parts.hour !== 19 || parts.minute > 5)) {
      return reply({ ok: true, skipped: 'outside_schedule_window' });
    }

    const key = serviceKey();
    if (!key) throw new Error('Cheia secretă Supabase lipsește.');
    const db = createClient(Deno.env.get('SUPABASE_URL')!, key);
    const cronSecret = await getPlatformSecret(db, 'cron_secret');
    if (!cronSecret || request.headers.get('x-cron-secret') !== cronSecret) return reply({ error: 'Unauthorized' }, 401);
    const period = getWeeklyPeriod(now);
    const { data: organizations, error: organizationsError } = await db
      .from('organizations')
      .select('id,name')
      .eq('active', true)
      .order('name');
    if (organizationsError) throw organizationsError;

    const results = [];
    for (const organization of organizations || []) {
      const runId = await claimRun(db, String(organization.id), period.start, period.end);
      if (!runId) {
        results.push({ organization_id: organization.id, status: 'already_processed' });
        continue;
      }

      try {
        const [{ data: shifts, error: shiftsError }, { data: settings, error: settingsError }] = await Promise.all([
          db.from('shifts')
            .select('discord_id,colleague_name,date,shift_type,duration,duration_ms,created_at')
            .eq('organization_id', organization.id)
            .gte('date', period.start)
            .lte('date', period.end)
            .order('date', { ascending: false })
            .order('created_at', { ascending: false }),
          db.from('organization_settings')
            .select('webhook_routes,discord_channel_routes')
            .eq('organization_id', organization.id)
            .maybeSingle(),
        ]);
        if (shiftsError) throw shiftsError;
        if (settingsError) throw settingsError;

        if (!shifts?.length) {
          await finishRun(db, runId, 'skipped', 'Nu există ture în perioada raportată.');
          results.push({ organization_id: organization.id, status: 'skipped_no_shifts' });
          continue;
        }

        if (!routeCandidates(settings, 'weekly_reports').some((item) => item.candidates.length)) throw new Error('Canalul Discord al botului pentru rapoarte săptămânale nu este configurat.');

        const dayShifts = shifts.filter((shift: any) => String(shift.shift_type || '').toLowerCase() !== 'noapte');
        const nightShifts = shifts.filter((shift: any) => String(shift.shift_type || '').toLowerCase() === 'noapte');
        const embeds = [
          {
            title: `🔔 Raport Săptămânal · ☀️ Ture de zi · ${period.start} – ${period.end}`,
            description: `${organization.name ? `Organizație: **${organization.name}**\n\n` : ''}${shiftEmbedDescription(dayShifts, 'turele de zi')}`,
            color: 16766720,
            timestamp: now.toISOString(),
          },
          {
            title: `🔔 Raport Săptămânal · 🌙 Ture de noapte · ${period.start} – ${period.end}`,
            description: `${organization.name ? `Organizație: **${organization.name}**\n\n` : ''}${shiftEmbedDescription(nightShifts, 'turele de noapte')}`,
            color: 65535,
            timestamp: now.toISOString(),
          },
        ];

        const delivery = await deliverDiscordRoute(db, settings, 'weekly_reports', JSON.stringify({ allowed_mentions: { parse: [] }, embeds }));
        const failures: string[] = delivery.failures || [];
        if (!delivery.results.length) throw new Error(failures.join(' | ') || 'Discord nu a acceptat raportul.');
        await finishRun(db, runId, 'sent', failures.length ? `Unele canale Discord au eșuat: ${failures.join(' | ')}` : null);
        results.push({ organization_id: organization.id, status: failures.length ? 'sent_partial' : 'sent' });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Eroare necunoscută.';
        await finishRun(db, runId, 'failed', message);
        results.push({ organization_id: organization.id, status: 'failed', error: message });
      }
    }

    return reply({ ok: true, period, results });
  } catch (error) {
    return reply({ error: error instanceof Error ? error.message : 'Eroare internă.' }, 500);
  }
});
