import { getPlatformSecret } from './platform-secrets.ts';
import { requestDiscordTarget, routeCandidates, validDiscordChannelId } from './discord-delivery.ts';

const audienceLabels: Record<string, string> = {
  organization: 'Organizație',
  departments: 'Angajați',
};

const routeForAudience = (audience: string) => audience === 'organization' ? 'log_requests_organization' : 'log_requests_departments';

const dateLabel = (value: unknown) => {
  const date = new Date(String(value || ''));
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat('ro-RO', { timeZone: 'Europe/Bucharest', dateStyle: 'short', timeStyle: 'short' }).format(date)
    : '—';
};

const cleanText = (value: unknown, fallback = '—', max = 700) => String(value || '').trim().slice(0, max) || fallback;

function absencePayload(audience: string, rows: any[], now: Date) {
  const label = audienceLabels[audience] || audience;
  const lines = rows.slice(0, 35).map((row: any) => {
    const name = cleanText(row.colleague_name || row.discord_id, 'Utilizator', 180);
    const start = row.start_at || row.start_date;
    const end = row.end_at || row.end_date;
    const endTimestamp = Date.parse(String(end || ''));
    const remaining = Number.isFinite(endTimestamp) ? ` · ⏳ <t:${Math.floor(endTimestamp / 1000)}:R>` : '';
    return `**${name}**\n📅 ${dateLabel(start)} → ${dateLabel(end)}${remaining}\n💬 ${cleanText(row.reason || row.notes)}`;
  });
  const more = rows.length > 35 ? `\n\n… și încă ${rows.length - 35} învoiri active.` : '';
  const description = rows.length
    ? `Sunt **${rows.length}** persoane învoite acum.\n\n${lines.join('\n\n')}${more}`
    : 'Nu există persoane învoite în acest moment.';
  return {
    allowed_mentions: { parse: [] },
    embeds: [{
      title: `🟠 Învoiri active · ${label}`,
      description: description.slice(0, 4096),
      color: 0xf59e0b,
      timestamp: now.toISOString(),
      footer: { text: 'Panel Pro - By Little Mario' },
    }],
  };
}

async function saveLiveMessageId(db: any, organizationId: string, routeKey: string, target: string, messageId: string) {
  if (!validDiscordChannelId(messageId)) return;
  const { data: current, error: readError } = await db.from('organization_settings').select('discord_channel_routes').eq('organization_id', organizationId).maybeSingle();
  if (readError) throw readError;
  const routes = current?.discord_channel_routes && typeof current.discord_channel_routes === 'object' ? current.discord_channel_routes : {};
  const route = routes?.[routeKey] && typeof routes[routeKey] === 'object' ? routes[routeKey] : {};
  const targetConfig = route?.[target] && typeof route[target] === 'object' ? route[target] : {};
  const nextRoutes = { ...routes, [routeKey]: { ...route, [target]: { ...targetConfig, absence_live_message_id: messageId } } };
  const { error } = await db.from('organization_settings').update({ discord_channel_routes: nextRoutes, updated_at: new Date().toISOString() }).eq('organization_id', organizationId);
  if (error) throw error;
}

async function syncAudience(db: any, organizationId: string, settings: any, audience: string, now: Date) {
  const routeKey = routeForAudience(audience);
  const { data, error } = await db.from('absences')
    .select('id,discord_id,colleague_name,notice_type,reason,notes,start_at,end_at,start_date,end_date,status,request_audience')
    .eq('organization_id', organizationId)
    .gte('end_at', now.toISOString())
    .order('end_at', { ascending: true })
    .order('start_at', { ascending: true })
    .limit(200);
  if (error) throw error;
  const rows = (data || []).filter((row: any) => {
    const requestedAudience = String(row.request_audience || 'organization');
    const status = String(row.status || '').toLowerCase();
    return requestedAudience === audience && !['rejected', 'deleted', 'archived', 'cancelled'].includes(status) && (!row.start_at || Date.parse(String(row.start_at)) <= now.getTime());
  });
  const payload = absencePayload(audience, rows, now);
  const route = settings?.discord_channel_routes?.[routeKey] || {};
  const results: any[] = [];
  for (const { target, candidates } of routeCandidates(settings, routeKey)) {
    const candidate = candidates[0];
    if (!candidate) continue;
    const savedId = String(route?.[target]?.absence_live_message_id || '').trim();
    let response = await requestDiscordTarget(db, candidate, JSON.stringify(payload), { messageId: validDiscordChannelId(savedId) ? savedId : undefined });
    let recreated = false;
    if (!response.ok && response.status === 404 && validDiscordChannelId(savedId)) {
      response = await requestDiscordTarget(db, candidate, JSON.stringify(payload), { method: 'POST' });
      recreated = response.ok;
    }
    if (!response.ok) throw new Error(`Discord ${routeKey}/${target} HTTP ${response.status}.`);
    const body = await response.json().catch(() => ({}));
    const messageId = String(body?.id || savedId || '').trim();
    if (validDiscordChannelId(messageId) && messageId !== savedId) await saveLiveMessageId(db, organizationId, routeKey, target, messageId);
    results.push({ audience, target, message_id: messageId, count: rows.length, recreated });
  }
  return { audience, count: rows.length, results };
}

export async function syncAbsenceLiveEmbeds(db: any, organizationId: string, settings: any = null, audience = '') {
  const { data: loadedSettings, error } = settings ? { data: settings, error: null } : await db.from('organization_settings').select('discord_channel_routes').eq('organization_id', organizationId).maybeSingle();
  if (error) throw error;
  const currentSettings = loadedSettings || {};
  const now = new Date();
  const audiences = audience === 'organization' || audience === 'departments' ? [audience] : ['organization', 'departments'];
  const results = [];
  for (const item of audiences) results.push(await syncAudience(db, organizationId, currentSettings, item, now));
  return { organization_id: organizationId, updated_at: now.toISOString(), results };
}

export async function isAbsenceCronAuthorized(db: any, request: Request) {
  const received = String(request.headers.get('x-cron-secret') || '').trim();
  if (!received) return false;
  const [cronSecret, legacySecret] = await Promise.all([getPlatformSecret(db, 'cron_secret'), getPlatformSecret(db, 'status_live_cron_secret')]);
  return Boolean(received && (received === cronSecret || received === legacySecret));
}
