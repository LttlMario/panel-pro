import { createClient } from 'jsr:@supabase/supabase-js@2.112.3';
import { requirePanelSession } from '../_shared/panel-session.ts';
import { getPlatformSecret } from '../_shared/platform-secrets.ts';

const headers = {
  'Access-Control-Allow-Origin': 'https://panel-pro.ro',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-panel-session',
  'Access-Control-Max-Age': '86400',
  'Content-Type': 'application/json',
};
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers });
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const serviceKey = () => Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  || JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default;

const discordGuild = async (guildId: string, botToken: string) => {
  const response = await fetch(`https://discord.com/api/v10/guilds/${guildId}`, {
    headers: { Authorization: `Bot ${botToken}`, 'User-Agent': 'PanelManagement/1.0 (+https://panel-pro.ro)' },
  });
  if (!response.ok) return null;
  return await response.json();
};

const discordMember = async (guildId: string, discordId: string, botToken: string, accessToken = '') => {
  if (accessToken) {
    const oauthResponse = await fetch(`https://discord.com/api/v10/users/@me/guilds/${guildId}/member`, {
      headers: { Authorization: `Bearer ${accessToken}`, 'User-Agent': 'PanelManagement/1.0 (+https://panel-pro.ro)' },
    });
    if (oauthResponse.ok) return true;
  }
  const botResponse = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${discordId}`, {
    headers: { Authorization: `Bot ${botToken}`, 'User-Agent': 'PanelManagement/1.0 (+https://panel-pro.ro)' },
  });
  return botResponse.ok;
};

const requestIp = (request: Request) => String(
  request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'unknown'
).split(',')[0].trim().slice(0, 120);

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers });
  if (request.method !== 'POST') return reply({ error: 'Metodă invalidă.' }, 405);

  try {
    const key = serviceKey();
    if (!key) throw new Error('Cheia secretă Supabase lipsește.');

    const db = createClient(Deno.env.get('SUPABASE_URL')!, key);
    const botToken = await getPlatformSecret(db, 'discord_bot_token');
    if (!botToken) throw new Error('DISCORD_BOT_TOKEN lipsește din configurația Supabase.');
    const body = await request.json();
    const accessToken = String(body.access_token || '').trim();
    let discordId = '';
    if (accessToken) {
      const userResponse = await fetch('https://discord.com/api/v10/users/@me', {
        headers: { Authorization: `Bearer ${accessToken}`, 'User-Agent': 'PanelManagement/1.0 (+https://panel-pro.ro)' },
      });
      if (!userResponse.ok) return reply({ error: 'Sesiunea Discord a expirat.' }, 401);
      const discordUser = await userResponse.json();
      discordId = String(discordUser.id || '').trim();
    } else {
      try {
        const session = await requirePanelSession(db, request, 0, true);
        discordId = session.discord_id;
      } catch (error) {
        return reply({ error: error instanceof Error ? error.message : 'Autentifică-te cu Discord pentru a continua.' }, 401);
      }
    }
    if (!discordId) return reply({ error: 'Contul Discord nu a putut fi identificat.' }, 401);
    const action = String(body.action || 'list_owned').trim();

    const { data: allowed, error: rateError } = await db.rpc('consume_panel_rate_limit', {
      p_key: `organization-voucher:${discordId}:${requestIp(request)}`,
      p_limit: 20,
      p_window_seconds: 900,
    });
    if (rateError) throw rateError;
    if (allowed === false) return reply({ error: 'Prea multe încercări. Așteaptă câteva minute și încearcă din nou.' }, 429);

    const { data: guildRows, error: guildError } = await db
      .from('organization_guilds')
      .select('organization_id,guild_id,guild_name,kind,enabled,organizations!inner(id,name,slug,active,lifecycle_status)')
      .eq('kind', 'primary')
      .eq('enabled', true);
    if (guildError) throw guildError;

    const memberships = [] as any[];
    for (const row of guildRows || []) {
      const guild = await discordGuild(String(row.guild_id), botToken);
      if (!guild || !(await discordMember(String(row.guild_id), discordId, botToken, accessToken))) continue;
      const organizationId = String(row.organizations?.id || row.organization_id || '');
      if (!UUID_RE.test(organizationId)) continue;
      memberships.push({
        id: organizationId,
        name: String(row.organizations?.name || row.guild_name || 'Organizație'),
        slug: row.organizations?.slug || null,
        guild_id: String(row.guild_id),
        guild_name: String(guild.name || row.guild_name || row.guild_id),
        active: row.organizations?.active === true,
        lifecycle_status: row.organizations?.lifecycle_status || null,
      });
    }

    const organizationIds = memberships.map((item) => item.id);
    const { data: settings, error: settingsError } = organizationIds.length
      ? await db.from('app_settings').select('organization_id,key,value').in('organization_id', organizationIds).in('key', ['organization_access', 'organization_package'])
      : { data: [], error: null };
    if (settingsError) throw settingsError;
    const accessByOrganization = new Map<string, any>();
    const packageByOrganization = new Map<string, any>();
    for (const row of settings || []) {
      if (row.key === 'organization_access') accessByOrganization.set(String(row.organization_id), row.value || {});
      if (row.key === 'organization_package') packageByOrganization.set(String(row.organization_id), row.value || {});
    }
    const organizations = memberships.map((organization) => ({
      ...organization,
      expires_at: accessByOrganization.get(organization.id)?.expires_at || null,
      package_code: packageByOrganization.get(organization.id)?.code || 'standard',
      package_features: Array.isArray(packageByOrganization.get(organization.id)?.features)
        ? packageByOrganization.get(organization.id).features
        : [],
    }));

    if (action === 'list_owned' || action === 'list_member_organizations') return reply({ ok: true, organizations });
    if (action !== 'redeem') return reply({ error: 'Acțiune necunoscută.' }, 400);

    const organizationId = String(body.organization_id || '').trim();
    const code = String(body.voucher_code || '').trim().toUpperCase();
    if (!UUID_RE.test(organizationId)) return reply({ error: 'Selectează o organizație validă.' }, 400);
    if (code.length < 3 || code.length > 100) return reply({ error: 'Introdu un cod de voucher valid.' }, 400);
    const organization = organizations.find((item) => item.id === organizationId);
    if (!organization) return reply({ error: 'Poți folosi voucherul doar pentru o organizație în care ești membru.' }, 403);

    const { data: voucher, error: voucherError } = await db.from('organization_vouchers')
      .select('guild_id,redeemed_at,redeemed_organization_id,expires_at,revoked_at,duration_days,package_code')
      .eq('code', code).maybeSingle();
    if (voucherError) throw voucherError;
    if (!voucher) return reply({ error: 'Voucherul nu există.' }, 404);
    if (voucher.revoked_at) return reply({ error: 'Voucherul a fost revocat.' }, 409);
    if (voucher.redeemed_at || voucher.redeemed_organization_id) return reply({ error: 'Voucherul a fost deja folosit.' }, 409);
    if (voucher.expires_at && Date.parse(String(voucher.expires_at)) <= Date.now()) return reply({ error: 'Voucherul a expirat.' }, 409);
    if (voucher.guild_id && String(voucher.guild_id) !== organization.guild_id) {
      return reply({ error: 'Voucherul este alocat altui server Discord.' }, 403);
    }

    const result = await db.rpc('redeem_voucher_reactivate_organization', {
      p_code: code,
      p_discord_id: discordId,
      p_organization_id: organizationId,
    });
    if (result.error) {
      const status = result.error.code === 'P0001' ? 409 : 500;
      return reply({ error: result.error.message || 'Voucherul nu a putut fi aplicat.' }, status);
    }
    const redeemed = Array.isArray(result.data) ? result.data[0] : result.data;
    if (!redeemed?.access_expires_at) return reply({ error: 'Voucherul nu a putut fi aplicat.' }, 500);
    return reply({
      ok: true,
      organization_id: organizationId,
      expires_at: redeemed.access_expires_at,
      added_days: redeemed.added_days,
      package_code: redeemed.package_code,
      package_features: redeemed.package_features || [],
    });
  } catch (error) {
    console.error(error);
    return reply({ error: error instanceof Error ? error.message : 'Eroare internă.' }, 500);
  }
});
