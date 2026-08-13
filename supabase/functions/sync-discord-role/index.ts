import { createClient } from 'jsr:@supabase/supabase-js@2';
import { isPlatformAdminDiscordId } from '../_shared/platform-admin.ts';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-panel-session',
  'Content-Type': 'application/json',
};
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers });
const serviceKey = () => Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}').default;
const avatarUrl = (id: string, avatar?: string | null) => avatar ? `https://cdn.discordapp.com/avatars/${id}/${avatar}.png` : 'https://panel-management.netlify.app//img/logo-192.png';
const normalizeId = (value: unknown) => String(value ?? '').trim();
const discordBotHeaders = (bot: string) => ({ Authorization: `Bot ${bot}`, 'User-Agent': 'PanelManagement/1.0 (+https://panel-management.netlify.app)' });
const fetchDiscordMember = async (guildId: string, discordId: string, accessToken: string, botToken: string) => {
  const botResponse = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${discordId}`, { headers: discordBotHeaders(botToken) });
  if (botResponse.ok || !accessToken) return botResponse;
  const oauthResponse = await fetch(`https://discord.com/api/v10/users/@me/guilds/${guildId}/member`, { headers: { Authorization: `Bearer ${accessToken}`, 'User-Agent': 'PanelManagement/1.0 (+https://panel-management.netlify.app)' } });
  return oauthResponse.ok || oauthResponse.status === 404 ? oauthResponse : botResponse;
};
const fetchGuildSnapshot = async (guildId: string, discordId: string, accessToken: string, botToken: string) => {
  const [memberResponse, rolesResponse] = await Promise.all([
    fetchDiscordMember(guildId, discordId, accessToken, botToken),
    fetch(`https://discord.com/api/v10/guilds/${guildId}/roles`, { headers: discordBotHeaders(botToken) })
  ]);
  const member = memberResponse.ok ? await memberResponse.json() : null;
  const roles = new Map<string, { name: string; position: number }>();
  if (rolesResponse.ok) {
    for (const role of (await rolesResponse.json()) as any[]) {
      roles.set(String(role.id), { name: String(role.name), position: Number(role.position) || 0 });
    }
  }
  return { memberResponse, member, roles };
};
const randomToken = () => { const bytes = crypto.getRandomValues(new Uint8Array(32)); return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', ''); };
const sha256 = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))).map((byte) => byte.toString(16).padStart(2, '0')).join('');

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers });
  if (request.method !== 'POST') return reply({ error: 'MetodÄƒ invalidÄƒ.' }, 405);
  try {
    const body = await request.json();
    const emailLogin = body.email_login === true;
    const voucherCode = String(body.voucher_code || '').trim().toUpperCase();
    let voucherGuildId = String(body.voucher_guild_id || '').trim();
    if (voucherCode && voucherGuildId && !/^\d{15,22}$/.test(voucherGuildId)) return reply({ error: 'Guild ID-ul voucherului este invalid.' }, 400);
    let accessToken = String(body.access_token || '').trim();
    if (emailLogin && voucherCode) return reply({ error: 'Voucherul se verificÄƒ numai prin loginul Discord.' }, 400);
    if (!emailLogin && !accessToken) return reply({ error: 'Tokenul Discord lipseÈ™te.' }, 400);
    const key = serviceKey();
    const botToken = String(Deno.env.get('DISCORD_BOT_TOKEN') || '').trim();
    if (!key) throw new Error('Cheia secretÄƒ Supabase lipseÈ™te.');
    if (!botToken) throw new Error('DISCORD_BOT_TOKEN lipseÈ™te. Botul comun trebuie configurat.');
    const db = createClient(Deno.env.get('SUPABASE_URL')!, key);

    if (voucherCode) {
      const { data: voucher, error: voucherError } = await db.from('organization_vouchers').select('guild_id,redeemed_at,redeemed_organization_id,expires_at').eq('code', voucherCode).maybeSingle();
      if (voucherError) throw voucherError;
      if (!voucher) return reply({ error: 'Voucherul nu existÄƒ.' }, 400);
      if (voucher.redeemed_at || voucher.redeemed_organization_id) return reply({ error: 'Voucherul a fost deja folosit.' }, 409);
      if (voucher.expires_at && Date.parse(String(voucher.expires_at)) <= Date.now()) return reply({ error: 'Voucherul a expirat.' }, 400);
      const voucherGuild = String(voucher.guild_id || '').trim();
      if (voucherGuild && voucherGuildId && voucherGuild !== voucherGuildId) return reply({ error: 'Guild ID-ul introdus nu corespunde voucherului.' }, 400);
      if (voucherGuild && !voucherGuildId) voucherGuildId = voucherGuild;
    }

    let discordUser: any;
    let selectedGuildId = '';
    if (emailLogin) {
      const jwt = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
      if (!jwt || jwt === key) return reply({ error: 'Sesiunea email lipseÈ™te sau a expirat.' }, 401);
      const { data: authData, error: authError } = await db.auth.getUser(jwt);
      if (authError || !authData.user) return reply({ error: 'Sesiunea email nu este validÄƒ.' }, 401);
      if (!authData.user.email_confirmed_at) return reply({ error: 'ConfirmÄƒ mai Ã®ntÃ¢i adresa de email.' }, 403);
      const { data: account, error: accountError } = await db
        .from('user_accounts')
        .select('username,discord_id,discord_guild_id')
        .eq('auth_user_id', authData.user.id)
        .maybeSingle();
      if (accountError) throw accountError;
      if (!account || !account.discord_id || !account.discord_guild_id) {
        return reply({ error: 'ConecteazÄƒ mai Ã®ntÃ¢i Discord È™i selecteazÄƒ serverul pentru acest cont.', code: 'NEEDS_DISCORD_LINK' }, 409);
      }
      selectedGuildId = String(account.discord_guild_id);
      discordUser = {
        id: String(account.discord_id),
        username: String(account.username || 'utilizator'),
        global_name: String(account.username || 'utilizator'),
        avatar: null,
      };
      accessToken = '';
    } else {
      const userResponse = await fetch('https://discord.com/api/v10/users/@me', { headers: { Authorization: `Bearer ${accessToken}`, 'User-Agent': 'PanelManagement/1.0 (+https://panel-management.netlify.app)' } });
      if (!userResponse.ok) return reply({ error: 'Sesiunea Discord a expirat.' }, 401);
      discordUser = await userResponse.json();
    }
    const guildsPromise = db.from('organization_guilds')
      .select('guild_id,guild_name,kind,organization_id,organizations!inner(id,name,slug,address,logo_url,banner_url,active)')
      .eq('enabled', true);
    const isPlatformAdmin=isPlatformAdminDiscordId(discordUser.id);

    if (voucherCode) {
      return reply({
        ok: true,
        voucher_valid: true,
        voucher_code: voucherCode,
        voucher_guild_id: voucherGuildId || null,
        discord_id: String(discordUser.id)
      });
    }

    const { data: guilds, error: guildError } = await guildsPromise;
    if (guildError) throw guildError;
    const organizationIds=[...new Set((guilds||[]).map((guild:any)=>String(guild.organization_id)))];
    const [accessResult, mappingResult] = await Promise.all([
      organizationIds.length
        ? db.from('app_settings').select('organization_id,key,value').in('organization_id',organizationIds).in('key',['organization_access','page_permissions','assistant_page_permissions','action_permissions'])
        : Promise.resolve({ data: [], error: null }),
      db.from('organization_role_mappings').select('*').eq('enabled', true)
    ]);
    const { data: accessRows, error: accessError } = accessResult;
    if(accessError)throw accessError;
    const { data: mappings, error: mappingError } = mappingResult;
    if (mappingError) throw mappingError;
    const expiredIds=new Set((accessRows||[]).filter((row:any)=>row.key==='organization_access'&&row.value?.expires_at&&Date.parse(String(row.value.expires_at))<=Date.now()).map((row:any)=>String(row.organization_id))),pageSettings=new Map((accessRows||[]).filter((row:any)=>row.key==='page_permissions').map((row:any)=>[String(row.organization_id),row.value||{}])),assistantPageSettings=new Map((accessRows||[]).filter((row:any)=>row.key==='assistant_page_permissions').map((row:any)=>[String(row.organization_id),row.value||{}])),actionSettings=new Map((accessRows||[]).filter((row:any)=>row.key==='action_permissions').map((row:any)=>[String(row.organization_id),row.value||{}]));
     if(expiredIds.size)await db.from('organizations').update({active:false,updated_at:new Date().toISOString()}).in('id',[...expiredIds]);
     const inactiveOrganizationIds=new Set((guilds||[]).filter((item:any)=>item.organizations?.active===false&&!expiredIds.has(String(item.organization_id))).map((item:any)=>String(item.organization_id)));

    const matches = new Map<string, {
      organization: any;
      panel_role: string;
      nickname: string;
      guild_ids: string[];
      discord_role_ids: string[];
    }>();
    const liveRoles = new Map<string, Map<string, { name: string; position: number }>>();
    let platformRoleLabel = '';
    let platformRolePosition = -1;
    const guildsToProcess = (guilds || []).filter((item:any)=>!inactiveOrganizationIds.has(String(item.organization_id))&&(!voucherCode || String(item.guild_id) === voucherGuildId)&&(!emailLogin || String(item.guild_id) === selectedGuildId));
    const guildSnapshots = new Map<string, Promise<{ memberResponse: Response; member: any; roles: Map<string, { name: string; position: number }> }>>();
    const getGuildSnapshot = (guildId: string) => {
      if (!guildSnapshots.has(guildId)) guildSnapshots.set(guildId, fetchGuildSnapshot(guildId, String(discordUser.id), accessToken, botToken));
      return guildSnapshots.get(guildId)!;
    };
    // Pornim verificÄƒrile tuturor serverelor simultan, apoi pÄƒstrÄƒm ordinea existentÄƒ la procesarea rolurilor.
    await Promise.all(guildsToProcess.map((guild:any) => getGuildSnapshot(String(guild.guild_id))));
    for (const guild of guildsToProcess) {
      const snapshot = await getGuildSnapshot(String(guild.guild_id));
      const memberResponse = snapshot.memberResponse;
      if (memberResponse.status === 404) continue;
      if (!memberResponse.ok) { console.warn('Guild indisponibil', guild.guild_id, memberResponse.status); continue; }
      const member = snapshot.member;
      liveRoles.set(String(guild.guild_id), snapshot.roles);
      const roleIds = new Set<string>(Array.isArray(member.roles) ? member.roles.map(normalizeId) : []);
      const highestDiscordRole = [...roleIds]
        .map((roleId) => liveRoles.get(String(guild.guild_id))?.get(roleId))
        .filter(Boolean)
        .sort((a:any, b:any) => b.position - a.position)[0] as { name: string; position: number } | undefined;
        const matchedMappings = (mappings || [])
          .filter((item: any) =>
            String(item.organization_id).trim() === String(guild.organization_id).trim() &&
            String(item.guild_id).trim() === String(guild.guild_id).trim() &&
            roleIds.has(String(item.discord_role_id).trim())
          );

        const mappedFallback = [...matchedMappings].sort((a: any, b: any) => {
          const roleA = liveRoles.get(String(guild.guild_id))?.get(String(a.discord_role_id))?.position ?? Number(a.priority ?? a.permission_level ?? 0);
          const roleB = liveRoles.get(String(guild.guild_id))?.get(String(b.discord_role_id))?.position ?? Number(b.priority ?? b.permission_level ?? 0);
          return Number(roleB) - Number(roleA);
        })[0];
        const fallbackRoleLabel = String(
          highestDiscordRole?.name ||
          mappedFallback?.discord_role_name ||
          mappedFallback?.panel_role ||
          ''
        ).trim();
        const fallbackRolePosition = Number(
          highestDiscordRole?.position ??
          liveRoles.get(String(guild.guild_id))?.get(String(mappedFallback?.discord_role_id || ''))?.position ??
          mappedFallback?.priority ??
          mappedFallback?.permission_level ??
          0
        );
        if (isPlatformAdmin && fallbackRoleLabel && fallbackRolePosition >= platformRolePosition) {
          platformRoleLabel = fallbackRoleLabel;
          platformRolePosition = fallbackRolePosition;
        }

        const best = matchedMappings
          .sort((a: any, b: any) => {
            const roleA =
              liveRoles
                .get(String(guild.guild_id))
                ?.get(String(a.discord_role_id))
                ?.position || 0;

            const roleB =
              liveRoles
                .get(String(guild.guild_id))
                ?.get(String(b.discord_role_id))
                ?.position || 0;

            return roleB - roleA;
          })[0];
if (!best) {
  /*
   * Platform Admin poate intra Ã®n organizaÈ›ie chiar dacÄƒ
   * nu are un mapping normal configurat.
   */
  if (isPlatformAdmin && fallbackRoleLabel) {
    matches.set(String(guild.organization_id), {
      organization: guild.organizations,

      panel_role: fallbackRoleLabel,

      nickname: String(
        member.nick ||
        discordUser.global_name ||
        discordUser.username
      ),

      guild_ids: [
        String(guild.guild_id)
      ],

      discord_role_ids: [
        ...roleIds
      ],
    });
  }

  continue;
}

const existing =
  matches.get(String(guild.organization_id));

if (!existing) {
  matches.set(String(guild.organization_id), {
    organization: guild.organizations,

    panel_role: String(
      liveRoles
        .get(String(guild.guild_id))
        ?.get(String(best.discord_role_id))
        ?.name ||
      best.discord_role_name ||
      best.panel_role ||
      'Rol Discord'
    ),

    nickname: String(
      member.nick ||
      discordUser.global_name ||
      discordUser.username
    ),

    guild_ids: [
      String(guild.guild_id)
    ],

    discord_role_ids: [
      ...roleIds
    ],
  });

} else {

  if (
    !existing.guild_ids.includes(
      String(guild.guild_id)
    )
  ) {
    existing.guild_ids.push(
      String(guild.guild_id)
    );
  }

  /*
   * Foarte important pentru organizaÈ›iile care folosesc
   * douÄƒ servere Discord:
   * unim rolurile gÄƒsite pe ambele servere.
   */
    existing.discord_role_ids = [
      ...new Set([
        ...existing.discord_role_ids,
        ...roleIds
      ])
    ];
  }

  // ÃŽnchide procesarea serverului Discord curent.
  }

  if (isPlatformAdmin) {
    const { data: platformOrganizations, error: platformOrganizationsError } = await db.from('organizations')
      .select('id,name,slug,address,logo_url,banner_url,active,lifecycle_status')
      .order('name');
    if (platformOrganizationsError) throw platformOrganizationsError;
    for (const organization of platformOrganizations || []) {
      const organizationId = String(organization.id);
      if (!matches.has(organizationId)) {
        matches.set(organizationId, {
          organization,
          panel_role: platformRoleLabel || 'Administrator platformÄƒ',
          nickname: String(discordUser.global_name || discordUser.username),
          guild_ids: [],
          discord_role_ids: []
        });
      }
    }
  }

  const available = [...matches.entries()]
  .map(([organization_id, value]) => {

    const rules: any = {
      ...(pageSettings.get(organization_id) || {})
    };

    const configured =
      Object.values(rules).some(
        (roleIds: any) =>
          Array.isArray(roleIds) &&
          roleIds.length > 0
      );

    let allowed_pages =
      Object.entries(rules)
        .filter(([, roleIds]: any) =>
          Array.isArray(roleIds) &&
          roleIds.some(
            (roleId: string) =>
              value.discord_role_ids.includes(
                String(roleId)
              )
          )
        )
        .map(([page]) => page);

    // Orice rol Discord identificat trebuie sÄƒ poatÄƒ intra Ã®n Dashboard È™i Pontaj.
    // Restul paginilor rÄƒmÃ¢n controlate de selecÈ›iile configurate Ã®n organizaÈ›ie.
    if (value.discord_role_ids.length) {
      allowed_pages = [
        ...new Set(['index.html', 'pontaj.html', ...allowed_pages])
      ];
    }

    const assistantRules: any = assistantPageSettings.get(organization_id) || {};
    const assistantConfigured = Object.keys(assistantRules).length > 0;
    const assistant_allowed_pages = (assistantConfigured ? Object.entries(assistantRules) : Object.entries(rules))
      .filter(([, roleIds]: any) => Array.isArray(roleIds) && roleIds.some((roleId: string) => value.discord_role_ids.includes(String(roleId))))
      .map(([page]) => page)
      .filter((page) => !['admin.html','logs.html','diagnostic.html','discord-configurare.html','organizatii.html','vouchere.html','developer.html','administrare-organizatie.html'].includes(page));

    return {
      organization_id,
      ...value,
      action_permissions: actionSettings.get(organization_id) || {},
      allowed_pages,
      assistant_allowed_pages,
      assistant_permissions_configured: assistantConfigured,
      page_permissions_configured: configured
    };
  })
  .sort((a, b) =>
    String(a.organization.name)
      .localeCompare(
        String(b.organization.name),
        'ro'
      )
  );
    if (!available.length) {
      await db.from('panel_sessions').update({ revoked_at: new Date().toISOString() }).eq('discord_id', discordUser.id).is('revoked_at', null);
      await db.from('organization_members').update({ active: false, last_verified_at: new Date().toISOString() }).eq('discord_id', discordUser.id).eq('active', true);
      return reply({ error: 'Nu ai niciun rol configurat Ã®ntr-o organizaÈ›ie a platformei.', code: 'NO_ORGANIZATION' }, 403);
    }
    if (voucherCode) return reply({
      error: 'Voucherul trebuie configurat Ã®ntr-o organizaÈ›ie nouÄƒ sau existentÄƒ.',
      code: 'VOUCHER_REQUIRES_ORGANIZATION_SETUP',
      voucher_code: voucherCode,
      voucher_guild_id: voucherGuildId || null,
    }, 409);
    const requestedId = String(body.organization_id || '').trim();
    const active = available.find((item) => item.organization_id === requestedId) || available[0];
    const { data: linkedAccount, error: linkedAccountError } = await db
      .from('user_accounts')
      .select('username,auth_user_id,avatar_url')
      .eq('discord_id', String(discordUser.id))
      .maybeSingle();
    if (linkedAccountError) throw linkedAccountError;
    const accountUsername = String(linkedAccount?.username || '').trim();
    const accountAvatar = String(linkedAccount?.avatar_url || '').trim();
    const userData = {
      discord_id: String(discordUser.id), username: accountUsername || String(discordUser.username), display_name: accountUsername || active.nickname,
      avatar: accountAvatar || avatarUrl(discordUser.id, discordUser.avatar), avatar_url: accountAvatar || avatarUrl(discordUser.id, discordUser.avatar),
      role: active.panel_role, default_role: active.panel_role,
    };
    // Emailul nu este solicitat prin OAuth È™i nu este sincronizat Ã®n panel.
    const { data: savedUser, error: userError } = await db.from('users').upsert(userData, { onConflict: 'discord_id' }).select('id,discord_id,username,display_name,avatar,avatar_url,role,default_role,tutorial_read,service,maintenance_mode,discord_logs_active,threshold_value,max_shift_hours,created_at,updated_at').single();
    if (userError) throw userError;
    await Promise.all(
      available.map((item) =>
        db
          .from('organization_members')
          .upsert({
            organization_id: item.organization_id,
            discord_id: discordUser.id,
            panel_role: item.panel_role,

            // Compatibilitate DB temporarÄƒ.
            // Nu mai este folosit pentru acces.
            permission_level:
              isPlatformAdmin ? 99 : 1,

            active: true,
            last_verified_at:
              new Date().toISOString(),
          }, {
            onConflict:
              'organization_id,discord_id'
          })
      )
    );

    const sessionToken = randomToken();

const expiresAt =
  new Date(
    Date.now() + 12 * 60 * 60 * 1000
  ).toISOString();


// ============================================================
// SESIUNEA PANELULUI
// ============================================================

const { error: sessionError } =
  await db
    .from('panel_sessions')
    .insert({

      token_hash:
        await sha256(sessionToken),

      organization_id:
        active.organization_id,

      discord_id:
        discordUser.id,

      /*
       * Compatibilitate temporarÄƒ cu baza de date.
       *
       * permission_level NU mai controleazÄƒ accesul
       * utilizatorilor normali.
       *
       * 99 = Platform Admin
       * 1  = utilizator normal
       */
      permission_level:
        isPlatformAdmin ? 99 : 1,

      is_platform_admin:
        isPlatformAdmin,

      // RLS foloseÈ™te rolurile Discord reale pentru paginile configurate.
      discord_role_ids:
        [...new Set((active.discord_role_ids || []).map(String))],

      expires_at:
        expiresAt,
    });

if (sessionError) {
  throw sessionError;
}


// ============================================================
// È˜TERGEM SESIUNILE EXPIRATE
// ============================================================

await db
  .from('panel_sessions')
  .delete()
  .eq(
    'discord_id',
    discordUser.id
  )
  .lt(
    'expires_at',
    new Date().toISOString()
  );


// ============================================================
// RÄ‚SPUNS LOGIN / SYNC
// ============================================================

return reply({

  // ----------------------------------------------------------
  // UTILIZATORUL ACTIV
  // ----------------------------------------------------------

  user: {
    ...savedUser,

    role:
      active.panel_role,

    default_role:
      active.panel_role,

    /*
     * Administratorul platformei este separat
     * de rolurile organizaÈ›iei.
     */
    platform_admin:
      isPlatformAdmin,

    is_platform_admin:
      isPlatformAdmin,

    /*
     * Rolurile Discord reale ale utilizatorului.
     */
    discord_role_ids:
      active.discord_role_ids,

    /*
     * Acestea sunt paginile pe care utilizatorul
     * are voie efectiv sÄƒ le deschidÄƒ.
     */
    allowed_pages:
      active.allowed_pages,

    page_permissions_configured:
      active.page_permissions_configured,

    action_permissions:
      active.action_permissions,

    assistant_allowed_pages:
      active.assistant_allowed_pages,

    assistant_permissions_configured:
      active.assistant_permissions_configured,

    organization_id:
      active.organization_id,

    organization:
      active.organization,

    organization_access_expired:
      expiredIds.has(String(active.organization_id))
  },


  // ----------------------------------------------------------
  // SESIUNE
  // ----------------------------------------------------------

  session_token:
    sessionToken,

  expires_at:
    expiresAt,


  // ----------------------------------------------------------
  // ORGANIZAÈšIA ACTIVÄ‚
  // ----------------------------------------------------------

  active_organization: {

    id:
      active.organization_id,

    ...active.organization,

    panel_role:
      active.panel_role,

    allowed_pages:
      active.allowed_pages,

    action_permissions:
      active.action_permissions,

    assistant_allowed_pages:
      active.assistant_allowed_pages,

    assistant_permissions_configured:
      active.assistant_permissions_configured,

    organization_access_expired:
      expiredIds.has(String(active.organization_id))
  },


  // ----------------------------------------------------------
  // TOATE ORGANIZAÈšIILE UTILIZATORULUI
  // ----------------------------------------------------------

  organizations:
    available.map((item) => ({

      id:
        item.organization_id,

      ...item.organization,

      panel_role:
        item.panel_role,

      allowed_pages:
        item.allowed_pages,

      action_permissions:
        item.action_permissions,
      assistant_allowed_pages:
        item.assistant_allowed_pages,
      assistant_permissions_configured:
        item.assistant_permissions_configured

    }))
});

} catch (error) {

  console.error(error);

  return reply(
    {
      error:
        error instanceof Error
          ? error.message
          : 'Eroare necunoscutÄƒ.'
    },
    500
  );
}
});
