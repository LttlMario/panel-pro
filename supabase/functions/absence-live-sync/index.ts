import { createClient } from 'jsr:@supabase/supabase-js@2.112.3';
import { isAbsenceCronAuthorized, syncAbsenceLiveEmbeds } from '../_shared/absence-live.ts';
import { requirePanelSession } from '../_shared/panel-session.ts';

const headers = {
  'Access-Control-Allow-Origin': 'https://panel-pro.ro',
  'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-cron-secret,x-panel-session,x-panel-device',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Content-Type': 'application/json',
};
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers });
const errorText = (error: unknown) => {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === 'object') {
    const value = error as Record<string, unknown>;
    if (String(value.message || '').trim()) return String(value.message).trim();
    if (String(value.details || '').trim()) return String(value.details).trim();
    if (String(value.hint || '').trim()) return String(value.hint).trim();
    try { return JSON.stringify(error); } catch (_) {}
  }
  return String(error || 'Sincronizarea învoirilor a eșuat.');
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return reply({ error: 'Metodă invalidă.' }, 405);
  try {
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default;
    if (!key) return reply({ error: 'Cheia secretă Supabase lipsește.' }, 500);
    const db = createClient(Deno.env.get('SUPABASE_URL')!, key);
    const body = await request.json().catch(() => ({}));
    const requestedOrganization = String(body.organization_id || '').trim();
    const cronAuthorized = await isAbsenceCronAuthorized(db, request);
    const requestedRoutes = body.discord_channel_routes && typeof body.discord_channel_routes === 'object' && !Array.isArray(body.discord_channel_routes)
      ? { discord_channel_routes: body.discord_channel_routes }
      : undefined;
    let organizations;
    let panelAudience = body.audience === 'departments' ? 'departments' : body.audience === 'organization' ? 'organization' : undefined;
    if (cronAuthorized) {
      organizations = requestedOrganization
        ? [{ id: requestedOrganization }]
        : (await db.from('organizations').select('id').eq('active', true)).data || [];
    } else {
      const session = await requirePanelSession(db, request, 0);
      if (requestedOrganization && requestedOrganization !== session.organization_id) return reply({ error: 'Organizația solicitată nu corespunde sesiunii active.' }, 403);
      organizations = [{ id: session.organization_id }];
    }
    const results = [];
    for (const organization of organizations) {
      try {
        results.push(await syncAbsenceLiveEmbeds(db, String(organization.id), cronAuthorized ? undefined : requestedRoutes, panelAudience));
      } catch (error) {
        results.push({ organization_id: organization.id, error: errorText(error) });
      }
    }
    const failures = results.filter((item: any) => item?.error);
    if (failures.length) return reply({ ok: false, error: failures.map((item: any) => item.error).join(' | '), organizations: results.length, results }, 502);
    return reply({ ok: true, organizations: results.length, results });
  } catch (error) {
    console.error('[absence-live-sync]', error);
    return reply({ error: errorText(error) }, 500);
  }
});
