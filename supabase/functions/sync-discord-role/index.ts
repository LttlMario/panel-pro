import { createClient } from 'jsr:@supabase/supabase-js@2';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-panel-session',
  'Content-Type': 'application/json',
};
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers });
const serviceKey = () => Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}').default;
const avatarUrl = (id: string, avatar?: string | null) => avatar ? `https://cdn.discordapp.com/avatars/${id}/${avatar}.png` : 'https://lttlmario.github.io/panel-pro/img/logo-192.png';
const randomToken = () => { const bytes = crypto.getRandomValues(new Uint8Array(32)); return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', ''); };
const sha256 = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))).map((byte) => byte.toString(16).padStart(2, '0')).join('');

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers });
  if (request.method !== 'POST') return reply({ error: 'Metodă invalidă.' }, 405);
  try {
    const body = await request.json();
    const voucherCode = String(body.voucher_code || '').trim().toUpperCase();
    let voucherGuildId = String(body.voucher_guild_id || '').trim();
    if (voucherCode && voucherGuildId && !/^\d{15,22}$/.test(voucherGuildId)) return reply({ error: 'Guild ID-ul voucherului este invalid.' }, 400);
    const accessToken = String(body.access_token || '').trim();
    if (!accessToken) return reply({ error: 'Tokenul Discord lipsește.' }, 400);
    const key = serviceKey();
    const botToken = String(Deno.env.get('DISCORD_BOT_TOKEN') || '').trim();
    if (!key) throw new Error('Cheia secretă Supabase lipsește.');
    if (!botToken) throw new Error('DISCORD_BOT_TOKEN lipsește. Botul comun trebuie configurat.');
    const db = createClient(Deno.env.get('SUPABASE_URL')!, key);

    if (voucherCode) {
      const { data: voucher, error: voucherError } = await db.from('organization_vouchers').select('guild_id,redeemed_at,redeemed_organization_id,expires_at').eq('code', voucherCode).maybeSingle();
      if (voucherError) throw voucherError;
      if (!voucher) return reply({ error: 'Voucherul nu există.' }, 400);
      if (voucher.redeemed_at || voucher.redeemed_organization_id) return reply({ error: 'Voucherul a fost deja folosit.' }, 409);
      if (voucher.expires_at && Date.parse(String(voucher.expires_at)) <= Date.now()) return reply({ error: 'Voucherul a expirat.' }, 400);
      const voucherGuild = String(voucher.guild_id || '').trim();
      if (voucherGuild && voucherGuildId && voucherGuild !== voucherGuildId) return reply({ error: 'Guild ID-ul introdus nu corespunde voucherului.' }, 400);
      if (voucherGuild && !voucherGuildId) voucherGuildId = voucherGuild;
    }

    const userResponse = await fetch('https://discord.com/api/v10/users/@me', { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!userResponse.ok) return reply({ error: 'Sesiunea Discord a expirat.' }, 401);
    const discordUser = await userResponse.json();
    const platformOwners=String(Deno.env.get('PLATFORM_OWNER_DISCORD_IDS')||'').split(',').map(value=>value.trim()).filter(Boolean),isPlatformAdmin=platformOwners.includes(String(discordUser.id));

    const { data: guilds, error: guildError } = await db.from('organization_guilds')
      .select('guild_id,guild_name,kind,organization_id,organizations!inner(id,name,slug,address,logo_url,banner_url,active)')
      .eq('enabled', true).eq('organizations.active', true);
    if (guildError) throw guildError;
    const organizationIds=[...new Set((guilds||[]).map((guild:any)=>String(guild.organization_id)))];
    const {data:accessRows,error:accessError}=organizationIds.length?await db.from('app_settings').select('organization_id,key,value').in('organization_id',organizationIds).in('key',['organization_access','page_permissions']):{data:[],error:null};
    if(accessError)throw accessError;const expiredIds=new Set((accessRows||[]).filter((row:any)=>row.key==='organization_access'&&row.value?.expires_at&&Date.parse(String(row.value.expires_at))<=Date.now()).map((row:any)=>String(row.organization_id))),pageSettings=new Map((accessRows||[]).filter((row:any)=>row.key==='page_permissions').map((row:any)=>[String(row.organization_id),row.value||{}]));
    if(expiredIds.size)await db.from('organizations').update({active:false,updated_at:new Date().toISOString()}).in('id',[...expiredIds]);
    const { data: mappings, error: mappingError } = await db.from('organization_role_mappings').select('*').eq('enabled', true);
    if (mappingError) throw mappingError;

    const matches = new Map<string, { organization: any; permission_level: number; panel_role: string; nickname: string; guild_ids: string[]; discord_role_ids:string[] }>();
    const liveRoles = new Map<string, Map<string, { name: string; position: number }>>();
    for (const guild of (guilds || []).filter((item:any)=>!expiredIds.has(String(item.organization_id)) && (!voucherCode || String(item.guild_id) === voucherGuildId))) {
      const memberResponse = await fetch(`https://discord.com/api/v10/guilds/${guild.guild_id}/members/${discordUser.id}`, { headers: { Authorization: `Bot ${botToken}` } });
      if (memberResponse.status === 404) continue;
      if (!memberResponse.ok) { console.warn('Guild indisponibil', guild.guild_id, memberResponse.status); continue; }
      const member = await memberResponse.json();
      if (!liveRoles.has(String(guild.guild_id))) {
        const rolesResponse = await fetch(`https://discord.com/api/v10/guilds/${guild.guild_id}/roles`, { headers: { Authorization: `Bot ${botToken}` } });
        const roles = new Map<string, { name: string; position: number }>();
        if (rolesResponse.ok) for (const role of (await rolesResponse.json()) as any[]) roles.set(String(role.id), { name: String(role.name), position: Number(role.position) || 0 });
        liveRoles.set(String(guild.guild_id), roles);
      }
      const roleIds = new Set<string>(Array.isArray(member.roles) ? member.roles.map(String) : []);
      const highestDiscordRole = [...roleIds]
        .map((roleId) => liveRoles.get(String(guild.guild_id))?.get(roleId))
        .filter(Boolean)
        .sort((a:any, b:any) => b.position - a.position)[0] as { name: string; position: number } | undefined;
      const best = (mappings || []).filter((item: any) => item.organization_id === guild.organization_id && item.guild_id === guild.guild_id && roleIds.has(String(item.discord_role_id)))
        .sort((a: any, b: any) => Number(b.permission_level) - Number(a.permission_level) || Number(b.priority) - Number(a.priority))[0];
      if (!best) {
        if (isPlatformAdmin && highestDiscordRole) matches.set(guild.organization_id, {
          organization: guild.organizations, permission_level: 99, panel_role: highestDiscordRole.name,
          nickname: String(member.nick || discordUser.global_name || discordUser.username), guild_ids: [String(guild.guild_id)], discord_role_ids: [...roleIds],
        });
        continue;
      }
      const existing = matches.get(guild.organization_id);
      if (!existing || Number(best.permission_level) > existing.permission_level) {
        matches.set(guild.organization_id, {
          organization: guild.organizations,
          permission_level: isPlatformAdmin?99:Number(best.permission_level),
          // Afișăm numele actual al rolului Discord; panel_role rămâne doar compatibilitate veche.
          panel_role: String(highestDiscordRole?.name || best.discord_role_name || best.panel_role || 'Grad Discord'),
          nickname: String(member.nick || discordUser.global_name || discordUser.username), guild_ids: [String(guild.guild_id)],discord_role_ids:[...roleIds],
        });
      } else if (!existing.guild_ids.includes(String(guild.guild_id))) existing.guild_ids.push(String(guild.guild_id));
    }
    const available = [...matches.entries()].map(([organization_id, value]) => {const rules:any=pageSettings.get(organization_id)||{},configured=Object.values(rules).some((roleIds:any)=>Array.isArray(roleIds)&&roleIds.length>0),allowed_pages=Object.entries(rules).filter(([,roleIds]:any)=>Array.isArray(roleIds)&&roleIds.some((roleId:string)=>value.discord_role_ids.includes(String(roleId)))).map(([page])=>page);return { organization_id, ...value,allowed_pages,page_permissions_configured:configured }})
      .sort((a, b) => b.permission_level - a.permission_level || String(a.organization.name).localeCompare(String(b.organization.name)));
    if (!available.length) return reply({ error: 'Nu ai niciun rol configurat într-o organizație a platformei.', code: 'NO_ORGANIZATION' }, 403);
    if (voucherCode) return reply({
      error: 'Voucherul trebuie configurat într-o organizație nouă sau existentă.',
      code: 'VOUCHER_REQUIRES_ORGANIZATION_SETUP',
      voucher_code: voucherCode,
      voucher_guild_id: voucherGuildId || null,
    }, 409);
    const requestedId = String(body.organization_id || '').trim();
    const active = available.find((item) => item.organization_id === requestedId) || available[0];
    const userData = {
      discord_id: String(discordUser.id), username: String(discordUser.username), display_name: active.nickname,
      email: discordUser.email ?? null, avatar: avatarUrl(discordUser.id, discordUser.avatar), avatar_url: avatarUrl(discordUser.id, discordUser.avatar),
      role: active.panel_role, default_role: active.panel_role,
    };
    const { data: savedUser, error: userError } = await db.from('users').upsert(userData, { onConflict: 'discord_id' }).select('*').single();
    if (userError) throw userError;
    await Promise.all(available.map((item) => db.from('organization_members').upsert({
      organization_id: item.organization_id, discord_id: discordUser.id, panel_role: item.panel_role,
      permission_level: item.permission_level, active: true, last_verified_at: new Date().toISOString(),
    }, { onConflict: 'organization_id,discord_id' })));

    const sessionToken = randomToken();
    const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
    const { error: sessionError } = await db.from('panel_sessions').insert({
      token_hash: await sha256(sessionToken), organization_id: active.organization_id, discord_id: discordUser.id,
      permission_level: active.permission_level, is_platform_admin: isPlatformAdmin, expires_at: expiresAt,
    });
    if (sessionError) throw sessionError;
    await db.from('panel_sessions').delete().eq('discord_id', discordUser.id).lt('expires_at', new Date().toISOString());

    return reply({
      user: { ...savedUser, role: active.panel_role, default_role: active.panel_role, permission_level: active.permission_level,platform_admin:isPlatformAdmin,discord_role_ids:active.discord_role_ids,allowed_pages:active.allowed_pages,page_permissions_configured:active.page_permissions_configured,
        organization_id: active.organization_id, organization: active.organization },
      session_token: sessionToken, expires_at: expiresAt,
      active_organization: { id: active.organization_id, ...active.organization, permission_level: active.permission_level, panel_role: active.panel_role,allowed_pages:active.allowed_pages },
      organizations: available.map((item) => ({ id: item.organization_id, ...item.organization, permission_level: item.permission_level, panel_role: item.panel_role,allowed_pages:item.allowed_pages })),
    });
  } catch (error) {
    console.error(error);
    return reply({ error: error instanceof Error ? error.message : 'Eroare necunoscută.' }, 500);
  }
});
