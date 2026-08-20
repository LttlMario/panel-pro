import { createClient } from 'jsr:@supabase/supabase-js@2.112.3';
import { getPlatformSecret } from '../_shared/platform-secrets.ts';

const headers = {
  'Access-Control-Allow-Origin': 'https://lttlmario.github.io',
  'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-panel-session',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers });
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const botHeaders = (token: string) => ({
  Authorization: `Bot ${token}`,
  'User-Agent': 'PanelManagement/1.0 (+https://panel-management.netlify.app)',
});

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers });
  if (request.method !== 'POST') return reply({ error: 'Metodă invalidă.' }, 405);

  try {
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ||
      JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default;
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const jwt = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
    const body = await request.json().catch(() => ({}));
    const discordAccessToken = String(body.discord_access_token || '').trim();
    const guildId = String(body.guild_id || '').trim();
    const organizationId = String(body.organization_id || '').trim();

    if (!serviceKey || !supabaseUrl) throw new Error('Configurația serverului lipsește.');
    if (!jwt) return reply({ error: 'Sesiunea email lipsește sau a expirat.' }, 401);
    if (!discordAccessToken) return reply({ error: 'Sesiunea Discord lipsește.' }, 400);
    if (!/^\d{15,22}$/.test(guildId)) return reply({ error: 'Serverul Discord selectat este invalid.' }, 400);
    if (organizationId && !UUID_RE.test(organizationId)) {
      return reply({ error: 'Organizația selectată este veche sau invalidă.', code: 'ORGANIZATION_ID_INVALID' }, 400);
    }

    const db = createClient(supabaseUrl, serviceKey);
    const botToken = await getPlatformSecret(db, 'discord_bot_token');
    if (!botToken) throw new Error('Configurația serverului lipsește.');
    const { data: authData, error: authError } = await db.auth.getUser(jwt);
    if (authError || !authData.user) return reply({ error: 'Sesiunea email nu este validă.' }, 401);
    if (!authData.user.email_confirmed_at) return reply({ error: 'Confirmă mai întâi adresa de email.' }, 403);

    const requestIp = String(request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'unknown')
      .split(',')[0].trim().slice(0, 120);
    const { data: linkAllowed, error: linkRateError } = await db.rpc('consume_panel_rate_limit', {
      p_key: `email-discord-link:${authData.user.id}:${requestIp}`,
      p_limit: 10,
      p_window_seconds: 900,
    });
    if (linkRateError) {
      console.error('Email/Discord link rate-limit unavailable:', linkRateError.message);
      return reply({ error: 'Protecția anti-abuz este temporar indisponibilă. Încearcă din nou în câteva minute.' }, 503);
    }
    if (linkAllowed === false) return reply({ error: 'Prea multe încercări. Așteaptă 15 minute și încearcă din nou.' }, 429);

    const { data: account, error: accountError } = await db
      .from('user_accounts')
      .select('auth_user_id,username,discord_id,discord_guild_id')
      .eq('auth_user_id', authData.user.id)
      .maybeSingle();
    if (accountError) throw accountError;
    if (!account) return reply({ error: 'Profilul contului nu există încă.' }, 404);
    if (account.discord_guild_id && String(account.discord_guild_id) !== guildId) {
      return reply({ error: 'Contul este deja asociat cu alt server Discord.' }, 409);
    }

    let guildQuery = db
      .from('organization_guilds')
      .select('guild_id,organization_id,organizations!inner(id,name,active)')
      .eq('guild_id', guildId)
      .eq('enabled', true)
      .eq('organizations.active', true)
      .limit(5);
    if (organizationId) guildQuery = guildQuery.eq('organization_id', organizationId);

    const { data: configuredGuildRows, error: guildError } = await guildQuery;
    if (guildError) throw guildError;
    const configuredOrganizations = Array.from(new Map(
      (configuredGuildRows || []).map((row: any) => [String(row.organizations?.id || row.organization_id || ''), row]),
    ).values()).filter((row: any) => String(row.organization_id || row.organizations?.id || '').trim());
    if (!configuredOrganizations.length) {
      return reply({
        error: organizationId
          ? 'Organizația selectată nu este configurată pentru serverul Discord ales.'
          : 'Serverul Discord selectat nu este configurat pentru nicio organizație activă.',
        code: 'GUILD_NOT_CONFIGURED',
      }, organizationId ? 403 : 404);
    }
    if (!organizationId && configuredOrganizations.length > 1) {
      return reply({
        error: 'Serverul Discord selectat este asociat cu mai multe organizații. Reîncarcă lista și selectează organizația corectă.',
        code: 'ORGANIZATION_SELECTION_REQUIRED',
      }, 409);
    }
    const configuredGuild = configuredOrganizations[0] as any;
    const configuredOrganizationId = String(configuredGuild.organizations?.id || configuredGuild.organization_id || '').trim();
    if (!UUID_RE.test(configuredOrganizationId)) return reply({ error: 'Configurația organizației este invalidă.', code: 'ORGANIZATION_DATA_INVALID' }, 500);
    if (!configuredGuild) return reply({ error: 'Serverul Discord selectat nu este configurat pentru nicio organizație.', code: 'GUILD_NOT_CONFIGURED' }, 404);

    const discordResponse = await fetch('https://discord.com/api/v10/users/@me', {
      headers: { Authorization: `Bearer ${discordAccessToken}` },
    });
    if (!discordResponse.ok) return reply({ error: 'Sesiunea Discord nu este validă sau a expirat.' }, 401);
    const discordUser = await discordResponse.json();
    const discordId = String(discordUser.id || '').trim();
    if (!discordId) return reply({ error: 'Contul Discord nu a putut fi identificat.' }, 401);

    const memberResponse = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${discordId}`, { headers: botHeaders(botToken) });
    if (memberResponse.status === 404) return reply({ error: 'Nu ești membru pe serverul Discord selectat.', code: 'MEMBER_NOT_FOUND' }, 403);
    if (!memberResponse.ok) return reply({ error: `Botul nu poate verifica serverul Discord (HTTP ${memberResponse.status}).`, code: 'BOT_CANNOT_READ_GUILD' }, 502);
    const member = await memberResponse.json();

    const rolesResponse = await fetch(`https://discord.com/api/v10/guilds/${guildId}/roles`, { headers: botHeaders(botToken) });
    if (!rolesResponse.ok) return reply({ error: `Botul nu poate citi rolurile serverului (HTTP ${rolesResponse.status}).`, code: 'BOT_CANNOT_READ_ROLES' }, 502);
    const roles = await rolesResponse.json() as any[];
    const roleNames = new Map(roles.map((role: any) => [String(role.id), String(role.name || '')]));
    const memberRoleIds = new Set((Array.isArray(member.roles) ? member.roles : []).map((roleId: unknown) => String(roleId)));

    const { data: mappings, error: mappingError } = await db
      .from('organization_role_mappings')
      .select('discord_role_id,discord_role_name,panel_role,permission_level,priority')
      .eq('organization_id', configuredOrganizationId)
      .eq('guild_id', guildId)
      .eq('enabled', true);
    if (mappingError) throw mappingError;
    const matches = (mappings || []).filter((mapping: any) => memberRoleIds.has(String(mapping.discord_role_id)));
    if (!matches.length) return reply({ error: 'Nu ai niciun rol configurat pentru acces pe serverul selectat.', code: 'ROLE_NOT_CONFIGURED' }, 403);
    const selectedRole = matches.sort((a: any, b: any) => Number(b.priority || b.permission_level || 0) - Number(a.priority || a.permission_level || 0))[0];

    const { data: conflict, error: conflictError } = await db
      .from('user_accounts')
      .select('auth_user_id')
      .eq('discord_id', discordId)
      .neq('auth_user_id', authData.user.id)
      .maybeSingle();
    if (conflictError) throw conflictError;
    if (conflict) return reply({ error: 'Acest cont Discord este deja conectat la alt cont email.', code: 'DISCORD_ALREADY_LINKED' }, 409);

    const { error: updateError } = await db
      .from('user_accounts')
      .update({ discord_id: discordId, discord_guild_id: guildId, updated_at: new Date().toISOString() })
      .eq('auth_user_id', authData.user.id);
    if (updateError) {
      if (String((updateError as any).code || '') === '23505') return reply({ error: 'Acest cont Discord este deja conectat la alt cont email.', code: 'DISCORD_ALREADY_LINKED' }, 409);
      throw updateError;
    }

    return reply({
      ok: true,
      username: account.username,
      discord_id: discordId,
      guild_id: guildId,
      organization_id: configuredOrganizationId,
      role: String(selectedRole.panel_role || selectedRole.discord_role_name || roleNames.get(String(selectedRole.discord_role_id)) || 'Rol Discord'),
    });
  } catch (error) {
    console.error(error);
    return reply({ error: error instanceof Error ? error.message : 'Conectarea Discord a eșuat.' }, 500);
  }
});
