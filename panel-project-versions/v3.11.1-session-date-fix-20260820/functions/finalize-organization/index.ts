import { createClient } from 'jsr:@supabase/supabase-js@2.112.3';
import { requirePanelSession } from '../_shared/panel-session.ts';

const headers = { 'Access-Control-Allow-Origin': 'https://lttlmario.github.io', 'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-panel-session', 'Content-Type': 'application/json' };
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers });
const randomToken = () => { const bytes = crypto.getRandomValues(new Uint8Array(32)); return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', ''); };
const sha256 = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))).map((byte) => byte.toString(16).padStart(2, '0')).join('');
const avatarUrl = (id: string, avatar?: string | null) => avatar ? `https://cdn.discordapp.com/avatars/${id}/${avatar}.png` : 'https://panel-management.netlify.app//img/logo-192.png';
const allowedPages = new Set(['index.html', 'anunturi.html', 'pontaj.html', 'cereri.html', 'calculator.html', 'bucatarie.html', 'contracte.html', 'calculatorilegal.html', 'craftmecanics.html', 'locatiiilegale.html', 'marketplace.html', 'marketplace-ilegal.html', 'rapoarte.html', 'status-live.html', 'asistent.html']);
const fullOnlyPages = new Set(['calculatorilegal.html', 'locatiiilegale.html', 'marketplace-ilegal.html']);
const sanitizePagePermissions = (raw: unknown, fullPackage: boolean) => {
  if (!raw || typeof raw !== 'object') return {};
  return Object.fromEntries(Object.entries(raw as Record<string, any>)
    .filter(([page]) => allowedPages.has(page) && (fullPackage || !fullOnlyPages.has(page)))
    .map(([page, ids]) => [page, [...new Set((Array.isArray(ids) ? ids : []).map(String).filter((id) => /^\d{15,22}$/.test(id)))]]));
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  try {
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default;
    if (!key) throw Error('Cheia Supabase lipsește.');
    const db = createClient(Deno.env.get('SUPABASE_URL')!, key);
    const body = await req.json();
    const id = String(body.organization_id || '').trim();
    if (!id) return reply({ error: 'Organizația este obligatorie.' }, 400);

    let actor = { discord_id: '', permission_level: 0 };
    let verifiedDiscordUser: any = null;
    const sessionToken = String(req.headers.get('x-panel-session') || '').trim();
    if (sessionToken) {
      const session = await requirePanelSession(db, req, 7, true);
      if (session.organization_id !== id) return reply({ error: 'Organizația nu corespunde sesiunii active.' }, 403);
      actor = { discord_id: session.discord_id, permission_level: session.permission_level };
    } else {
      const accessToken = String(body.access_token || '').trim();
      const voucherCode = String(body.voucher_code || '').trim().toUpperCase();
      if (!accessToken || !voucherCode) return reply({ error: 'Sesiunea securizată a panelului lipsește. Autentifică-te din nou.' }, 401);
      const userResponse = await fetch('https://discord.com/api/v10/users/@me', { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!userResponse.ok) return reply({ error: 'Sesiunea Discord a expirat.' }, 401);
      verifiedDiscordUser = await userResponse.json();
      const { data: voucher } = await db.from('organization_vouchers').select('redeemed_by_discord_id,redeemed_organization_id').eq('code', voucherCode).maybeSingle();
      if (!voucher || String(voucher.redeemed_by_discord_id) !== String(verifiedDiscordUser.id) || String(voucher.redeemed_organization_id) !== id) return reply({ error: 'Voucherul nu corespunde organizației Draft.' }, 403);
      actor = { discord_id: String(verifiedDiscordUser.id), permission_level: 99 };
    }

    const { data: organization } = await db.from('organizations').select('lifecycle_status').eq('id', id).maybeSingle();
    if (!organization || organization.lifecycle_status !== 'draft') return reply({ error: 'Organizația nu este în starea Draft.' }, 400);
    const { data: mappings } = await db.from('organization_role_mappings').select('discord_role_id,discord_role_name,panel_role').eq('organization_id', id).eq('enabled', true);
    const roles = Array.isArray(body.roles) && body.roles.length ? body.roles : (mappings || []).map((item: any) => ({ id: item.discord_role_id, name: item.discord_role_name, panel_role: item.panel_role }));
    if (!roles.length) return reply({ error: 'Configurează și salvează cel puțin un rol.' }, 400);
    const { data: packageSetting } = await db.from('app_settings').select('value').eq('organization_id', id).eq('key', 'organization_package').maybeSingle();
    const premium = packageSetting?.value?.code === 'full';
    if (!premium && roles.length > 10) return reply({ error: 'Standard permite maximum 10 roluri.' }, 400);
    const { data: guilds } = await db.from('organization_guilds').select('id').eq('organization_id', id).eq('enabled', true);
    if (!guilds?.length) return reply({ error: 'Adaugă un Guild Discord înainte de activare.' }, 400);
    if (!premium && guilds.length > 1) return reply({ error: 'Standard permite un singur server.' }, 400);
    let pages = body.page_permissions && typeof body.page_permissions === 'object' ? body.page_permissions : null;
    if (!pages) { const { data } = await db.from('app_settings').select('value').eq('organization_id', id).eq('key', 'page_permissions').maybeSingle(); pages = data?.value || {}; }
    const { error: pageError } = await db.from('app_settings').upsert({ organization_id: id, key: 'page_permissions', value: sanitizePagePermissions(pages, premium), updated_at: new Date().toISOString() }, { onConflict: 'organization_id,key' });
    if (pageError) throw pageError;
    const { error: statusError } = await db.from('organizations').update({ lifecycle_status: 'active', active: true, updated_at: new Date().toISOString() }).eq('id', id);
    if (statusError) throw statusError;
    await db.from('organization_lifecycle_events').insert({ organization_id: id, event_type: 'organization_finalized', actor_discord_id: actor.discord_id, details: { package: premium ? 'full' : 'standard', role_count: roles.length } });

    if (verifiedDiscordUser) {
      const { data: activeOrganization } = await db.from('organizations').select('id,name,slug,address,logo_url,banner_url,active').eq('id', id).single();
      const displayName = String(verifiedDiscordUser.global_name || verifiedDiscordUser.username || 'Administrator');
      const userData = { discord_id: actor.discord_id, username: String(verifiedDiscordUser.username || displayName), display_name: displayName, avatar: avatarUrl(actor.discord_id, verifiedDiscordUser.avatar), avatar_url: avatarUrl(actor.discord_id, verifiedDiscordUser.avatar), role: 'Administrator', default_role: 'Administrator' };
      // Emailul nu este solicitat prin OAuth și nu este sincronizat în panel.
      const { data: savedUser, error: userError } = await db.from('users').upsert(userData, { onConflict: 'discord_id' }).select('id,discord_id,username,display_name,avatar,avatar_url,role,default_role,service,maintenance_mode,discord_logs_active,threshold_value,max_shift_hours,created_at,updated_at').single();
      if (userError) throw userError;
      const { error: memberError } = await db.from('organization_members').upsert({ organization_id: id, discord_id: actor.discord_id, panel_role: 'Administrator', permission_level: 99, active: true, last_verified_at: new Date().toISOString() }, { onConflict: 'organization_id,discord_id' });
      if (memberError) throw memberError;
      const sessionToken = randomToken();
      const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
      const { error: sessionError } = await db.from('panel_sessions').insert({ token_hash: await sha256(sessionToken), organization_id: id, discord_id: actor.discord_id, permission_level: 99, is_platform_admin: false, expires_at: expiresAt });
      if (sessionError) throw sessionError;
      return reply({ ok: true, status: 'active', role_count: roles.length, session_token: sessionToken, expires_at: expiresAt, user: { ...savedUser, role: 'Administrator', default_role: 'Administrator', permission_level: 99, platform_admin: false, organization_id: id, organization: activeOrganization }, active_organization: { ...activeOrganization, permission_level: 99, panel_role: 'Administrator', allowed_pages: [] }, organizations: [{ ...activeOrganization, permission_level: 99, panel_role: 'Administrator', allowed_pages: [] }] });
    }
    return reply({ ok: true, status: 'active', role_count: roles.length });
  } catch (error) {
    return reply({ error: error instanceof Error ? error.message : 'Eroare internă.' }, 500);
  }
});
