import {createClient} from 'jsr:@supabase/supabase-js@2.112.3';
import {requirePanelSession} from '../_shared/panel-session.ts';
import {isPlatformAdminAccount} from '../_shared/platform-admin.ts';
import {resolvePackageFeatures} from '../_shared/package-features.ts';
import {getPlatformSecret} from '../_shared/platform-secrets.ts';
import {deliverDiscordRoute, routeCandidates, requestDiscordTarget} from '../_shared/discord-delivery.ts';
const cors={'Access-Control-Allow-Origin':'https://panel-pro.ro','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-panel-session','Access-Control-Max-Age':'86400','Content-Type':'application/json'};

const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:cors});
const normalizeBlackMarketName=(value:unknown)=>String(value??'').replace(/^\s*\d{1,12}\s+/,'').replace(/^\s*\d{1,12}\s*[|:/#-]\s*/,'').replace(/\s*[|:/#-]\s*\d{1,12}\s*$/,'').replace(/\s+\d{1,12}\s*$/,'').replace(/\s*[[(]\s*\d{1,12}\s*[\])]\s*$/,'').replace(/\s{2,}/g,' ').trim();
const allowedCommunityReactions=new Set(['✅','❌','👍','❤️','🤔']);
const disciplineDiscordComponents=(scope:string,kind:'warning'|'sanction',id:string)=>[{type:1,components:kind==='warning'?[{type:2,style:3,label:'Marchează rezolvat',custom_id:`panel:discipline:${scope}:resolve:warning:${id}`},{type:2,style:4,label:'Șterge',custom_id:`panel:discipline:${scope}:delete:warning:${id}`}]:[{type:2,style:3,label:'Marchează achitată',custom_id:`panel:discipline:${scope}:resolve:sanction:${id}`},{type:2,style:2,label:'Anulează',custom_id:`panel:discipline:${scope}:cancel:sanction:${id}`},{type:2,style:4,label:'Șterge',custom_id:`panel:discipline:${scope}:delete:sanction:${id}`}]}];
const actionDiscordComponents=(id:string)=>[{type:1,components:[{type:2,style:4,label:'Șterge acțiunea',custom_id:`panel:actions:organization:delete:${id}`}]}];
Deno.serve(async(req)=>{if(req.method==='OPTIONS')return new Response('ok',{headers:cors});if(req.method!=='POST')return reply({error:'Method not allowed'},405);let stage='request';try{
 stage='parse_body';
 const body=await req.json();
if (body.action === 'create') {
    if (!['organization', 'departments'].includes(String(body.audience || ''))) {
        return reply({
            error: 'Alege Organizație sau Birouri / Angajați.'
        }, 400);
    }
}
 const keys=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')??'{}'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||keys.default;const db=createClient(Deno.env.get('SUPABASE_URL')!,key);
stage='load_panel_session';
const session = await requirePanelSession(db, req);

const du = {
    id: session.discord_id
};

const organizationId = session.organization_id;

const { data: requestAllowed, error: requestRateError } = await db.rpc('consume_panel_rate_limit', {
    p_key: `community-posts:${organizationId}:${session.discord_id}`,
    p_limit: 180,
    p_window_seconds: 900,
});
if (requestRateError) {
    console.error('Community posts rate-limit unavailable:', requestRateError.message);
    return reply({ error: 'Protecția anti-abuz este temporar indisponibilă. Încearcă din nou în câteva minute.' }, 503);
}
if (requestAllowed === false) return reply({ error: 'Ai atins limita temporară pentru această secțiune. Încearcă din nou mai târziu.' }, 429);

const isPlatformAdmin = await isPlatformAdminAccount(db, session.discord_id);
stage='load_permission_settings';
const { data: permissionSettings, error: permissionSettingsError } =
    await db
        .from('app_settings')
        .select('key,value')
        .eq('organization_id', organizationId)
        .in('key', [
            'page_permissions',
            'action_permissions',
            'communication_permissions',
            'discipline_permissions',
            'organization_package'
        ]);

if (permissionSettingsError) {
    throw permissionSettingsError;
}

const pagePermissionSetting =
    (permissionSettings || []).find(
        item => item.key === 'page_permissions'
    );

const actionPermissionSetting =
    (permissionSettings || []).find(
        item => item.key === 'action_permissions'
    );

const pagePermissions =
    pagePermissionSetting?.value &&
    typeof pagePermissionSetting.value === 'object'
        ? pagePermissionSetting.value
        : {};

const actionPermissions =
    actionPermissionSetting?.value &&
    typeof actionPermissionSetting.value === 'object'
        ? actionPermissionSetting.value
        : {};

const communicationSetting =
    (permissionSettings || []).find(item => item.key === 'communication_permissions');
const communicationPermissions = communicationSetting?.value && typeof communicationSetting.value === 'object'
    ? communicationSetting.value
    : {};
const disciplineSetting =
    (permissionSettings || []).find(item => item.key === 'discipline_permissions');
const disciplinePermissions = disciplineSetting?.value && typeof disciplineSetting.value === 'object'
    ? disciplineSetting.value
    : {};
const packageSetting = (permissionSettings || []).find(item => item.key === 'organization_package');
const packageFeatures = resolvePackageFeatures(packageSetting?.value || {});
const hasDisciplineFeature = (scope:string) =>
    isPlatformAdmin || packageFeatures.includes(scope === 'organization' ? 'discipline_organization' : 'discipline_departments');
const hasCommunicationFeature = (audience:string) =>
    isPlatformAdmin || packageFeatures.includes(audience === 'organization' ? 'announcements_organization' : 'announcements_departments');

const allowedAnnouncementRoles =
    Array.isArray(pagePermissions['anunturi.html'])
        ? pagePermissions['anunturi.html'].map(String)
        : [];

const allowedAnnouncementPublishRoles =
    Array.isArray(actionPermissions['anunturi.publish'])
        ? actionPermissions['anunturi.publish'].map(String)
        : [];

const sessionDiscordRoleIds =
    Array.isArray(session.discord_role_ids)
        ? session.discord_role_ids.map(String)
        : [];

const { data: permissionGuilds, error: permissionGuildsError } = await db
    .from('organization_guilds')
    .select('guild_id,kind')
    .eq('organization_id', organizationId)
    .eq('enabled', true);
if (permissionGuildsError) throw permissionGuildsError;
const { data: permissionRoleMappings, error: permissionRoleMappingsError } = await db
    .from('organization_role_mappings')
    .select('guild_id,discord_role_id,discord_role_name,panel_role')
    .eq('organization_id', organizationId)
    .eq('enabled', true);
if (permissionRoleMappingsError) throw permissionRoleMappingsError;
const guildIdsForAudience = (audience:string) => {
    const configuredGuilds = permissionGuilds || [];
    const hasSeparatedGuilds = configuredGuilds.some((guild:any) => String(guild.kind || '') === 'primary')
        && configuredGuilds.some((guild:any) => String(guild.kind || '') === 'secondary');
    if (!hasSeparatedGuilds) return configuredGuilds.map((guild:any) => String(guild.guild_id));
    const preferredKind = audience === 'organization' ? 'secondary' : 'primary';
    const preferred = (permissionGuilds || [])
        .filter((guild:any) => String(guild.kind || '') === preferredKind)
        .map((guild:any) => String(guild.guild_id));
    return preferred;
};
const roleIdsForAudience = (audience:string) => {
    const guildIds = new Set(guildIdsForAudience(audience));
    const mappedIds = [...new Set((permissionRoleMappings || [])
        .filter((role:any) => guildIds.has(String(role.guild_id)))
        .map((role:any) => String(role.discord_role_id || '').trim())
        .filter(Boolean))];
    // Pentru două servere nu permitem fallback la rolurile celuilalt server:
    // o audiență fără mapări dedicate trebuie configurată explicit. Pentru
    // configurațiile vechi cu un singur server păstrăm compatibilitatea.
    const hasSeparatedGuilds = (permissionGuilds || []).some((guild:any) => String(guild.kind || '') === 'primary')
        && (permissionGuilds || []).some((guild:any) => String(guild.kind || '') === 'secondary');
    if (!mappedIds.length) return hasSeparatedGuilds ? [] : [...new Set(sessionDiscordRoleIds)];
    return [...new Set(sessionDiscordRoleIds.filter((roleId) => mappedIds.includes(String(roleId))))];
};
const roleIdsForAllAudiences = () => [...new Set([
    ...roleIdsForAudience('departments'),
    ...roleIdsForAudience('organization')
])];

// Accesul la Anunțuri nu are nevoie de fallback-ul pentru rolul organizațional
// sau de mapările folosite de Marketplace/Disciplină. Returnăm rapid configurația
// deja încărcată și evităm două interogări suplimentare la fiecare deschidere.
if (body.action === 'announcement_access') {
    const announcementAudienceRoles = (audience:string, kind:'read'|'write') =>
        Array.isArray(communicationPermissions?.[audience]?.[kind])
            ? communicationPermissions[audience][kind].map(String)
            : [];
    const announcementCanForAudience = (audience:string, kind:'read'|'write') =>
        hasCommunicationFeature(audience) && (isPlatformAdmin || roleIdsForAudience(audience).some(roleId => announcementAudienceRoles(audience, kind).includes(roleId)));
    const announcementPageAccess =
        isPlatformAdmin || roleIdsForAllAudiences().some(roleId => allowedAnnouncementRoles.includes(roleId));
    const announcementPublishAccess =
        isPlatformAdmin || roleIdsForAllAudiences().some(roleId => allowedAnnouncementPublishRoles.includes(roleId));
    const readAudiences = isPlatformAdmin
        ? ['organization', 'departments']
        : ['organization', 'departments'].filter(audience => announcementCanForAudience(audience, 'read'));
    const writeAudiences = isPlatformAdmin
        ? ['organization', 'departments']
        : ['organization', 'departments'].filter(audience => announcementCanForAudience(audience, 'write'));
    return reply({
        read: communicationSetting ? readAudiences.length > 0 : announcementPageAccess,
        write: communicationSetting ? writeAudiences.length > 0 : announcementPublishAccess,
        read_audiences: communicationSetting ? readAudiences : (announcementPageAccess ? ['organization', 'departments'].filter(hasCommunicationFeature) : []),
        write_audiences: communicationSetting ? writeAudiences : (announcementPublishAccess ? ['organization', 'departments'].filter(hasCommunicationFeature) : []),
        platform_admin: isPlatformAdmin
    });
}

// Permisiunile disciplinare sunt configurate pe rolurile Discord, însă rolul
// organizațional activ este păstrat în members. Îl folosim ca fallback pentru
// sesiunile create înainte ca proprietarul să salveze ultima configurație.
const { data: activeMemberForPermissions, error: activeMemberError } = await db
    .from('organization_members')
    .select('panel_role')
    .eq('organization_id', organizationId)
    .eq('discord_id', session.discord_id)
    .eq('active', true)
    .maybeSingle();
if (activeMemberError) throw activeMemberError;
const activePanelRole = String(activeMemberForPermissions?.panel_role || '').trim().toLowerCase();
const roleIdsFromActivePanelRole = activePanelRole
    ? (permissionRoleMappings || [])
        .filter((role: any) => String(role.panel_role || '').trim().toLowerCase() === activePanelRole)
        .map((role: any) => String(role.discord_role_id || '').trim())
        .filter(Boolean)
    : [];
const effectiveDiscordRoleIds = [...new Set([...sessionDiscordRoleIds, ...roleIdsFromActivePanelRole])];
const effectiveRoleIdsForAudience = (audience:string) => {
    const guildIds = new Set(guildIdsForAudience(audience));
    const fallbackIds = (permissionRoleMappings || [])
        .filter((role:any) => activePanelRole && String(role.panel_role || '').trim().toLowerCase() === activePanelRole && guildIds.has(String(role.guild_id)))
        .map((role:any) => String(role.discord_role_id || '').trim())
        .filter(Boolean);
    return [...new Set([...roleIdsForAudience(audience), ...fallbackIds])];
};

const hasActionsFeature = isPlatformAdmin || packageFeatures.includes('actions_organization');
const actionPermissionRoles = (kind:'read'|'write'|'delete') => {
    const effectiveKind = kind === 'delete' ? 'write' : kind;
    return Array.isArray(actionPermissions[`actions.organization.${effectiveKind}`]) ? actionPermissions[`actions.organization.${effectiveKind}`].map(String) : [];
};
const canAction = (kind:'read'|'write'|'delete') => hasActionsFeature && (isPlatformAdmin || effectiveRoleIdsForAudience('organization').some(roleId => actionPermissionRoles(kind).includes(roleId)));
const configuredActionGuilds = async () => {
    const { data, error } = await db.from('organization_guilds').select('guild_id,guild_name,kind,enabled').eq('organization_id', organizationId).eq('enabled', true).order('kind');
    if (error) throw error;
    return (data || []).filter((item:any) => /^\d{15,22}$/.test(String(item.guild_id || '')));
};
const loadDiscordGuildMembers = async (guildId:string) => {
    const botToken = await getPlatformSecret(db, 'discord_bot_token');
    if (!botToken) throw new Error('Botul Discord nu este configurat pentru această organizație.');
    const members:any[] = [];
    let after = '0';
    for (let page = 0; page < 20; page++) {
        const query = after === '0' ? '?limit=1000' : `?limit=1000&after=${after}`;
        const response = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members${query}`, { headers: { Authorization: `Bot ${botToken}` } });
        if (!response.ok) throw new Error(`Membrii Guild-ului nu pot fi citiți (HTTP ${response.status}).`);
        const batch = await response.json();
        if (!Array.isArray(batch) || !batch.length) break;
        members.push(...batch);
        if (batch.length < 1000) break;
        after = String(batch[batch.length - 1]?.user?.id || '0');
        if (after === '0') break;
    }
    return members.map((member:any) => ({
        discord_id: String(member?.user?.id || ''),
        name: String(member?.nick || member?.user?.global_name || member?.user?.username || member?.user?.id || '').trim(),
        username: String(member?.user?.username || '').trim(),
        role_ids: Array.isArray(member?.roles) ? member.roles.map((id:any) => String(id)) : [],
        is_bot: member?.user?.bot === true
    })).filter((member:any) => /^\d{15,22}$/.test(member.discord_id) && member.name && !member.is_bot);
};
const loadDisciplineTargets = async (scope:string) => {
    const audience = scope === 'organization' ? 'organization' : 'departments';
    const guildIds = guildIdsForAudience(audience);
    if (!guildIds.length) return [];

    const discordMembers:any[] = [];
    for (const guildId of guildIds) discordMembers.push(...await loadDiscordGuildMembers(guildId));
    const uniqueMembers = [...new Map(discordMembers.map((member:any) => [String(member.discord_id), member])).values()];
    const ids = uniqueMembers.map((member:any) => String(member.discord_id));
    const [{ data: profiles, error: profilesError }, { data: employees, error: employeesError }] = ids.length
        ? await Promise.all([
            db.from('users').select('discord_id,display_name,username').in('discord_id', ids),
            db.from('organization_employees').select('discord_id,full_name').eq('organization_id', organizationId).is('archived_at', null).in('discord_id', ids)
        ])
        : [{ data: [], error: null }, { data: [], error: null }];
    if (profilesError) throw profilesError;
    if (employeesError) throw employeesError;

    const audienceGuildIds = new Set(guildIds.map(String));
    const roleById = new Map((permissionRoleMappings || [])
        .filter((role:any) => audienceGuildIds.has(String(role.guild_id)))
        .map((role:any) => [String(role.discord_role_id), role]));
    return uniqueMembers.map((member:any) => {
        const profile = (profiles || []).find((item:any) => String(item.discord_id) === String(member.discord_id));
        const employee = (employees || []).find((item:any) => String(item.discord_id) === String(member.discord_id));
        const roleLabels = (member.role_ids || [])
            .map((roleId:string) => roleById.get(String(roleId)))
            .filter(Boolean)
            .map((role:any) => String(role.discord_role_name || role.panel_role || role.discord_role_id || '').trim())
            .filter(Boolean);
        return {
            discord_id: member.discord_id,
            name: employee?.full_name || profile?.display_name || profile?.username || member.name || `Discord ${member.discord_id}`,
            ...(roleLabels.length ? { role: [...new Set(roleLabels)].join(', ') } : {})
        };
    }).sort((left:any, right:any) => String(left.name).localeCompare(String(right.name), 'ro'));
};
const notifyActionDiscord = async (record:any) => {
    const { data: settings } = await db.from('organization_settings').select('webhook_routes,discord_channel_routes,panel_public_url').eq('organization_id', organizationId).maybeSingle();
    const routeKey = 'log_actions_organization';
    if (!routeCandidates(settings, routeKey).some((item) => item.candidates.length)) return null;
    const site = String(settings?.panel_public_url || 'https://panel-pro.ro').replace(/\/$/, '');
    const participants = Array.isArray(record.participants) ? record.participants : [];
    const delivery = await deliverDiscordRoute(db, settings, routeKey, JSON.stringify({ embeds: [{ title: `✅ Acțiune nouă: ${record.action_label}`, description: record.description || 'A fost înregistrată o acțiune a organizației.', color: 5763719, url: `${site}/anunturi.html?actions=${record.id}`, fields: [{ name: 'Tip', value: record.action_type || record.action_label, inline: true }, { name: 'Participanți', value: participants.length ? participants.map((item:any) => `• ${item.name}`).join('\n').slice(0, 1024) : 'Nespecificați' }, ...(record.notes ? [{ name: 'Note', value: String(record.notes).slice(0, 1024) }] : [])], footer: { text: `Panel Pro · ${record.created_by_name || record.created_by_discord_id}` } }], components: actionDiscordComponents(String(record.id)) }));
    return delivery.results[0]?.id || null;
};
if (String(body.action || '').startsWith('actions_')) {
    if (!hasActionsFeature) return reply({ error: 'Modulul Acțiuni este disponibil în pachetul Operations sau Full.' }, 403);
    if (body.action === 'actions_access') return reply({ enabled: true, read: canAction('read'), write: canAction('write'), delete: canAction('delete'), platform_admin: isPlatformAdmin, package_code: String(packageSetting?.value?.code || 'standard') });
    const requiredPermission = body.action === 'actions_create' || body.action === 'actions_members' || body.action === 'actions_guilds' ? 'write' : body.action === 'actions_delete' ? 'delete' : 'read';
    if (!canAction(requiredPermission as any)) return reply({ error: 'Nu ai permisiunea necesară pentru modulul Acțiuni.' }, 403);
    if (body.action === 'actions_guilds') return reply({ guilds: await configuredActionGuilds() });
    if (body.action === 'actions_members') {
        const guildId = String(body.guild_id || '').trim();
        if (!(await configuredActionGuilds()).some((guild:any) => String(guild.guild_id) === guildId)) return reply({ error: 'Guild-ul selectat nu aparține organizației active.' }, 403);
        return reply({ members: await loadDiscordGuildMembers(guildId) });
    }
    if (body.action === 'actions_list') {
        const { data, error } = await db.from('organization_actions').select('*').eq('organization_id', organizationId).order('created_at', { ascending: false });
        if (error) throw error;
        return reply({ actions: data || [], access: { read: canAction('read'), write: canAction('write'), delete: canAction('delete'), platform_admin: isPlatformAdmin }, guilds: await configuredActionGuilds() });
    }
    if (body.action === 'actions_stats') {
        const days = Math.min(365, Math.max(1, Number(body.days) || 7));
        const periodEnd = new Date();
        const periodStart = new Date(periodEnd.getTime() - ((days - 1) * 86400000));
        const { data, error } = await db.from('organization_actions')
            .select('id,action_type,action_label,participants,created_at,created_by_discord_id,created_by_name')
            .eq('organization_id', organizationId)
            .gte('created_at', periodStart.toISOString())
            .lte('created_at', periodEnd.toISOString())
            .order('created_at', { ascending: false });
        if (error) throw error;
        const people = new Map<string, any>();
        const types = new Map<string, number>();
        for (const row of data || []) {
            const type = String(row.action_label || row.action_type || 'Acțiune').trim();
            types.set(type, (types.get(type) || 0) + 1);
            for (const participant of Array.isArray(row.participants) ? row.participants : []) {
                const discordId = String(participant?.discord_id || participant?.id || '').trim();
                const name = String(participant?.name || participant?.username || discordId || 'Membru necunoscut').trim();
                if (!discordId) continue;
                const current = people.get(discordId) || { discord_id: discordId, name, participations: 0, action_ids: new Set<string>(), action_types: new Map<string, number>(), last_activity_at: null };
                current.name = name || current.name;
                current.participations += 1;
                current.action_ids.add(String(row.id));
                current.action_types.set(type, (current.action_types.get(type) || 0) + 1);
                if (!current.last_activity_at || String(row.created_at) > current.last_activity_at) current.last_activity_at = row.created_at;
                people.set(discordId, current);
            }
        }
        const ranking = [...people.values()]
            .map((person) => ({ discord_id: person.discord_id, name: person.name, participations: person.participations, distinct_actions: person.action_ids.size, action_types: Object.fromEntries(person.action_types), last_activity_at: person.last_activity_at }))
            .sort((left, right) => right.participations - left.participations || right.distinct_actions - left.distinct_actions || left.name.localeCompare(right.name, 'ro'));
        return reply({
            period: { days, start: periodStart.toISOString(), end: periodEnd.toISOString() },
            totals: { actions: (data || []).length, participations: ranking.reduce((sum, person) => sum + person.participations, 0), people: ranking.length },
            by_type: [...types.entries()].map(([label, count]) => ({ label, count })).sort((left, right) => right.count - left.count),
            ranking
        });
    }
    if (body.action === 'actions_create') {
        const label = String(body.action_label || '').trim().slice(0, 120), type = String(body.action_type || '').trim().slice(0, 40), guildId = String(body.guild_id || '').trim();
        if (label.length < 2 || !type || !/^\d{15,22}$/.test(guildId)) return reply({ error: 'Completează tipul acțiunii, denumirea și Guild-ul.' }, 400);
        const guild = (await configuredActionGuilds()).find((item:any) => String(item.guild_id) === guildId);
        if (!guild) return reply({ error: 'Guild-ul selectat nu aparține organizației active.' }, 403);
        const guildMembers = await loadDiscordGuildMembers(guildId), memberMap = new Map(guildMembers.map((item:any) => [item.discord_id, item]));
        const selectedIds = [...new Set((Array.isArray(body.participant_ids) ? body.participant_ids : []).map(String))].slice(0, 100), participants = selectedIds.map((id) => memberMap.get(id)).filter(Boolean);
        if (selectedIds.length !== participants.length) return reply({ error: 'Unul dintre participanți nu mai este membru în Guild-ul selectat.' }, 400);
        const { data: author } = await db.from('users').select('display_name,username').eq('discord_id', du.id).maybeSingle();
        const { data: actionRow, error } = await db.from('organization_actions').insert({ organization_id: organizationId, action_type: type, action_label: label, description: String(body.description || '').trim().slice(0, 4000), notes: String(body.notes || '').trim().slice(0, 4000), guild_id: guildId, guild_name: String(guild.guild_name || guildId), participants, created_by_discord_id: du.id, created_by_name: author?.display_name || author?.username || du.id }).select('*').single();
        if (error) throw error;
        let discordMessageId = null;
        try { discordMessageId = await notifyActionDiscord(actionRow); } catch (error) { console.error('Acțiunea a fost salvată, dar mesajul botului a eșuat:', error); }
        if (discordMessageId) await db.from('organization_actions').update({ discord_message_id: discordMessageId }).eq('id', actionRow.id).eq('organization_id', organizationId);
        return reply({ ok: true, action: { ...actionRow, discord_message_id: discordMessageId } });
    }
    if (body.action === 'actions_delete') {
        const id = String(body.id || '').trim();
        const { data: row, error: loadError } = await db.from('organization_actions').select('*').eq('organization_id', organizationId).eq('id', id).maybeSingle();
        if (loadError) throw loadError;
        if (!row) return reply({ error: 'Acțiunea nu există.' }, 404);
        const { data: settings } = await db.from('organization_settings').select('webhook_routes,discord_channel_routes').eq('organization_id', organizationId).maybeSingle();
        const candidate = routeCandidates(settings, 'log_announcements_organization').flatMap((item) => item.candidates)[0];
        if (row.discord_message_id && candidate) await requestDiscordTarget(db, candidate, null, { method: 'DELETE', messageId: String(row.discord_message_id) }).catch(() => null);
        const { error } = await db.from('organization_actions').delete().eq('organization_id', organizationId).eq('id', id);
        if (error) throw error;
        return reply({ ok: true, deleted_id: id });
    }
}

const marketplaceWriteRoles = new Set([
    ...(Array.isArray(pagePermissions['marketplace.html']) ? pagePermissions['marketplace.html'].map(String) : []),
    ...(Array.isArray(pagePermissions['marketplace-ilegal.html']) ? pagePermissions['marketplace-ilegal.html'].map(String) : []),
    ...(Array.isArray(actionPermissions['marketplace.delete']) ? actionPermissions['marketplace.delete'].map(String) : [])
]);
const canDeleteMarketplaceByRole =
    isPlatformAdmin ||
    effectiveDiscordRoleIds.some(roleId => marketplaceWriteRoles.has(roleId));

const marketplacePageForTable = (table:string) =>
    table === 'marketplace_ilegal' ? 'marketplace-ilegal.html' : 'marketplace.html';
const marketplaceFeatureForTable = (table:string) =>
    table === 'marketplace_ilegal' ? 'illegal_marketplace' : 'legal_marketplace';
const hasMarketplacePageAccess = (table:string) => {
    const page = marketplacePageForTable(table);
    const roles = Array.isArray(pagePermissions[page]) ? pagePermissions[page].map(String) : [];
    return isPlatformAdmin || (
        packageFeatures.includes(marketplaceFeatureForTable(table)) &&
        effectiveDiscordRoleIds.some(roleId => roles.includes(roleId))
    );
};
const loadMarketplaceItem = async (table:string, itemId:string) => {
    const query = db.from(table)
        .select('id,organization_id,created_by_discord_id')
        .eq('id', itemId);
    if (table === 'marketplace_ilegal') query.is('organization_id', null);
    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    return data;
};
const canManageMarketplaceComment = (table:string, item:any, comment:any) =>
    isPlatformAdmin ||
    String(comment.author_discord_id || '') === String(du.id) ||
    (canDeleteMarketplaceByRole && (
        table === 'marketplace_ilegal' ||
        String(item?.organization_id || '') === String(organizationId)
    ));

if (body.action === 'marketplace_access') {
    return reply({
        can_delete: canDeleteMarketplaceByRole,
        platform_admin: isPlatformAdmin
    });
}

if (['marketplace_comments_list', 'marketplace_comment_add', 'marketplace_comment_delete'].includes(String(body.action || ''))) {
    const table = String(body.table || '');
    if (!['marketplace', 'marketplace_ilegal'].includes(table)) return reply({ error: 'Tabel Marketplace invalid.' }, 400);
    if (!hasMarketplacePageAccess(table)) return reply({ error: 'Nu ai acces la comentariile acestei pagini.' }, 403);
    const itemId = String(body.item_id || '').trim();
    if (!itemId) return reply({ error: 'Anunțul nu a fost identificat.' }, 400);
    const item = await loadMarketplaceItem(table, itemId);
    if (!item) return reply({ error: 'Anunțul nu există sau nu este accesibil.' }, 404);

    if (body.action === 'marketplace_comments_list') {
        const { data: comments, error } = await db.from('marketplace_comments')
            .select('id,marketplace_table,marketplace_id,author_discord_id,author_name,content,created_at,updated_at')
            .eq('marketplace_table', table)
            .eq('marketplace_id', itemId)
            .order('created_at', { ascending: true })
            .limit(200);
        if (error) throw error;
        return reply({
            comments: (comments || []).map((comment:any) => ({
                ...comment,
                can_delete: canManageMarketplaceComment(table, item, comment)
            })),
            can_comment: true
        });
    }

    if (body.action === 'marketplace_comment_add') {
        const content = String(body.content || '').trim();
        if (!content || content.length > 2000) return reply({ error: 'Comentariul trebuie să aibă între 1 și 2000 de caractere.' }, 400);
        const { data: author } = await db.from('users').select('display_name,username').eq('discord_id', du.id).maybeSingle();
        const authorName = String(author?.display_name || author?.username || du.id).trim().slice(0, 120);
        const { data: comment, error } = await db.from('marketplace_comments').insert({
            marketplace_table: table,
            marketplace_id: itemId,
            author_discord_id: du.id,
            author_name: authorName,
            content
        }).select('id,marketplace_table,marketplace_id,author_discord_id,author_name,content,created_at,updated_at').single();
        if (error) throw error;
        return reply({ comment, can_delete: true });
    }

    const commentId = String(body.comment_id || '').trim();
    const { data: comment, error: commentError } = await db.from('marketplace_comments')
        .select('id,author_discord_id')
        .eq('id', commentId)
        .eq('marketplace_table', table)
        .eq('marketplace_id', itemId)
        .maybeSingle();
    if (commentError) throw commentError;
    if (!comment) return reply({ error: 'Comentariul nu mai există.' }, 404);
    if (!canManageMarketplaceComment(table, item, comment)) return reply({ error: 'Nu ai permisiunea să ștergi acest comentariu.' }, 403);
    const { error: deleteError } = await db.from('marketplace_comments').delete().eq('id', commentId).eq('marketplace_table', table).eq('marketplace_id', itemId);
    if (deleteError) throw deleteError;
    return reply({ ok: true, deleted_id: commentId });
}

const hasAnnouncementPageAccess =
    isPlatformAdmin ||
    roleIdsForAllAudiences().some(roleId =>
        allowedAnnouncementRoles.includes(roleId)
    );

const canPublishAnnouncements =
    isPlatformAdmin ||
    roleIdsForAllAudiences().some(roleId =>
        allowedAnnouncementPublishRoles.includes(roleId)
    );
const audienceRoles = (audience:string, kind:'read'|'write') =>
    Array.isArray(communicationPermissions?.[audience]?.[kind])
        ? communicationPermissions[audience][kind].map(String)
        : [];
const canForAudience = (audience:string, kind:'read'|'write') =>
    hasCommunicationFeature(audience) && (isPlatformAdmin || roleIdsForAudience(audience).some(roleId => audienceRoles(audience, kind).includes(roleId)));
const canManageAudience = (audience:string) => communicationSetting
    ? canForAudience(audience, 'write')
    : canPublishAnnouncements;
const disciplineRoles = (scope:string, action:'read'|'write'|'sanction') =>
    Array.isArray(disciplinePermissions?.[scope]?.[action])
        ? disciplinePermissions[scope][action].map(String)
        : [];
const canDiscipline = (scope:string, action:'read'|'write'|'sanction') =>
    hasDisciplineFeature(scope) && (isPlatformAdmin || effectiveRoleIdsForAudience(scope === 'organization' ? 'organization' : 'departments').some(roleId => disciplineRoles(scope, action).includes(roleId)));
const disciplineVisible = (scope:string, targetDiscordId:string|null) =>
    hasDisciplineFeature(scope) && (scope === 'departments'
        ? String(targetDiscordId || '') === String(session.discord_id) || canDiscipline(scope, 'read') || canDiscipline(scope, 'write') || canDiscipline(scope, 'sanction')
        : canDiscipline(scope, 'read') || canDiscipline(scope, 'write') || canDiscipline(scope, 'sanction'));
const disciplineScopeLabel = (scope:string) => scope === 'departments' ? 'Birouri / Angajați' : 'Organizație';
const readAudiences = isPlatformAdmin
    ? ['organization','departments']
    : ['organization','departments'].filter(audience => hasCommunicationFeature(audience) && canForAudience(audience,'read'));
const writeAudiences = isPlatformAdmin
    ? ['organization','departments']
    : ['organization','departments'].filter(audience => hasCommunicationFeature(audience) && canForAudience(audience,'write'));
if (body.action === 'discipline_access') {
    const departmentsAccess = { read: canDiscipline('departments', 'read'), write: canDiscipline('departments', 'write'), sanction: canDiscipline('departments', 'sanction'), own: true };
    return reply({
        departments: departmentsAccess,
        employee: departmentsAccess,
        organization: { read: canDiscipline('organization', 'read'), write: canDiscipline('organization', 'write'), sanction: canDiscipline('organization', 'sanction'), own: false },
        platform_admin: isPlatformAdmin,
        package_code: String(packageSetting?.value?.code || 'standard'),
        package_features: packageFeatures,
        organization_module_enabled: hasDisciplineFeature('organization')
    });
}
if (
    body.action === 'create' &&
    !hasCommunicationFeature(String(body.audience || ''))
) {
    return reply({ error: 'Această audiență este disponibilă numai în pachetul Full.' }, 403);
}
if (
    body.action === 'create' &&
    !(communicationSetting ? canForAudience(String(body.audience || ''), 'write') : canPublishAnnouncements)
) {
    return reply({
        error: 'Rolul tău nu are permisiunea de a publica sau administra anunțuri și sondaje.'
    }, 403);
}
  stage='load_panel_user';
  const {data:user}=await db.from('users').select('*').eq('discord_id',du.id).single();if(!user)return reply({error:'Utilizatorul nu există în panel.'},403);

const resolveDisciplineTarget = async (scope:string, targetDiscordId:string|null) => {
    const discordId = String(targetDiscordId || '').trim();
    if (!discordId) throw new Error('Selectează membrul vizat.');
    const targets = await loadDisciplineTargets(scope);
    const target = targets.find((item:any) => String(item.discord_id) === discordId);
    if (!target) throw new Error('Membrul selectat nu aparține Discordului configurat pentru această secțiune.');
    return { discordId, name: target.name };
};

const activeDisciplineCount = async (scope:string, targetDiscordId:string|null) => {
    const query = db.from('disciplinary_warnings')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('target_scope', scope)
        .eq('status', 'active');
    if (targetDiscordId) query.eq('target_discord_id', targetDiscordId);
    const { count, error } = await query;
    if (error) throw error;
    return Number(count || 0);
};

const notifyDisciplineDiscord = async (kind:'warning'|'sanction', record:any) => {
    const { data: settings } = await db.from('organization_settings')
        .select('webhook_routes,discord_channel_routes,panel_public_url')
        .eq('organization_id', organizationId)
        .maybeSingle();
    const audience = record.target_scope === 'departments' ? 'departments' : 'organization';
    const routeKey = audience === 'departments' ? 'log_announcements_departments' : 'log_announcements_organization';
    if (!routeCandidates(settings, routeKey).some((item) => item.candidates.length)) return null;
    const site = String(settings?.panel_public_url || 'https://panel-pro.ro').replace(/\/$/, '');
    const detailUrl = `${site}/anunturi.html?discipline=${kind}&id=${record.id}`;
    const delivery = await deliverDiscordRoute(db, settings, routeKey, JSON.stringify({ embeds: [{
            title: kind === 'warning' ? '⚠️ Evidență disciplinară nouă' : '💰 Măsură financiară nouă',
            description: 'A fost înregistrată o măsură disciplinară. Detaliile sunt disponibile numai persoanelor autorizate în panel.',
            color: kind === 'warning' ? 16753920 : 15548997,
            url: detailUrl,
            footer: { text: 'Panel Pro · acces controlat' }
        }], components: disciplineDiscordComponents(audience, kind, String(record.id)) }));
    return delivery.results[0]?.id || null;
};

if (['discipline_list', 'discipline_targets'].includes(String(body.action || ''))) {
    const { data: warnings, error: warningsError } = await db.from('disciplinary_warnings')
        .select('*').eq('organization_id', organizationId).order('created_at', { ascending: false });
    if (warningsError) throw warningsError;
    const { data: sanctions, error: sanctionsError } = await db.from('disciplinary_sanctions')
        .select('*').eq('organization_id', organizationId).order('created_at', { ascending: false });
    if (sanctionsError) throw sanctionsError;
    const visibleWarnings = (warnings || []).filter((item:any) => disciplineVisible(item.target_scope, item.target_discord_id));
    const visibleSanctions = (sanctions || []).filter((item:any) => disciplineVisible(item.target_scope, item.target_discord_id));
    if (body.action === 'discipline_targets') {
        const scope = String(body.target_scope || '');
        if (!canDiscipline(scope, 'write') && !canDiscipline(scope, 'sanction')) return reply({ error: 'Nu ai dreptul să selectezi destinatari pentru această categorie.' }, 403);
        return reply({ targets: await loadDisciplineTargets(scope) });
    }
    return reply({
        warnings: visibleWarnings,
        sanctions: visibleSanctions,
        access: {
            departments: { read: canDiscipline('departments', 'read'), write: canDiscipline('departments', 'write'), sanction: canDiscipline('departments', 'sanction'), own: true },
            employee: { read: canDiscipline('departments', 'read'), write: canDiscipline('departments', 'write'), sanction: canDiscipline('departments', 'sanction'), own: true },
            organization: { read: canDiscipline('organization', 'read'), write: canDiscipline('organization', 'write'), sanction: canDiscipline('organization', 'sanction'), own: false },
            platform_admin: isPlatformAdmin
        }
    });
}

if (body.action === 'discipline_create_warning') {
    const scope = String(body.target_scope || '');
    if (!['departments', 'organization'].includes(scope)) return reply({ error: 'Categoria disciplinară este invalidă.' }, 400);
    if (!canDiscipline(scope, 'write')) return reply({ error: 'Rolul tău nu poate emite avertismente pentru această categorie.' }, 403);
    const target = await resolveDisciplineTarget(scope, String(body.target_discord_id || ''));
    const count = await activeDisciplineCount(scope, target.discordId);
    if (count >= 3) return reply({ error: 'Destinatarul are deja 3 avertismente active. Poți aplica o sancțiune financiară.' }, 409);
    const { data: warning, error } = await db.from('disciplinary_warnings').insert({
        organization_id: organizationId, target_scope: scope, target_discord_id: target.discordId, target_name: target.name,
        reason: String(body.reason || '').trim(), notes: String(body.notes || '').trim(), evidence_url: String(body.evidence_url || '').trim() || null,
        issued_by_discord_id: du.id, issued_by_name: user.display_name || user.username || du.id
    }).select('*').single();
    if (error) throw error;
    const messageId = await notifyDisciplineDiscord('warning', warning);
    if (messageId) await db.from('disciplinary_warnings').update({ discord_message_id: messageId }).eq('id', warning.id).eq('organization_id', organizationId);
    return reply({ ok: true, warning: { ...warning, discord_message_id: messageId }, active_warning_count: count + 1 });
}

if (body.action === 'discipline_create_sanction') {
    const scope = String(body.target_scope || '');
    if (!['departments', 'organization'].includes(scope)) return reply({ error: 'Categoria disciplinară este invalidă.' }, 400);
    if (!canDiscipline(scope, 'sanction')) return reply({ error: 'Rolul tău nu poate aplica sancțiuni pentru această categorie.' }, 403);
    const target = await resolveDisciplineTarget(scope, String(body.target_discord_id || ''));
    const count = await activeDisciplineCount(scope, target.discordId);
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) return reply({ error: 'Introdu o sumă validă mai mare decât 0.' }, 400);
    const currency = String(body.currency || 'USD').trim().toUpperCase();
    if (!/^[A-Z0-9]{2,8}$/.test(currency)) return reply({ error: 'Moneda introdusă este invalidă.' }, 400);
    const { data: sanction, error } = await db.from('disciplinary_sanctions').insert({
        organization_id: organizationId, target_scope: scope, target_discord_id: target.discordId, target_name: target.name,
        warning_count_snapshot: count, amount, currency, reason: String(body.reason || '').trim(), notes: String(body.notes || '').trim(),
        evidence_url: String(body.evidence_url || '').trim() || null, due_at: body.due_at ? new Date(body.due_at).toISOString() : null,
        issued_by_discord_id: du.id, issued_by_name: user.display_name || user.username || du.id
    }).select('*').single();
    if (error) throw error;
    const messageId = await notifyDisciplineDiscord('sanction', sanction);
    if (messageId) await db.from('disciplinary_sanctions').update({ discord_message_id: messageId }).eq('id', sanction.id).eq('organization_id', organizationId);
    return reply({ ok: true, sanction: { ...sanction, discord_message_id: messageId } });
}

if (body.action === 'discipline_resolve') {
    const kind = body.kind === 'sanction' ? 'sanction' : 'warning';
    const table = kind === 'sanction' ? 'disciplinary_sanctions' : 'disciplinary_warnings';
    const { data: item, error: itemError } = await db.from(table).select('*').eq('organization_id', organizationId).eq('id', body.id).maybeSingle();
    if (itemError) throw itemError;
    if (!item) return reply({ error: 'Înregistrarea disciplinară nu există.' }, 404);
    if (!canDiscipline(item.target_scope, kind === 'sanction' ? 'sanction' : 'write')) return reply({ error: 'Nu ai dreptul să închizi această înregistrare.' }, 403);
    const nextStatus = kind === 'sanction' ? (body.status === 'cancelled' ? 'cancelled' : body.status === 'waived' ? 'waived' : 'paid') : (body.status === 'revoked' ? 'revoked' : 'resolved');
    const { error } = await db.from(table).update({ status: nextStatus, resolved_at: new Date().toISOString(), resolved_by_discord_id: du.id, resolution_note: String(body.resolution_note || '').trim() || null, updated_at: new Date().toISOString() }).eq('organization_id', organizationId).eq('id', body.id);
    if (error) throw error;
    return reply({ ok: true, status: nextStatus });
}
if (body.action === 'discipline_delete') {
    const kind = body.kind === 'sanction' ? 'sanction' : 'warning';
    const table = kind === 'sanction' ? 'disciplinary_sanctions' : 'disciplinary_warnings';
    const { data: item, error: itemError } = await db.from(table).select('*').eq('organization_id', organizationId).eq('id', body.id).maybeSingle();
    if (itemError) throw itemError;
    if (!item) return reply({ error: 'Înregistrarea disciplinară nu există.' }, 404);
    const configuredDelete = canDiscipline(item.target_scope, kind === 'sanction' ? 'sanction' : 'write');
    const isAuthor = String(item.issued_by_discord_id || '') === String(du.id);
    if (!hasDisciplineFeature(item.target_scope)) return reply({ error: 'Această categorie disciplinară nu este inclusă în pachetul organizației.' }, 403);
    if (!isPlatformAdmin && !isAuthor && !configuredDelete) return reply({ error: 'Nu ai dreptul să ștergi această înregistrare.' }, 403);

    const { data: settings } = await db.from('organization_settings').select('webhook_routes,discord_channel_routes').eq('organization_id', organizationId).maybeSingle();
    if (item.discord_message_id) {
        const audience = item.target_scope === 'departments' ? 'departments' : 'organization';
        const routeKey = audience === 'departments' ? 'log_announcements_departments' : 'log_announcements_organization';
        const targets = routeCandidates(settings, routeKey).flatMap((item) => item.candidates);
        await Promise.all(targets.map((target) => requestDiscordTarget(db, target, null, { method: 'DELETE', messageId: String(item.discord_message_id) }).catch(() => null)));
    }
    const { error } = await db.from(table).delete().eq('organization_id', organizationId).eq('id', body.id);
    if (error) throw error;
    return reply({ ok: true, deleted_id: body.id });
}
const own = async (id:string) => {

    const { data, error } = await db
        .from('community_posts')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('id', id)
        .maybeSingle();

    if (error) {
        throw error;
    }

    if (!data) {
        throw new Error(
            'Postarea nu mai există în organizația activă.'
        );
    }

     return data;
};
 if(body.action==='create'){


    if (!['organization', 'departments'].includes(body.audience)) {
        throw new Error('Alege Organizație sau Birouri / Angajați.');
    }
    if (communicationSetting && !canForAudience(String(body.audience), 'write')) {
        return reply({ error: 'Rolul tău nu poate publica pentru această audiență.' }, 403);
    }

    const audience = body.audience;
    stage='insert_community_post';
    const {data:post,error}=await db.from('community_posts').insert({
        organization_id: organizationId,
        audience: audience,
        post_type: body.post_type === 'fine' ? 'fine' : body.post_type,
        title: body.title,
        content: body.content,
        author_discord_id: du.id,
        author_name: user.display_name || user.username
    }).select().single();
    if (error) throw error;
    if (!post) throw new Error('Postarea nu a putut fi salvată.');
    if(body.post_type==='poll'){
      stage='insert_poll_options';
      const options=(body.options||[]).map((x:string,i:number)=>({organization_id:organizationId,post_id:post.id,option_text:x,position:i}));
      const {error:e}=await db.from('community_poll_options').insert(options);if(e)throw e
    }
    let discordMessageId = null;
    let discordDeliveryWarning = '';
    try {
        stage='notify_discord_bot';
        discordMessageId = await notifyDiscord(post, body.options || [], post.audience);
        await notifyCommunityLog(post, 'Postare nouă');
    } catch (error) {
        discordDeliveryWarning = error instanceof Error ? error.message : 'Canalul Discord al botului nu a putut fi contactat.';
        console.error('Postarea a fost salvată, dar livrarea Discord a eșuat:', discordDeliveryWarning);
    }

    if (discordMessageId) {
        await db
            .from('community_posts')
            .update({
                discord_message_id: discordMessageId
            })
            .eq('organization_id', organizationId)
            .eq('id', post.id);
    }

    return reply({ post, discord_delivery: discordMessageId ? 'sent' : 'unavailable', discord_warning: discordDeliveryWarning || null });
 }
 if(body.action==='update'){const post=await own(body.post_id);if(!canManageAudience(String(post.audience||'organization')))return reply({error:'Rolul tău nu poate modifica această audiență.'},403);const {error}=await db.from('community_posts').update({title:body.title,content:body.content,updated_at:new Date().toISOString()}).eq('organization_id',organizationId).eq('id',body.post_id);if(error)throw error;if(post.post_type==='poll'&&Array.isArray(body.options)){if(body.options.length<2)throw new Error('Sondajul trebuie să aibă minimum două opțiuni.');const {data:existing}=await db.from('community_poll_options').select('option_text').eq('organization_id',organizationId).eq('post_id',body.post_id).order('position');const changed=JSON.stringify((existing||[]).map((x:any)=>x.option_text))!==JSON.stringify(body.options);if(changed){const {error:deleteOptionsError}=await db.from('community_poll_options').delete().eq('organization_id',organizationId).eq('post_id',body.post_id);if(deleteOptionsError)throw deleteOptionsError;const {error:insertOptionsError}=await db.from('community_poll_options').insert(body.options.map((text:string,position:number)=>({organization_id:organizationId,post_id:body.post_id,option_text:text,position})));if(insertOptionsError)throw insertOptionsError}}return reply({ok:true})}
 if (body.action === 'delete') {
    const post = await own(body.post_id);
     if (!canManageAudience(String(post.audience || 'organization'))) {
        return reply({ error: 'Rolul tău nu poate șterge această audiență.' }, 403);
    }

    const { data: deleted, error } = await db
        .from('community_posts')
        .delete()
        .eq('organization_id', organizationId)
        .eq('id', body.post_id)
        .select('id');

    if (error) throw error;

    if (!deleted?.length) {
        throw new Error('Postarea nu a fost ștearsă.');
    }

    if (post.discord_message_id) {
        const { data: cfg } = await db
            .from('organization_settings')
            .select('webhook_routes,discord_channel_routes')
            .eq('organization_id', organizationId)
            .maybeSingle();

        const audience =
            post.audience === 'departments'
                ? 'departments'
                : 'organization';

        const routeKey = audience === 'departments' ? 'departments' : 'organization';
        const targets = routeCandidates(cfg, routeKey).flatMap((item) => item.candidates);
        for (const target of targets) {
            await requestDiscordTarget(db, target, null, { method: 'DELETE', messageId: String(post.discord_message_id) }).catch(() => null);
        }
    }

    return reply({
        ok: true,
        deleted_id: body.post_id
    });
}
 if(body.action==='marketplace_delete'){
   const table=body.table;
   if(!['marketplace','marketplace_ilegal'].includes(table))throw new Error('Tabel Marketplace invalid.');
   const globalMarketplace=table==='marketplace_ilegal';
   const itemQuery=db.from(table).select('id,organization_id,created_by_discord_id,discord_message_ids').eq('id',body.item_id);
   if(!globalMarketplace)itemQuery.eq('organization_id',organizationId);
   if(globalMarketplace)itemQuery.is('organization_id',null);
   const {data:item,error:itemError}=await itemQuery.maybeSingle();
   if(itemError)throw itemError;
   if(!item)throw new Error('Anunțul nu mai există sau nu este accesibil.');
   if(!isPlatformAdmin && !canDeleteMarketplaceByRole && String(item.created_by_discord_id||'')!==String(du.id))return reply({error:'Nu ai permisiunea de a șterge acest anunț.'},403);
   const deleteQuery=db.from(table).delete().eq('id',body.item_id);
   if(!globalMarketplace)deleteQuery.eq('organization_id',organizationId);
   if(globalMarketplace)deleteQuery.is('organization_id',null);
   const {data:deleted,error}=await deleteQuery.select('id');
   if(error)throw error;
   if(!deleted?.length)throw new Error('Anunțul nu a fost șters.');
   const { error: commentsCleanupError } = await db.from('marketplace_comments').delete().eq('marketplace_table', table).eq('marketplace_id', body.item_id);
   if (commentsCleanupError) console.warn('Comentariile anunțului nu au putut fi curățate:', commentsCleanupError.message);
   const messageRefs = Array.isArray(item.discord_message_ids) ? item.discord_message_ids : [];
   const referenceOrganizationIds = [...new Set(messageRefs.map((ref: any) => String(ref?.organization_id || organizationId)).filter(Boolean))];
   const { data: referenceSettings } = await db.from('organization_settings').select('organization_id,webhook_routes,discord_channel_routes').in('organization_id', referenceOrganizationIds);
   const settingsByOrganization = new Map((referenceSettings || []).map((settings: any) => [String(settings.organization_id), settings]));
   for (const ref of messageRefs) {
     if (ref?.channel_id && ref?.id) {
       const refSettings = settingsByOrganization.get(String(ref.organization_id || organizationId));
       const routeKey = globalMarketplace ? 'illegal_marketplace' : 'marketplace';
       const target = routeCandidates(refSettings, routeKey).flatMap((entry) => entry.candidates).find((candidate) => candidate.transport === 'bot' && String(candidate.channel_id) === String(ref.channel_id));
       if (target) await requestDiscordTarget(db, target, null, { method: 'DELETE', messageId: String(ref.id) }).catch(() => null);
     }
   }
   return reply({ok:true,deleted_id:body.item_id});
 }
 if(body.action==='marketplace_update'){if(body.table!=='marketplace_ilegal')throw new Error('Tabel Marketplace invalid.');const itemQuery=db.from('marketplace_ilegal').select('id,organization_id,created_by_discord_id').eq('id',body.item_id).is('organization_id',null);const {data:item,error:itemError}=await itemQuery.maybeSingle();if(itemError)throw itemError;if(!item)return reply({error:'Anunțul global nu există sau nu este accesibil.'},404);if(!isPlatformAdmin&&String(item.created_by_discord_id||'')!==String(du.id))return reply({error:'Poți edita numai anunțurile publicate de tine.'},403);const {data:updated,error:updateError}=await db.from('marketplace_ilegal').update({nume:normalizeBlackMarketName(body.nume),telefon:String(body.telefon||''),tip_actiune:body.tip_actiune||null,categorie:body.categorie||null,subcategorie:body.subcategorie||null,produse:String(body.produse||''),pret:body.pret||null,imagini_json:body.imagini_json||'[]',imagine_url:body.imagine_url||null,updated_at:new Date().toISOString()}).eq('id',body.item_id).is('organization_id',null).select('*').single();if(updateError)throw updateError;return reply({ok:true,item:updated})}
 if(body.action==='react'){const reaction=String(body.reaction||'');if(!allowedCommunityReactions.has(reaction))return reply({error:'Reacție invalidă.'},400);const key={organization_id:organizationId,post_id:body.post_id,user_discord_id:du.id,reaction};const {data}=await db.from('community_reactions').select('id').match(key).maybeSingle();const q=data?db.from('community_reactions').delete().eq('organization_id',organizationId).eq('id',data.id):db.from('community_reactions').insert(key);const {error}=await q;if(error)throw error;return reply({ok:true})}
 if(body.action==='vote'){const {data:option}=await db.from('community_poll_options').select('post_id').eq('organization_id',organizationId).eq('id',body.option_id).single();if(!option||option.post_id!==body.post_id)throw new Error('Opțiune invalidă.');const {error}=await db.from('community_poll_votes').upsert({organization_id:organizationId,post_id:body.post_id,option_id:body.option_id,user_discord_id:du.id},{onConflict:'post_id,user_discord_id'});if(error)throw error;await updateDiscordPoll(body.post_id);return reply({ok:true})}
 return reply({error:'Acțiune necunoscută.'},400);
const communityReactionChoices = ['✅', '❌', '👍', '❤️', '🤔'];
const communityPostComponents = (post:any, options:string[] = []) => {
    const audience = post.audience === 'departments' ? 'departments' : 'organization';
    const rows:any[] = [{ type: 1, components: communityReactionChoices.map((reaction:string, index:number) => ({ type: 2, style: 2, label: reaction, custom_id: `panel:announcements:${audience}:react:${post.id}:${index}` })) }];
    if (post.post_type === 'poll') {
        const pollOptions = options.slice(0, 10);
        for (let index = 0; index < pollOptions.length; index += 5) rows.push({ type: 1, components: pollOptions.slice(index, index + 5).map((option:string, optionIndex:number) => ({ type: 2, style: 1, label: option.slice(0, 80), custom_id: `panel:announcements:${audience}:vote:${post.id}:${index + optionIndex}` })) });
    }
    rows.push({ type: 1, components: [{ type: 2, style: 2, label: 'Editează', custom_id: `panel:announcements:${audience}:edit:${post.id}` }, { type: 2, style: 4, label: 'Șterge', custom_id: `panel:announcements:${audience}:delete:${post.id}` }] });
    return rows.slice(0, 5);
};
const notifyCommunityLog = async (post:any, action:string) => {
    const { data: settings } = await db.from('organization_settings').select('discord_channel_routes').eq('organization_id', organizationId).maybeSingle();
    const audience = post?.audience === 'departments' ? 'departments' : 'organization';
    const routeKey = audience === 'departments' ? 'log_announcements_departments' : 'log_announcements_organization';
    const audienceLabel = audience === 'departments' ? 'Angajați' : 'Organizație';
    try {
        await deliverDiscordRoute(db, settings, routeKey, JSON.stringify({ allowed_mentions: { parse: [] }, embeds: [{
            title: `📝 ${action} · ${audienceLabel}`,
            color: action.toLowerCase().includes('șters') ? 0xef4444 : 0x64748b,
            fields: [
                { name: '👤 Autor', value: String(post.author_name || post.author_discord_id || 'Utilizator').slice(0, 1024), inline: true },
                { name: '📌 Tip', value: post.post_type === 'poll' ? 'Sondaj' : post.post_type === 'question' ? 'Întrebare' : 'Anunț', inline: true },
                { name: '🧾 Titlu', value: String(post.title || 'Comunicare').slice(0, 1024), inline: false },
                { name: '💬 Conținut', value: String(post.content || '—').slice(0, 1024), inline: false },
            ],
            footer: { text: `Panel Pro · Log anunțuri · ${audienceLabel}` },
            timestamp: new Date().toISOString(),
        }] }));
    } catch (error) { console.error('Logul Anunțuri nu a putut fi trimis:', error); }
};

async function notifyDiscord(post:any, options:string[], audience:string){

    const {data:discordConfig}=await db
        .from('organization_settings')
        .select('*')
        .eq('organization_id',organizationId)
        .maybeSingle();


    const routeKey = audience === 'departments' ? 'departments' : 'organization';
    if (!routeCandidates(discordConfig, routeKey).some((item) => item.candidates.length)) return null;

    const site = (
        discordConfig?.panel_public_url ||
        'https://panel-pro.ro'
    ).replace(/\/$/,'');

    const postUrl = `${site}/anunturi.html?post=${post.id}`;



    const fields:Array<{name:string,value:string}> = [];


    if(post.post_type === 'poll' && options.length){

        fields.push({
            name:'Rezultate live',
            value: options
                .map((x:string)=>`▫️ ${x} — 0 voturi (0%)`)
                .join('\n')
        });

    }


    fields.push({
        name: post.post_type === 'poll'
            ? '🗳️ Votează în panel'
            : '💬 Răspunde în panel',

        value:`[Deschide postarea](${postUrl})`
    });


    const delivery = await deliverDiscordRoute(db, discordConfig, routeKey, JSON.stringify({
        embeds: [{
            title: post.title,
            description: post.content,
            color: audience === 'organization' ? 5865 : 3447003,
            fields,
            url: postUrl,
            footer: { text: `${post.post_type === 'poll' ? 'Sondaj' : post.post_type === 'question' ? 'Întrebare' : 'Anunț'} • ${post.author_name}` }
        }],
        components: communityPostComponents(post, options)
    }));
    if (!delivery.results.length) throw new Error(`Postarea a fost creată, dar Discord nu a acceptat mesajul. ${delivery.failures.join(' | ')}`);
    return delivery.results[0]?.id || null;
    }

    async function updateDiscordPoll(postId:string){

    const {data:discordConfig}=await db
        .from('organization_settings')
        .select('*')
        .eq('organization_id',organizationId)
        .maybeSingle();

    const {data:post}=await db
        .from('community_posts')
        .select('*')
        .eq('organization_id',organizationId)
        .eq('id',postId)
        .single();

    if(!post?.discord_message_id) return;


    const [{data:options},{data:votes}] = await Promise.all([

        db
            .from('community_poll_options')
            .select('*')
            .eq('organization_id',organizationId)
            .eq('post_id',postId)
            .order('position'),

        db
            .from('community_poll_votes')
            .select('*')
            .eq('organization_id',organizationId)
            .eq('post_id',postId)

    ]);


    const total = votes?.length || 0;


    const result = (options || [])
        .map((o:any)=>{

            const count = (votes || [])
                .filter((v:any)=>v.option_id === o.id)
                .length;

            const percent = total
                ? Math.round(count * 100 / total)
                : 0;

            return `▫️ ${o.option_text} — ${count} voturi (${percent}%)`;

        })
        .join('\n');



    const audience =
        post.audience === 'departments'
            ? 'departments'
            : 'organization';

    const routeKey = audience === 'departments' ? 'departments' : 'organization';
    if (!routeCandidates(discordConfig, routeKey).some((item) => item.candidates.length)) return;


    const site = (
            discordConfig?.panel_public_url ||
            'https://panel-pro.ro'
        ).replace(/\/$/,'');


    const postUrl = `${site}/anunturi.html?post=${post.id}`;


    await deliverDiscordRoute(db, discordConfig, routeKey, JSON.stringify({ embeds: [{
        title: post.title,
        description: post.content,
        color: audience === 'organization' ? 5865 : 3447003,
        url: postUrl,
        fields: [
            { name: `Rezultate live • ${total} voturi`, value: result || 'Încă nu există voturi.' },
            { name: '🗳️ Votează în panel', value: `[Deschide sondajul](${postUrl})` }
        ],
        footer: { text: `Sondaj • ${post.author_name}` }
    }], components: communityPostComponents(post, (options || []).map((item:any) => item.option_text)) }), { messageIds: { primary: String(post.discord_message_id) } });

}
 }catch(e){
   console.error(e);
   const error = e as any;
   return reply({
     error: error?.message || error?.error_description || error?.details || 'Eroare necunoscută.',
     code: error?.code || null,
     details: error?.details || null,
     hint: error?.hint || null,
     stage
   },400);
 }});
