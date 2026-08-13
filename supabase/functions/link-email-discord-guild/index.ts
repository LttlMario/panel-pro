import { createClient } from 'jsr:@supabase/supabase-js@2';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization,apikey,content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers });
const botHeaders = (token: string) => ({
  Authorization: `Bot ${token}`,
  'User-Agent': 'PanelManagement/1.0 (+https://panel-management.netlify.app)',
});

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers });
  if (request.method !== 'POST') return reply({ error: 'MetodÄƒ invalidÄƒ.' }, 405);

  try {
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ||
      JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default;
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const botToken = String(Deno.env.get('DISCORD_BOT_TOKEN') || '').trim();
    const jwt = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
    const body = await request.json().catch(() => ({}));
    const discordAccessToken = String(body.discord_access_token || '').trim();
    const guildId = String(body.guild_id || '').trim();

    if (!serviceKey || !supabaseUrl || !botToken) throw new Error('ConfiguraÈ›ia serverului lipseÈ™te.');
    if (!jwt) return reply({ error: 'Sesiunea email lipseÈ™te sau a expirat.' }, 401);
    if (!discordAccessToken) return reply({ error: 'Sesiunea Discord lipseÈ™te.' }, 400);
    if (!/^\d{15,22}$/.test(guildId)) return reply({ error: 'Serverul Discord selectat este invalid.' }, 400);

    const db = createClient(supabaseUrl, serviceKey);
    const { data: authData, error: authError } = await db.auth.getUser(jwt);
    if (authError || !authData.user) return reply({ error: 'Sesiunea email nu este validÄƒ.' }, 401);
    if (!authData.user.email_confirmed_at) return reply({ error: 'ConfirmÄƒ mai Ã®ntÃ¢i adresa de email.' }, 403);

    const { data: account, error: accountError } = await db
      .from('user_accounts')
      .select('auth_user_id,username,discord_id,discord_guild_id')
      .eq('auth_user_id', authData.user.id)
      .maybeSingle();
    if (accountError) throw accountError;
    if (!account) return reply({ error: 'Profilul contului nu existÄƒ Ã®ncÄƒ.' }, 404);
    if (account.discord_guild_id && String(account.discord_guild_id) !== guildId) {
      return reply({ error: 'Contul este deja asociat cu alt server Discord.' }, 409);
    }

    const { data: configuredGuild, error: guildError } = await db
      .from('organization_guilds')
      .select('guild_id,organization_id,organizations!inner(id,name,active)')
      .eq('guild_id', guildId)
      .eq('enabled', true)
      .eq('organizations.active', true)
      .maybeSingle();
    if (guildError) throw guildError;
    if (!configuredGuild) return reply({ error: 'Serverul Discord selectat nu este configurat pentru nicio organizaÈ›ie.', code: 'GUILD_NOT_CONFIGURED' }, 404);

    const discordResponse = await fetch('https://discord.com/api/v10/users/@me', {
      headers: { Authorization: `Bearer ${discordAccessToken}` },
    });
    if (!discordResponse.ok) return reply({ error: 'Sesiunea Discord nu este validÄƒ sau a expirat.' }, 401);
    const discordUser = await discordResponse.json();
    const discordId = String(discordUser.id || '').trim();
    if (!discordId) return reply({ error: 'Contul Discord nu a putut fi identificat.' }, 401);

    const memberResponse = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${discordId}`, { headers: botHeaders(botToken) });
    if (memberResponse.status === 404) return reply({ error: 'Nu eÈ™ti membru pe serverul Discord selectat.', code: 'MEMBER_NOT_FOUND' }, 403);
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
      .eq('organization_id', configuredGuild.organization_id)
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
      organization_id: String(configuredGuild.organization_id),
      role: String(selectedRole.panel_role || selectedRole.discord_role_name || roleNames.get(String(selectedRole.discord_role_id)) || 'Rol Discord'),
    });
  } catch (error) {
    console.error(error);
    return reply({ error: error instanceof Error ? error.message : 'Conectarea Discord a eÈ™uat.' }, 500);
  }
});
