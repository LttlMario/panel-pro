import { createClient } from 'jsr:@supabase/supabase-js@2';

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

const botToken = () => String(Deno.env.get('DISCORD_BOT_TOKEN') || '').trim();

const sha256 = async (value: string) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
    )
  ).map((byte) => byte.toString(16).padStart(2, '0')).join('');

const revokeOrganizationAccess = async (db: any, organizationId: string, discordId: string, now: string) => {
  await Promise.all([
    db.from('organizations').update({ active: false, updated_at: now }).eq('id', organizationId),
    db.from('organization_members').update({ active: false, last_verified_at: now })
      .eq('organization_id', organizationId).eq('discord_id', discordId).eq('active', true),
    db.from('panel_sessions').update({ revoked_at: now })
      .eq('organization_id', organizationId).eq('is_platform_admin', false).is('revoked_at', null),
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
      db.from('organizations').select('id,active').eq('id', organizationId).maybeSingle(),
      db.from('app_settings').select('value').eq('organization_id', organizationId).eq('key', 'organization_access').maybeSingle(),
    ]);
    if (organizationError) throw organizationError;
    if (accessError) throw accessError;

    const accessExpiresAt = String(accessSetting?.value?.expires_at || '');
    if (!organization?.active || (accessExpiresAt && Date.parse(accessExpiresAt) <= Date.now())) {
      await revokeOrganizationAccess(db, organizationId, discordId, now);
      return reply({ error: 'Organizația este dezactivată sau expirată.', code: 'ORGANIZATION_REVOKED' }, 403);
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
      await revokeOrganizationAccess(db, organizationId, discordId, now);
      return reply({ error: 'Serverul Discord al organizației nu mai este configurat.', code: 'ORGANIZATION_REVOKED' }, 403);
    }

    const discordBotToken = botToken();
    if (!discordBotToken) throw new Error('DISCORD_BOT_TOKEN lipsește din configurația Supabase.');
    const guildId = String(guild.guild_id);
    const guildResponse = await fetch(`https://discord.com/api/v10/guilds/${guildId}`, {
      headers: discordHeaders(discordBotToken),
    });

    // 404 înseamnă că serverul a fost șters sau nu mai există. 401/403/5xx
    // sunt tratate ca verificare amânată, pentru a nu deloga utilizatorii la o
    // problemă temporară a botului sau a API-ului Discord.
    if (guildResponse.status === 404) {
      await revokeOrganizationAccess(db, organizationId, discordId, now);
      return reply({ error: 'Serverul Discord al organizației nu mai există. Accesul a fost revocat.', code: 'DISCORD_GUILD_REMOVED' }, 403);
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
      await revokeOrganizationAccess(db, organizationId, discordId, now);
      return reply({ error: 'Nu mai ești membru pe serverul Discord al organizației. Accesul a fost revocat.', code: 'DISCORD_MEMBER_REMOVED' }, 403);
    }
    if (!memberResponse.ok) {
      const { error } = await db.from('panel_sessions').update({ last_seen_at: now }).eq('token_hash', tokenHash);
      if (error) throw error;
      return reply({ ok: true, last_seen_at: now, verification: 'deferred' });
    }

    const { error } = await db.from('panel_sessions').update({ last_seen_at: now }).eq('token_hash', tokenHash);
    if (error) throw error;
    return reply({ ok: true, last_seen_at: now, verification: 'live' });
  } catch (error) {
    return reply({ error: error instanceof Error ? error.message : 'Eroare necunoscută.' }, 500);
  }
});
