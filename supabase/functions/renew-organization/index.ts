import { createClient } from 'jsr:@supabase/supabase-js@2.112.3';
import { requirePanelSession } from '../_shared/panel-session.ts';

const headers = {
  'Access-Control-Allow-Origin': 'https://lttlmario.github.io',
  'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-panel-session',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Max-Age': '86400',
  'Content-Type': 'application/json'
};

const reply = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers });

const getClientIp = (request: Request) => String(
  request.headers.get('cf-connecting-ip')
  || request.headers.get('x-forwarded-for')?.split(',')[0]
  || 'unknown'
).trim().slice(0, 120);

const readStatus = async (db: any, organizationId: string) => {
  const [{ data: organization, error: organizationError }, { data: settings, error: settingsError }] = await Promise.all([
    db.from('organizations')
      .select('id,name,active,lifecycle_status,grace_until')
      .eq('id', organizationId)
      .maybeSingle(),
    db.from('app_settings')
      .select('key,value')
      .eq('organization_id', organizationId)
      .in('key', ['organization_access', 'organization_package'])
  ]);

  if (organizationError) throw organizationError;
  if (settingsError) throw settingsError;
  if (!organization) return null;

  const values = Object.fromEntries((settings || []).map((item: any) => [item.key, item.value || {}]));
  const access = values.organization_access || {};
  const packageValue = values.organization_package || {};
  const expiresAt = String(access.expires_at || '').trim() || null;

  return {
    organization,
    access: {
      expires_at: expiresAt,
      unlimited: packageValue.unlimited === true,
      expired: Boolean(expiresAt && Date.parse(expiresAt) <= Date.now())
    },
    package: {
      code: packageValue.code === 'full' ? 'full' : 'standard',
      expires_at: packageValue.expires_at || expiresAt,
      unlimited: packageValue.unlimited === true
    }
  };
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers });
  if (request.method !== 'POST') return reply({ error: 'Metodă invalidă.' }, 405);

  try {
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
      || JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default;
    if (!key) throw new Error('Cheia secretă Supabase lipsește.');

    const db = createClient(Deno.env.get('SUPABASE_URL')!, key);
    const session = await requirePanelSession(db, request, 0, true);
    const organizationId = String(session.organization_id || '').trim();
    if (!organizationId) return reply({ error: 'Organizația activă lipsește.' }, 400);

    const { data: rateAllowed, error: rateError } = await db.rpc('consume_panel_rate_limit', {
      p_key: `organization-renewal:${organizationId}:${session.discord_id}:${getClientIp(request)}`,
      p_limit: 10,
      p_window_seconds: 900
    });
    if (rateError) return reply({ error: 'Protecția anti-abuz este temporar indisponibilă.' }, 503);
    if (rateAllowed === false) return reply({ error: 'Ai încercat prea des. Încearcă din nou peste câteva minute.' }, 429);

    const body = await request.json().catch(() => ({}));
    const action = String(body.action || 'status').trim();
    const before = await readStatus(db, organizationId);
    if (!before) return reply({ error: 'Organizația activă nu mai există.' }, 404);
    if (action === 'status') return reply({ ok: true, ...before });
    if (action !== 'redeem_voucher') return reply({ error: 'Acțiune necunoscută.' }, 400);

    const code = String(body.voucher_code || '').trim().toUpperCase();
    if (!/^[A-Z0-9-]{6,80}$/.test(code)) return reply({ error: 'Introdu un cod voucher valid.' }, 400);

    const [{ data: voucher, error: voucherError }, { data: guilds, error: guildError }] = await Promise.all([
      db.from('organization_vouchers')
        .select('id,code,guild_id,redeemed_at,revoked_at,expires_at')
        .eq('code', code)
        .maybeSingle(),
      db.from('organization_guilds')
        .select('guild_id')
        .eq('organization_id', organizationId)
        .eq('enabled', true)
    ]);
    if (voucherError) throw voucherError;
    if (guildError) throw guildError;
    if (!voucher || voucher.redeemed_at || voucher.revoked_at) return reply({ error: 'Voucher invalid, folosit sau revocat.' }, 409);
    if (voucher.expires_at && Date.parse(String(voucher.expires_at)) <= Date.now()) return reply({ error: 'Voucherul a expirat.' }, 400);

    const organizationGuildIds = new Set((guilds || []).map((item: any) => String(item.guild_id)));
    if (voucher.guild_id && !organizationGuildIds.has(String(voucher.guild_id))) {
      return reply({ error: 'Voucherul este destinat altui server Discord.' }, 403);
    }

    const { data: redeemedRows, error: redeemError } = await db.rpc('redeem_voucher_reactivate_organization', {
      p_code: code,
      p_discord_id: session.discord_id,
      p_organization_id: organizationId
    });
    if (redeemError) {
      const message = String(redeemError.message || 'Voucherul nu a putut fi aplicat.');
      return reply({ error: message }, redeemError.code === 'P0001' ? 409 : 500);
    }

    const redeemed = Array.isArray(redeemedRows) ? redeemedRows[0] : redeemedRows;
    if (!redeemed?.access_expires_at) return reply({ error: 'Voucherul nu a putut fi aplicat.' }, 500);

    const { error: auditError } = await db.from('admin_audit_log').insert({
      organization_id: organizationId,
      actor_discord_id: session.discord_id,
      action: 'organization_access_renewed_by_member',
      target_type: 'organization',
      target_id: organizationId,
      details: {
        voucher_id: voucher.id,
        added_days: redeemed.added_days,
        package_code: redeemed.package_code,
        expires_at: redeemed.access_expires_at
      }
    });
    if (auditError) throw auditError;

    const after = await readStatus(db, organizationId);
    return reply({ ok: true, added_days: redeemed.added_days, ...after });
  } catch (error) {
    console.error(error);
    return reply({ error: error instanceof Error ? error.message : 'Eroare internă.' }, 500);
  }
});
