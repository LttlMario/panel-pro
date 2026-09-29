import { createClient } from 'jsr:@supabase/supabase-js@2.112.3';
import { getPlatformSecret } from '../_shared/platform-secrets.ts';
import { corsOptions, getCorsHeaders } from '../_shared/cors.ts';

const reply = (request: Request, data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: getCorsHeaders(request) });
const serviceKey = () => {
  const direct = String(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '').trim();
  if (direct) return direct;
  try { return String(JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default || '').trim(); } catch (_) { return ''; }
};
const validId = (value: unknown) => /^\d{15,22}$/.test(String(value || '').trim());
const errorText = (value: any) => String(value?.message || value?.details || value || 'Eroare necunoscută.').slice(0, 500);

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return corsOptions(request);
  if (request.method !== 'POST') return reply(request, { error: 'Metodă invalidă.' }, 405);
  try {
    const key = serviceKey();
    if (!key) throw new Error('Cheia secretă Supabase lipsește.');
    const db = createClient(Deno.env.get('SUPABASE_URL')!, key);
    const body = await request.json().catch(() => ({}));
    const configuredSecret = await getPlatformSecret(db, 'cron_secret');
    if (!configuredSecret || String(request.headers.get('x-cron-secret') || '').trim() !== configuredSecret || String(body.action || 'check') !== 'check') return reply(request, { error: 'Acces neautorizat.' }, 401);
    const bot = await getPlatformSecret(db, 'discord_bot_token');
    if (!bot) throw new Error('Tokenul botului Discord lipsește.');
    const { data: organizations, error: organizationsError } = await db.from('organizations').select('id').eq('active', true);
    const organizationIds = (organizations || []).map((item: any) => item.id);
    const { data: settingsRows, error: settingsError } = organizationIds.length
      ? await db.from('organization_settings').select('organization_id,discord_channel_routes').in('organization_id', organizationIds)
      : { data: [], error: null };
    if (organizationsError || settingsError) throw organizationsError || settingsError;
    const settingsMap = new Map((settingsRows || []).map((row: any) => [String(row.organization_id), row.discord_channel_routes || {}]));
    const checkedAt = new Date().toISOString();
    const results: any[] = [];
    for (const organization of organizations || []) {
      const routes = settingsMap.get(String(organization.id)) || {};
      const entries: any[] = [];
      for (const [routeKey, route] of Object.entries(routes)) {
        for (const target of ['primary', 'secondary']) {
          const item = (route as any)?.[target];
          if (!item?.enabled) continue;
          entries.push({ route_key: routeKey, target, channel_id: String(item.channel_id || '').trim() });
        }
      }
      const unique = [...new Set(entries.map((entry) => entry.channel_id).filter(validId))];
      const statuses = new Map<string, any>();
      await Promise.all(unique.map(async (channelId) => {
        try {
          const response = await fetch(`https://discord.com/api/v10/channels/${channelId}`, { headers: { Authorization: `Bot ${bot}`, 'User-Agent': 'Panel-Pro-Route-Health/1.0' } });
          const value = await response.json().catch(() => ({}));
          statuses.set(channelId, { ok: response.ok, name: String(value?.name || ''), error: response.ok ? '' : `Discord HTTP ${response.status}` });
        } catch (error) { statuses.set(channelId, { ok: false, name: '', error: errorText(error) }); }
      }));
      const checks = entries.map((entry) => ({ ...entry, status: !validId(entry.channel_id) ? 'invalid' : statuses.get(entry.channel_id)?.ok ? 'ok' : 'error', channel_name: statuses.get(entry.channel_id)?.name || '', error: !validId(entry.channel_id) ? 'Channel ID invalid.' : statuses.get(entry.channel_id)?.error || 'Canalul nu este accesibil.' }));
      const overall = !entries.length ? 'missing' : checks.every((check) => check.status === 'ok') ? 'ok' : 'error';
      await db.from('organizations').update({ last_discord_check_at: checkedAt, last_discord_check_status: overall, updated_at: checkedAt }).eq('id', organization.id);
      results.push({ organization_id: organization.id, status: overall, checks });
    }
    return reply(request, { ok: true, checked_at: checkedAt, organizations: results.length, results });
  } catch (error) { return reply(request, { error: errorText(error) }, 500); }
});
