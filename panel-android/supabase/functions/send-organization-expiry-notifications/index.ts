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
const DAY_MS = 24 * 60 * 60 * 1000;
const THRESHOLDS = [7, 3, 1];
const DEFAULT_PANEL_URL = 'https://panel-pro.ro';

function serviceKey() {
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default;
}

function panelBaseUrl(settings: any) {
  const configured = String(settings?.panel_public_url || '').trim().replace(/\/+$/, '');
  if (!configured) return DEFAULT_PANEL_URL;
  try {
    const url = new URL(configured);
    if (url.protocol !== 'https:') return DEFAULT_PANEL_URL;
    return configured;
  } catch {
    return DEFAULT_PANEL_URL;
  }
}

function links(settings: any) {
  const base = panelBaseUrl(settings);
  return {
    administration: `${base}/administrare-organizatie.html`,
    voucher: `${base}/prelungire-voucher.html`,
  };
}

function formattedDate(value: string) {
  return new Intl.DateTimeFormat('ro-RO', {
    timeZone: 'Europe/Bucharest',
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(new Date(value));
}

async function claimRun(db: any, organizationId: string, expiresAt: string, thresholdDays: number) {
  const base = { organization_id: organizationId, expires_at: expiresAt, threshold_days: thresholdDays };
  const { data: existing, error: readError } = await db
    .from('organization_expiration_notifications')
    .select('id,status,updated_at')
    .match(base)
    .maybeSingle();
  if (readError) throw readError;
  if (existing && ['sent', 'skipped'].includes(existing.status)) return null;

  if (existing) {
    const updatedAt = Date.parse(String(existing.updated_at || ''));
    if (existing.status === 'processing' && Number.isFinite(updatedAt) && Date.now() - updatedAt < 10 * 60 * 1000) return null;
    const { data: reclaimed, error: reclaimError } = await db
      .from('organization_expiration_notifications')
      .update({ status: 'processing', error: null, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
      .select('id')
      .maybeSingle();
    if (reclaimError) throw reclaimError;
    return reclaimed?.id || null;
  }

  const { data: created, error: insertError } = await db
    .from('organization_expiration_notifications')
    .insert({ ...base, status: 'processing', updated_at: new Date().toISOString() })
    .select('id')
    .maybeSingle();
  if (!insertError) return created?.id || null;
  if (insertError.code === '23505') return null;
  throw insertError;
}

async function finishRun(db: any, id: string, status: string, error: string | null = null) {
  await db.from('organization_expiration_notifications').update({
    status,
    error: error ? error.slice(0, 1000) : null,
    sent_at: status === 'sent' ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  }).eq('id', id);
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
    const now = Date.now();
    const { data: organizations, error: organizationsError } = await db
      .from('organizations')
      .select('id,name,active')
      .eq('active', true)
      .order('name');
    if (organizationsError) throw organizationsError;

    const ids = (organizations || []).map((organization: any) => organization.id);
    if (!ids.length) return reply({ ok: true, sent: 0, skipped: 0, results: [] });

    const [accessResult, packageResult, settingsResult] = await Promise.all([
      db.from('app_settings').select('organization_id,value').in('organization_id', ids).eq('key', 'organization_access'),
      db.from('app_settings').select('organization_id,value').in('organization_id', ids).eq('key', 'organization_package'),
      db.from('organization_settings').select('organization_id,panel_public_url,webhook_routes,discord_channel_routes').in('organization_id', ids),
    ]);
    for (const result of [accessResult, packageResult, settingsResult]) if (result.error) throw result.error;

    const accessByOrg = new Map((accessResult.data || []).map((row: any) => [String(row.organization_id), row.value || {}]));
    const packageByOrg = new Map((packageResult.data || []).map((row: any) => [String(row.organization_id), row.value || {}]));
    const settingsByOrg = new Map((settingsResult.data || []).map((row: any) => [String(row.organization_id), row]));
    const results = [];
    let sent = 0;
    let skipped = 0;

    for (const organization of organizations || []) {
      const organizationId = String(organization.id);
      const expiresAt = String(accessByOrg.get(organizationId)?.expires_at || '').trim();
      const expiresAtMs = Date.parse(expiresAt);
      if (!expiresAt || !Number.isFinite(expiresAtMs) || expiresAtMs <= now) {
        skipped++;
        continue;
      }

      const daysRemaining = Math.ceil((expiresAtMs - now) / DAY_MS);
      const thresholdDays = THRESHOLDS.find((threshold) => threshold === daysRemaining);
      if (!thresholdDays) {
        skipped++;
        continue;
      }

      const settings = settingsByOrg.get(organizationId) || {};
      if (!routeCandidates(settings, 'organization_expiration').some((item) => item.candidates.length)) {
        results.push({ organization_id: organizationId, status: 'skipped_no_destination', days_remaining: daysRemaining });
        skipped++;
        continue;
      }

      const runId = await claimRun(db, organizationId, new Date(expiresAtMs).toISOString(), thresholdDays);
      if (!runId) {
        results.push({ organization_id: organizationId, status: 'already_processed', days_remaining: daysRemaining });
        continue;
      }

      try {
        const name = String(organization.name || 'Organizația ta');
        const packageCode = String(packageByOrg.get(organizationId)?.code || 'standard').toUpperCase();
        const expiryLabel = formattedDate(expiresAt);
        const remainingLabel = thresholdDays === 1 ? '1 zi' : `${thresholdDays} zile`;
        const title = thresholdDays === 1 ? '⚠️ Organizația expiră mâine' : `⏳ Organizația expiră în ${remainingLabel}`;
        const actionLinks = links(settings);
        const payload = JSON.stringify({
          allowed_mentions: { parse: [] },
          embeds: [{
            title,
            description: `Organizația **${name}** mai are **${remainingLabel}** de acces activ în panel.`,
            color: thresholdDays === 1 ? 15158332 : 16753920,
            fields: [
              { name: '📦 Pachet', value: packageCode, inline: true },
              { name: '📅 Expiră la', value: expiryLabel, inline: true },
              { name: '🔗 Acțiuni', value: `[Administrare organizație](${actionLinks.administration})\n[Activare / prelungire voucher](${actionLinks.voucher})`, inline: false },
            ],
            footer: { text: 'Panel Pro · notificare automată de expirare' },
            timestamp: new Date().toISOString(),
          }],
        });

        const delivery = await deliverDiscordRoute(db, settings, 'organization_expiration', payload);
        const failures: string[] = delivery.failures || [];
        if (!delivery.results.length) throw new Error(failures.join(' | ') || 'Discord nu a acceptat notificarea.');
        await finishRun(db, runId, 'sent', failures.length ? `Unele webhook-uri au eșuat: ${failures.join(' | ')}` : null);
        sent++;
        results.push({ organization_id: organizationId, status: failures.length ? 'sent_partial' : 'sent', days_remaining: daysRemaining });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Eroare necunoscută.';
        await finishRun(db, runId, 'failed', message);
        results.push({ organization_id: organizationId, status: 'failed', error: message });
      }
    }

    return reply({ ok: true, sent, skipped, results });
  } catch (error) {
    return reply({ error: error instanceof Error ? error.message : 'Eroare internă.' }, 500);
  }
});
