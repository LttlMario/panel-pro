import { createClient } from 'jsr:@supabase/supabase-js@2.112.3';
import { getPlatformSecret } from '../_shared/platform-secrets.ts';

const headers = {
  'Access-Control-Allow-Origin': 'https://lttlmario.github.io',
  'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-panel-session',
  'Content-Type': 'application/json',
};

const reply = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers });

const serviceKey = () =>
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ||
  JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}').default;

const sha256 = async (value: string) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
    )
  ).map((byte) => byte.toString(16).padStart(2, '0')).join('');

const recordSystemAccessEvent = async (db: any, organizationId: string, action: string, details: Record<string, unknown>) => {
  try {
    await Promise.all([
      db.from('admin_audit_log').insert({
        organization_id: organizationId,
        actor_discord_id: null,
        actor_name: 'system',
        action,
        target_type: 'organization',
        target_id: organizationId,
        details,
      }),
      db.from('organization_lifecycle_events').insert({
        organization_id: organizationId,
        event_type: action,
        actor_discord_id: null,
        details,
      }),
    ]);
  } catch (error) {
    console.error('Could not record system organization access event:', error);
  }
};

const revokeExpiredOrganizationAccess = async (db: any, organizationId: string, now: string) => {
  await Promise.all([
    db.from('organizations').update({
      active: false,
      deactivation_reason: 'expired',
      deactivated_at: now,
      deactivated_by_discord_id: null,
      updated_at: now,
    }).eq('id', organizationId).eq('active', true),
    db.from('organization_members').update({ active: false, last_verified_at: now })
      .eq('organization_id', organizationId).eq('active', true),
    db.from('panel_sessions').update({ revoked_at: now })
      .eq('organization_id', organizationId).eq('is_platform_admin', false).is('revoked_at', null),
  ]);
};

const revokeMemberAccess = async (db: any, organizationId: string, discordId: string, now: string) => {
  await Promise.all([
    db.from('organization_members').update({ active: false, last_verified_at: now })
      .eq('organization_id', organizationId).eq('discord_id', discordId).eq('active', true),
    db.from('panel_sessions').update({ revoked_at: now })
      .eq('organization_id', organizationId).eq('discord_id', discordId).eq('is_platform_admin', false).is('revoked_at', null),
  ]);
};

const discordHeaders = (token: string) => ({
  Authorization: `Bot ${token}`,
  'User-Agent': 'PanelPro/1.0 (+https://lttlmario.github.io/panel-pro/)',
});

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers });
  if (request.method !== 'POST') return reply({ error: 'Metodă invalidă.' }, 405);

  try {
    const token = String(request.headers.get('x-panel-session') || '').trim();
    const key = serviceKey();
    if (!token) return reply({ error: 'Sesiunea lipsește.' }, 401);
    if (!key) throw new Error('Cheia secretă Supabase lipsește.');

    const db = createClient(Deno.env.get('SUPABASE_URL')!, key);
    const tokenHash = await sha256(token);
    const now = new Date().toISOString();
    const { data: session, error: sessionError } = await db
      .from('panel_sessions')
      .select('discord_id,organization_id,is_platform_admin,expires_at,revoked_at')
      .eq('token_hash', tokenHash)
      .is('revoked_at', null)
      .gt('expires_at', now)
      .maybeSingle();

    if (sessionError) throw sessionError;
    if (!session) return reply({ error: 'Sesiunea a expirat sau a fost revocată.' }, 401);

    // Administratorul platformei nu depinde de guildul organizației selectate.
    if (session.is_platform_admin === true) {
      const { error } = await db.from('panel_sessions').update({ last_seen_at: now }).eq('token_hash', tokenHash);
      if (error) throw error;
      return reply({ ok: true, last_seen_at: now, verification: 'platform_admin' });
    }

    const organizationId = String(session.organization_id || '');
    const discordId = String(session.discord_id || '');
    const [{ data: organization, error: organizationError }, { data: accessSetting, error: accessError }] = await Promise.all([
      db.from('organizations').select('id,active,deactivation_reason').eq('id', organizationId).maybeSingle(),
      db.from('app_settings').select('value').eq('organization_id', organizationId).eq('key', 'organization_access').maybeSingle(),
    ]);
    if (organizationError) throw organizationError;
    if (accessError) throw accessError;

    const accessExpiresAt = String(accessSetting?.value?.expires_at || '');
    if (accessExpiresAt && Date.parse(accessExpiresAt) <= Date.now()) {
      const wasActive = organization?.active === true;
      await revokeExpiredOrganizationAccess(db, organizationId, now);
      if (wasActive) {
        await recordSystemAccessEvent(db, organizationId, 'organization_access_expired', {
          expires_at: accessExpiresAt,
          source: 'touch_panel_session',
        });
      }
      return reply({ error: 'Perioada organizației a expirat.', code: 'ORGANIZATION_EXPIRED' }, 403);
    }
    if (!organization?.active && organization?.deactivation_reason === 'expired' && accessExpiresAt && Date.parse(accessExpiresAt) > Date.now()) {
      const { data: repairedOrganization, error: repairError } = await db.from('organizations').update({ active: true, deactivation_reason: null, deactivated_at: null, deactivated_by_discord_id: null, updated_at: now }).eq('id', organizationId).eq('active', false).eq('deactivation_reason', 'expired').select('id').maybeSingle();
      if (repairError) throw repairError;
      if (repairedOrganization) {
        organization.active = true;
        organization.deactivation_reason = null;
        await recordSystemAccessEvent(db, organizationId, 'organization_access_reconciled', { expires_at: accessExpiresAt, source: 'touch_panel_session' });
      }
    }
    if (!organization?.active) {
      return reply({ error: 'Organizația este dezactivată.', code: 'ORGANIZATION_DISABLED' }, 403);
    }

    const { data: guild, error: guildError } = await db
      .from('organization_guilds')
      .select('guild_id,guild_name')
      .eq('organization_id', organizationId)
      .eq('kind', 'primary')
      .eq('enabled', true)
      .maybeSingle();
    if (guildError) throw guildError;
    if (!guild?.guild_id) {
      await revokeMemberAccess(db, organizationId, discordId, now);
      await db.from('organizations').update({ last_discord_check_at: now, last_discord_check_status: 'guild_not_configured' }).eq('id', organizationId);
      await recordSystemAccessEvent(db, organizationId, 'organization_discord_check_failed', { status: 'guild_not_configured', discord_id: discordId });
      return reply({ error: 'Serverul Discord al organizației nu mai este configurat pentru acest cont.', code: 'DISCORD_GUILD_NOT_CONFIGURED' }, 403);
    }

    const discordBotToken = await getPlatformSecret(db, 'discord_bot_token');
    if (!discordBotToken) throw new Error('DISCORD_BOT_TOKEN lipsește din configurația Supabase.');
    const guildId = String(guild.guild_id);
    const guildResponse = await fetch(`https://discord.com/api/v10/guilds/${guildId}`, {
      headers: discordHeaders(discordBotToken),
    });

    // 404 înseamnă că serverul a fost șters sau nu mai există. 401/403/5xx
    // sunt tratate ca verificare amânată, pentru a nu deloga utilizatorii la o
    // problemă temporară a botului sau a API-ului Discord.
    if (guildResponse.status === 404) {
      await revokeMemberAccess(db, organizationId, discordId, now);
      await db.from('organizations').update({ last_discord_check_at: now, last_discord_check_status: 'guild_not_found' }).eq('id', organizationId);
      await recordSystemAccessEvent(db, organizationId, 'organization_discord_check_failed', { status: 'guild_not_found', guild_id: guildId, discord_id: discordId });
      return reply({ error: 'Serverul Discord al organizației nu a fost găsit. Sesiunea ta a fost revocată, dar organizația nu a fost dezactivată.', code: 'DISCORD_GUILD_NOT_FOUND' }, 403);
    }
    if (!guildResponse.ok) {
      const { error } = await db.from('panel_sessions').update({ last_seen_at: now }).eq('token_hash', tokenHash);
      if (error) throw error;
      return reply({ ok: true, last_seen_at: now, verification: 'deferred' });
    }

    const memberResponse = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${discordId}`, {
      headers: discordHeaders(discordBotToken),
    });
    if (memberResponse.status === 404) {
      await revokeMemberAccess(db, organizationId, discordId, now);
      await db.from('organizations').update({ last_discord_check_at: now, last_discord_check_status: 'member_not_found' }).eq('id', organizationId);
      await recordSystemAccessEvent(db, organizationId, 'organization_discord_check_failed', { status: 'member_not_found', guild_id: guildId, discord_id: discordId });
      return reply({ error: 'Nu mai ești membru pe serverul Discord al organizației. Sesiunea ta a fost revocată, dar organizația nu a fost dezactivată.', code: 'DISCORD_MEMBER_REMOVED' }, 403);
    }
    if (!memberResponse.ok) {
      const { error } = await db.from('panel_sessions').update({ last_seen_at: now }).eq('token_hash', tokenHash);
      if (error) throw error;
      await db.from('organizations').update({ last_discord_check_at: now, last_discord_check_status: 'deferred' }).eq('id', organizationId);
      return reply({ ok: true, last_seen_at: now, verification: 'deferred' });
    }

    const { error } = await db.from('panel_sessions').update({ last_seen_at: now }).eq('token_hash', tokenHash);
    if (error) throw error;
    await db.from('organizations').update({ last_discord_check_at: now, last_discord_check_status: 'ok' }).eq('id', organizationId);
    return reply({ ok: true, last_seen_at: now, verification: 'live' });
  } catch (error) {
    return reply({ error: error instanceof Error ? error.message : 'Eroare necunoscută.' }, 500);
  }
});
