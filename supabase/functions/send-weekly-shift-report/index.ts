import { createClient } from 'jsr:@supabase/supabase-js@2.112.3';

const headers = {
  'Access-Control-Allow-Origin': 'https://lttlmario.github.io',
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

function getWeeklyReportWebhookUrls(settings: Record<string, any> | null) {
  // Rapoartele folosesc configurarea organizației; nu depind de un fallback global opțional.
  const route = settings?.webhook_routes?.weekly_reports || {};
  return [...new Set([
    route?.primary?.url,
    route?.secondary?.url,
  ].map((value) => String(value || '').trim()).filter(Boolean))];
}

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600).toString().padStart(2, '0');
  const minutes = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
  const rest = (seconds % 60).toString().padStart(2, '0');
  return `${hours}:${minutes}:${rest}`;
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

  const cronSecret = String(Deno.env.get('CRON_SECRET') || '').trim();
  if (!cronSecret || request.headers.get('x-cron-secret') !== cronSecret) {
    return reply({ error: 'Unauthorized' }, 401);
  }

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
            .select('webhook_routes')
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

        const webhooks = getWeeklyReportWebhookUrls(settings);
        if (!webhooks.length) throw new Error('Webhook-ul pentru rapoarte săptămânale nu este configurat.');

        const totalMs = shifts.reduce((sum: number, shift: any) => sum + (Number(shift.duration_ms) || 0), 0);
        const uniqueMembers = new Set(shifts.map((shift: any) => String(shift.discord_id || shift.colleague_name || ''))).size;
        let sample = shifts.slice(0, 10).map((shift: any) =>
          `• **${shift.colleague_name || 'Membru necunoscut'}** (${String(shift.shift_type || 'tură').toUpperCase()}) - ${shift.date} [**${shift.duration || formatDuration(Math.floor(Number(shift.duration_ms || 0) / 1000))}**]`
        ).join('\n');
        if (shifts.length > 10) sample += `\n...și încă ${shifts.length - 10} înregistrări.`;

        const payload = JSON.stringify({
          allowed_mentions: { parse: [] },
          embeds: [{
            title: `🔔 Raport Săptămânal (${period.start} – ${period.end})`,
            description: organization.name ? `Organizație: **${organization.name}**` : undefined,
            color: 3447003,
            fields: [
              { name: '📈 Total Ture', value: String(shifts.length), inline: true },
              { name: '⏱️ Total Ore Lucrate', value: `**${(totalMs / 3600000).toFixed(2)}h**`, inline: true },
              { name: '👥 Membri Contorizați', value: String(uniqueMembers), inline: true },
              { name: '📋 Ture din Raport', value: sample || 'Nicio tură', inline: false },
            ],
            timestamp: now.toISOString(),
          }],
        });

        const failures: string[] = [];
        for (const webhook of webhooks) {
          try {
            const response = await fetch(webhook, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: payload,
            });
            if (!response.ok) {
              const details = (await response.text()).slice(0, 300);
              failures.push(`Discord HTTP ${response.status}${details ? `: ${details}` : ''}`);
            }
          } catch (error) {
            failures.push(error instanceof Error ? error.message : 'Eroare Discord necunoscută.');
          }
        }

        if (failures.length === webhooks.length) throw new Error(failures.join(' | '));
        await finishRun(db, runId, 'sent', failures.length ? `Unele webhook-uri au eșuat: ${failures.join(' | ')}` : null);
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
