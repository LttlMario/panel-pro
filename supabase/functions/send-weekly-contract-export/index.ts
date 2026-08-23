import { createClient } from 'jsr:@supabase/supabase-js@2.112.3';
import { getPlatformSecret } from '../_shared/platform-secrets.ts';

const headers = {
  'Access-Control-Allow-Origin': 'https://lttlmario.github.io',
  'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers });
const serviceKey = () => Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default;

function localParts(date = new Date()) {
  const values = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Bucharest', weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(date).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  return { weekday: values.weekday, year: Number(values.year), month: Number(values.month), day: Number(values.day), hour: Number(values.hour) };
}

function getPeriod(now = new Date()) {
  const parts = localParts(now);
  const end = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 6);
  const next = new Date(end);
  next.setUTCDate(next.getUTCDate() + 1);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10), startIso: start.toISOString(), nextIso: next.toISOString() };
}

async function claimRun(db: any, organizationId: string, period: any) {
  const base = { report_key: 'weekly_contract_identity', organization_id: organizationId, period_start: period.start, period_end: period.end };
  const { data: existing, error: readError } = await db.from('scheduled_report_runs').select('id,status,updated_at').match(base).maybeSingle();
  if (readError) throw readError;
  if (!existing) {
    const { data: created, error } = await db.from('scheduled_report_runs').insert({ ...base, status: 'processing', updated_at: new Date().toISOString() }).select('id').maybeSingle();
    if (!error) return created?.id || null;
    if (error.code !== '23505') throw error;
    return null;
  }
  if (['sent', 'skipped'].includes(existing.status)) return null;
  const updated = Date.parse(String(existing.updated_at || ''));
  if (Number.isFinite(updated) && Date.now() - updated < 10 * 60 * 1000) return null;
  const { data: reclaimed, error } = await db.from('scheduled_report_runs').update({ status: 'processing', error: null, updated_at: new Date().toISOString() }).eq('id', existing.id).select('id').maybeSingle();
  if (error) throw error;
  return reclaimed?.id || null;
}

async function finishRun(db: any, id: string, status: string, error: string | null = null) {
  await db.from('scheduled_report_runs').update({ status, error: error?.slice(0, 1000) || null, sent_at: status === 'sent' ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq('id', id);
}

async function discordMemberState(guildId: string, discordId: string, botToken: string) {
  const response = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${discordId}`, { headers: { Authorization: `Bot ${botToken}` } });
  if (response.ok) return true;
  if (response.status === 404) return false;
  return null;
}

async function refreshDiscordEmployees(db: any, organization: any, botToken: string) {
  const [{ data: guilds, error: guildError }, { data: employees, error: employeeError }] = await Promise.all([
    db.from('organization_guilds').select('guild_id').eq('organization_id', organization.id).eq('enabled', true),
    db.from('organization_employees').select('id,discord_id,status').eq('organization_id', organization.id).eq('status', 'active').not('discord_id', 'is', null),
  ]);
  if (guildError) throw guildError;
  if (employeeError) throw employeeError;
  const guildIds = (guilds || []).map((guild: any) => String(guild.guild_id)).filter(Boolean);
  if (!guildIds.length) return;
  for (const employee of employees || []) {
    let found = false;
    let known = false;
    for (const guildId of guildIds) {
      const state = await discordMemberState(guildId, String(employee.discord_id), botToken);
      if (state === true) found = true;
      if (state !== null) known = true;
      if (found) break;
    }
    if (!known) continue;
    const now = new Date().toISOString();
    await db.from('organization_employees').update(found ? { last_discord_seen_at: now, updated_at: now } : { status: 'inactive', left_at: now, updated_at: now }).eq('id', employee.id);
    if (!found) await db.from('organization_members').update({ active: false, last_verified_at: now }).eq('organization_id', organization.id).eq('discord_id', employee.discord_id);
  }
}

function webhookUrls(settings: any) {
  const route = settings?.webhook_routes?.contract_identity_weekly || {};
  return [...new Set([route?.primary?.url, route?.secondary?.url].map(String).map((value) => value.trim()).filter(Boolean))];
}

function chunks(lines: string[], maxLength = 1800) {
  const result: string[] = [];
  let current = '';
  for (const line of lines) {
    if (current && current.length + line.length + 1 > maxLength) { result.push(current); current = ''; }
    current += `${current ? '\n' : ''}${line}`;
  }
  if (current) result.push(current);
  return result;
}

function contractEmbedBlock(title: string, employees: any[], maxLength = 1500) {
  const lines = employees.map((employee: any) => `${employee.full_name}\t${employee.cnp}`);
  let content = '';
  let shown = 0;
  for (const line of lines) {
    if (content && content.length + line.length + 1 > maxLength) break;
    if (!content && line.length > maxLength) break;
    content += `${content ? '\n' : ''}${line}`;
    shown += 1;
  }
  const remaining = lines.length - shown;
  if (remaining > 0) content += `${content ? '\n' : ''}…și încă ${remaining} angajați.`;
  return `${title}\n\`\`\`text\n${content || 'Niciun angajat în această categorie.'}\n\`\`\``;
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
    const now = new Date();
    const period = getPeriod(now);
    const forced = (await request.json().catch(() => ({})))?.force === true;
    const parts = localParts(now);
    if (!forced && (parts.weekday !== 'Sun' || parts.hour !== 19)) return reply({ ok: true, skipped: 'outside_weekly_schedule' });

    const botToken = await getPlatformSecret(db, 'discord_bot_token');
    const { data: organizations, error: organizationsError } = await db.from('organizations').select('id,name').eq('active', true).order('name');
    if (organizationsError) throw organizationsError;
    const results = [];
    for (const organization of organizations || []) {
      const runId = await claimRun(db, organization.id, period);
      if (!runId) { results.push({ organization_id: organization.id, status: 'already_processed' }); continue; }
      try {
        if (botToken) await refreshDiscordEmployees(db, organization, botToken);
        const [{ data: settings, error: settingsError }, { data: contracts, error: contractsError }] = await Promise.all([
          db.from('organization_settings').select('webhook_routes').eq('organization_id', organization.id).maybeSingle(),
          db.from('organization_contracts').select('employee_id,created_at').eq('organization_id', organization.id).gte('created_at', period.startIso).lt('created_at', period.nextIso).order('created_at'),
        ]);
        if (settingsError) throw settingsError;
        if (contractsError) throw contractsError;
        const webhooks = webhookUrls(settings);
        if (!webhooks.length) throw new Error('Webhookul săptămânal pentru nume și CNP nu este configurat.');
        const employeeIds = [...new Set((contracts || []).map((contract: any) => String(contract.employee_id)))];
        const { data: employees, error: employeesError } = employeeIds.length
          ? await db.from('organization_employees').select('id,full_name,cnp,status').in('id', employeeIds)
          : { data: [], error: null };
        if (employeesError) throw employeesError;
        const employeeMap = new Map((employees || []).map((employee: any) => [String(employee.id), employee]));
        const unique = new Map<string, any>();
        for (const contract of contracts || []) {
          const employee = employeeMap.get(String(contract.employee_id));
          if (employee && !unique.has(String(employee.cnp))) unique.set(String(employee.cnp), employee);
        }
        if (!unique.size) { await finishRun(db, runId, 'skipped', 'Nu există contracte noi în perioada raportată.'); results.push({ organization_id: organization.id, status: 'skipped_no_contracts' }); continue; }

        const previousBatchesResult = await db.from('contract_export_batches')
          .select('id')
          .eq('organization_id', organization.id)
          .eq('status', 'completed')
          .in('export_type', ['manual', 'weekly_discord']);
        if (previousBatchesResult.error) throw previousBatchesResult.error;
        const previousBatchIds = (previousBatchesResult.data || []).map((batch: any) => String(batch.id));
        const previousItemsResult = previousBatchIds.length
          ? await db.from('contract_export_items').select('employee_id').in('batch_id', previousBatchIds).in('employee_id', [...unique.values()].map((employee: any) => employee.id))
          : { data: [], error: null };
        if (previousItemsResult.error) throw previousItemsResult.error;
        const previouslyReported = new Set((previousItemsResult.data || []).map((item: any) => String(item.employee_id)));
        const uniqueEmployees = [...unique.values()];
        const activeNew = uniqueEmployees.filter((employee: any) => employee.status !== 'inactive' && !previouslyReported.has(String(employee.id)));
        const activePrevious = uniqueEmployees.filter((employee: any) => employee.status !== 'inactive' && previouslyReported.has(String(employee.id)));
        const inactive = uniqueEmployees.filter((employee: any) => employee.status === 'inactive');

        const { data: batch, error: batchError } = await db.from('contract_export_batches').insert({ organization_id: organization.id, export_type: 'weekly_discord', status: 'processing', period_start: period.start, period_end: period.end }).select('id').single();
        if (batchError) throw batchError;
        const exportItems = [...unique.values()].map((employee: any) => ({ batch_id: batch.id, employee_id: employee.id, full_name: employee.full_name, cnp: employee.cnp }));
        const { error: itemError } = await db.from('contract_export_items').insert(exportItems);
        if (itemError) throw itemError;
        const activeDescription = [
          organization.name ? `Organizație: **${organization.name}**` : '',
          contractEmbedBlock('🆕 Activi · fără raport anterior', activeNew),
          contractEmbedBlock('🔁 Activi · raportați anterior', activePrevious),
        ].filter(Boolean).join('\n\n');
        const inactiveDescription = [
          organization.name ? `Organizație: **${organization.name}**` : '',
          contractEmbedBlock('🔴 Plecați / demisionați', inactive, 3300),
        ].filter(Boolean).join('\n\n');
        const embeds = [
          { title: `📋 Export săptămânal · Angajați activi · ${period.start} – ${period.end}`, description: activeDescription, color: 5763719, timestamp: now.toISOString() },
          { title: `📋 Export săptămânal · Plecați / demisionați · ${period.start} – ${period.end}`, description: inactiveDescription, color: 15548997, timestamp: now.toISOString() },
        ];
        const failures: string[] = [];
        for (const webhook of webhooks) {
          try {
            const response = await fetch(webhook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ allowed_mentions: { parse: [] }, embeds }) });
            if (!response.ok) failures.push(`Discord HTTP ${response.status}`);
          } catch (error) { failures.push(error instanceof Error ? error.message : 'Eroare Discord.'); }
        }
        if (failures.length === webhooks.length) throw new Error(failures.join(' | '));
        await db.from('contract_export_batches').update({ status: 'completed', row_count: exportItems.length, completed_at: new Date().toISOString(), error: failures.length ? failures.join(' | ') : null }).eq('id', batch.id);
        await finishRun(db, runId, 'sent', failures.length ? failures.join(' | ') : null);
        results.push({ organization_id: organization.id, status: failures.length ? 'sent_partial' : 'sent', row_count: exportItems.length });
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
