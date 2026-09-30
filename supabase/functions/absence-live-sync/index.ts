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
        results.push(await syncAbsenceLiveEmbeds(db, String(organization.id), undefined, panelAudience));
      } catch (error) {
        results.push({ organization_id: organization.id, error: error instanceof Error ? error.message : 'Sincronizarea a eșuat.' });
      }
    }
    const failures = results.filter((item: any) => item?.error);
    if (failures.length) return reply({ ok: false, error: failures.map((item: any) => item.error).join(' | '), organizations: results.length, results }, 502);
    return reply({ ok: true, organizations: results.length, results });
  } catch (error) {
    return reply({ error: error instanceof Error ? error.message : 'Sincronizarea învoirilor a eșuat.' }, 500);
  }
});
