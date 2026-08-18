import { createClient } from 'jsr:@supabase/supabase-js@2';
import { requirePanelSession } from '../_shared/panel-session.ts';
import { isPlatformAdminDiscordId, PLATFORM_ADMIN_DISCORD_IDS } from '../_shared/platform-admin.ts';
import { FULL_PACKAGE_FEATURES, PACKAGE_FEATURES, packageCatalogForClient, resolvePackageFeatures, STANDARD_PACKAGE_FEATURES } from '../_shared/package-features.ts';

const headers={'Access-Control-Allow-Origin':'https://lttlmario.github.io','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-panel-session','Access-Control-Allow-Methods':'POST,OPTIONS','Access-Control-Max-Age':'86400','Content-Type':'application/json'};
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers});
const audit=async(db:any,session:any,action:string,targetId:string,details:unknown={})=>{await db.from('admin_audit_log').insert({organization_id:targetId,actor_discord_id:session.discord_id,action,target_type:'organization',target_id:targetId,details});};
const slugify=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60);
const webhookChannels=new Set([
  'organization',
  'departments',
  'pontaj',
  'weekly_reports',
  'requests',
  'requests_organization',
  'requests_departments',
  'contracts',
  'marketplace',
  'illegal_marketplace',
  'fines_organization',
  'fines_departments',
  'warnings_organization',
  'warnings_departments',
  'sanctions_organization',
  'sanctions_departments',
  'status_live',
  'organization_expiration'
]);
const discordBotHeaders=(bot:string)=>({Authorization:`Bot ${bot}`,'User-Agent':'PanelManagement/1.0 (+https://panel-management.netlify.app)'});
const organizationIdPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const validOrganizationId=(value:unknown)=>organizationIdPattern.test(String(value||'').trim());
const nowIso=()=>new Date().toISOString();
const getClientIp=(request:Request)=>String(request.headers.get('cf-connecting-ip')||request.headers.get('x-forwarded-for')?.split(',')[0]||'unknown').trim().slice(0,120);
const webhookFeature=(channel:string)=>{
  if(channel==='organization')return 'announcements_organization';
  if(channel==='departments')return 'announcements_departments';
  if(channel==='requests_organization')return 'requests_organization';
  if(channel==='requests_departments')return 'requests_departments';
  if(['warnings_organization','sanctions_organization','fines_organization'].includes(channel))return 'discipline_organization';
  if(['warnings_departments','sanctions_departments','fines_departments'].includes(channel))return 'discipline_departments';
  if(channel==='illegal_marketplace')return 'illegal_marketplace';
  return null;
};
const filterWebhookRoutesForPackage=(routes:any,features:string[])=>Object.fromEntries(Object.entries(routes&&typeof routes==='object'?routes:{}).filter(([channel])=>{const feature=webhookFeature(channel);return !feature||features.includes(feature);}));
const summarizeWebhooks=(routes:any)=>{
  const source=routes&&typeof routes==='object'?routes:{};
  const channels=[...webhookChannels];
  let configured=0,missing=0,invalid=0;
  for(const channel of channels){
    const route=source[channel]&&typeof source[channel]==='object'?source[channel]:{};
    for(const target of ['primary','secondary']){
      const item=route[target]&&typeof route[target]==='object'?route[target]:null;
      if(!item?.enabled)continue;
      const value=String(item.url||'').trim();
      if(!value){missing++;continue;}
      try{const parsed=new URL(value);if(parsed.protocol!=='https:'||!['discord.com','discordapp.com'].includes(parsed.hostname)||!parsed.pathname.startsWith('/api/webhooks/'))invalid++;else configured++;}
      catch{invalid++;}
    }
  }
  return {configured,missing,invalid,total:channels.length*2};
};
const countRows=(db:any,table:string,organizationId:string,filters:((query:any)=>any)[]=[])=>(async()=>{
    let query=db.from(table).select('*',{count:'exact',head:true}).eq('organization_id',organizationId);for(const filter of filters)query=filter(query);const {count,error}=await query;if(error)throw error;return Number(count||0);
  })();

Deno.serve(async request=>{
  if(request.method==='OPTIONS')return new Response('ok',{headers});
  if(request.method!=='POST')return reply({error:'Metodă invalidă.'},405);
  let transientCreatedOrganizationId='',cleanupDb:any=null;
  try{
    const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')??'{}').default;
    if(!key)throw new Error('Cheia secretă Supabase lipsește.');
    const db=createClient(Deno.env.get('SUPABASE_URL')!,key);cleanupDb=db;
    const body=await request.json();
    const session=await requirePanelSession(db,request,0,true);
    if(!isPlatformAdminDiscordId(session.discord_id))return reply({error:'Doar administratorul platformei poate administra organizațiile.'},403);
    const {data:rateAllowed,error:rateError}=await db.rpc('consume_panel_rate_limit',{p_key:`platform-organizations:${session.discord_id}:${getClientIp(request)}`,p_limit:180,p_window_seconds:900});
    if(rateError)throw new Error(`Protecția anti-abuz nu este disponibilă: ${rateError.message}`);
    if(rateAllowed!==true)return reply({error:'Prea multe operațiuni administrative într-un timp scurt. Încearcă din nou peste câteva minute.'},429);

    if(body.action==='test_webhook'){
      const webhookUrl=String(body.url||'').trim();
      const organizationId=String(body.organization_id||'').trim();
      if(!organizationId)return reply({error:'Organizația selectată lipsește.'},400);
      let parsedWebhook:URL;
      try{parsedWebhook=new URL(webhookUrl);}catch{return reply({error:'Adresa webhookului este invalidă.'},400);}
      if(parsedWebhook.protocol!=='https:'||!['discord.com','discordapp.com'].includes(parsedWebhook.hostname)||!parsedWebhook.pathname.startsWith('/api/webhooks/'))return reply({error:'Adresa trebuie să fie un webhook Discord valid.'},400);
      const response=await fetch(webhookUrl,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({content:'✅ Test webhook Panel — conexiunea funcționează.',allowed_mentions:{parse:[]}})});
      if(!response.ok)return reply({error:`Discord a răspuns cu HTTP ${response.status}.`},400);
      return reply({ok:true,message:'Webhookul a răspuns cu succes.'});
    }

    if(body.action === 'list'){
      const { data, error } = await db
        .from('organizations')
        .select(`
          *,
          organization_guilds(*),
          organization_settings(*),
          organization_role_mappings(*)
        `)
        .order('name');

      if(error) throw error;

      const ids = (data || []).map((item:any) => item.id);

      const { data: settings, error: settingsError } = ids.length
        ? await db
            .from('app_settings')
            .select('organization_id,key,value')
            .in('organization_id', ids)
            .in('key', [
              'organization_access',
              'contract_template',
              'page_permissions',
              'action_permissions',
              'communication_permissions',
              'discipline_permissions'
            ])
        : {
            data: [],
            error: null
          };

      if(settingsError) throw settingsError;

      return reply({
        organizations: (data || []).map((item:any) => ({
          ...item,

          platform_settings: (settings || [])
            .filter(
              (setting:any) =>
                setting.organization_id === item.id
            )
            .reduce(
              (map:any, setting:any) => {
                map[setting.key] = setting.value;
                return map;
              },
              {}
            )
        }))
      });
    }
    if(body.action==='platform_overview'){
      const {data:organizations,error:organizationsError}=await db.from('organizations').select('id,name,slug,code,lifecycle_status,active,grace_until,created_at,updated_at').order('name');
      if(organizationsError)throw organizationsError;
      const ids=(organizations||[]).map((organization:any)=>organization.id);
      const [{data:guildRows,error:guildError},{data:roleRows,error:roleError},{data:settingsRows,error:settingsError},{data:appRows,error:appError}]=await Promise.all([
        ids.length?db.from('organization_guilds').select('organization_id,guild_id,guild_name,kind,enabled').in('organization_id',ids):Promise.resolve({data:[],error:null}),
        ids.length?db.from('organization_role_mappings').select('organization_id,guild_id,discord_role_id,discord_role_name,panel_role,enabled').in('organization_id',ids):Promise.resolve({data:[],error:null}),
        ids.length?db.from('organization_settings').select('organization_id,discord_client_id,panel_public_url,webhook_routes,updated_at').in('organization_id',ids):Promise.resolve({data:[],error:null}),
        ids.length?db.from('app_settings').select('organization_id,key,value,updated_at').in('organization_id',ids).in('key',['organization_access','organization_package','page_permissions','action_permissions','discipline_permissions']):Promise.resolve({data:[],error:null})
      ]);
      if(guildError||roleError||settingsError||appError)throw guildError||roleError||settingsError||appError;
      const now=Date.now();
      const organizationsWithDetails=[];
      for(const organization of organizations||[]){
        const organizationId=String(organization.id);
        const settings=(settingsRows||[]).find((item:any)=>item.organization_id===organizationId)||{};
        const app=(appRows||[]).filter((item:any)=>item.organization_id===organizationId).reduce((map:any,item:any)=>{map[item.key]=item.value;return map;},{});
        const guilds=(guildRows||[]).filter((item:any)=>item.organization_id===organizationId);
        const roles=(roleRows||[]).filter((item:any)=>item.organization_id===organizationId);
        const [members,activeSessions,activeShifts,activeAbsences,auditCount,lastAudit]=await Promise.all([
          countRows(db,'organization_members',organizationId,[query=>query.eq('active',true)]),
          countRows(db,'panel_sessions',organizationId,[query=>query.is('revoked_at',null).gt('expires_at',nowIso())]),
          countRows(db,'shifts',organizationId,[query=>query.in('status',['active','paused'])]),
          countRows(db,'absences',organizationId,[query=>query.gte('end_at',nowIso())]),
          countRows(db,'admin_audit_log',organizationId),
          db.from('admin_audit_log').select('action,created_at').eq('organization_id',organizationId).eq('target_type','organization').order('created_at',{ascending:false}).limit(1).maybeSingle()
        ]);
        if(lastAudit.error)throw lastAudit.error;
        const access=app.organization_access&&typeof app.organization_access==='object'?app.organization_access:{};
        const packageValue=app.organization_package&&typeof app.organization_package==='object'?app.organization_package:{};
        const expiresAt=String(access.expires_at||'').trim()||null;
        const isExpired=Boolean(expiresAt&&Date.parse(expiresAt)<=now);
        const isDraft=organization.lifecycle_status==='draft';
        const isActive=Boolean(organization.active&&!isExpired&&!isDraft);
        const webhookSummary=summarizeWebhooks(settings.webhook_routes);
        const health={
          guildsConfigured:guilds.filter((guild:any)=>guild.enabled!==false).length,
          rolesConfigured:roles.filter((role:any)=>role.enabled!==false).length,
          hasClientId:/^\d{15,22}$/.test(String(settings.discord_client_id||'')),
          hasPublicUrl:Boolean(settings.panel_public_url),
          pagePermissionCount:Object.values(app.page_permissions||{}).reduce((total:any,ids:any)=>total+(Array.isArray(ids)?ids.length:0),0),
          webhooks:webhookSummary
        };
        const issueCount=(health.guildsConfigured===0?1:0)+(health.rolesConfigured===0?1:0)+(health.hasClientId?0:1)+(health.hasPublicUrl?0:1)+webhookSummary.missing+webhookSummary.invalid;
        organizationsWithDetails.push({
          ...organization,
          access:{expires_at:expiresAt},
          package:{code:['standard','full'].includes(String(packageValue.code))?String(packageValue.code):'standard',unlimited:packageValue.unlimited===true,expires_at:packageValue.expires_at||null,features:resolvePackageFeatures(packageValue)},
          guilds:guilds.map((guild:any)=>({guild_id:guild.guild_id,guild_name:guild.guild_name,kind:guild.kind,enabled:guild.enabled!==false})),
          roles:roles.map((role:any)=>({guild_id:role.guild_id,discord_role_id:role.discord_role_id,discord_role_name:role.discord_role_name,panel_role:role.panel_role,enabled:role.enabled!==false})),
          metrics:{members,active_sessions:activeSessions,active_shifts:activeShifts,active_absences:activeAbsences,audit_events:auditCount,last_audit:lastAudit.data||null},
          health:{...health,issueCount,status:isActive?'active':isDraft?'draft':isExpired?'expired':'inactive'}
        });
      }
      return reply({ok:true,generated_at:nowIso(),feature_catalog:packageCatalogForClient(),organizations:organizationsWithDetails});
    }
    if(body.action==='health_check'){
      const organizationId=String(body.organization_id||'').trim();
      if(!validOrganizationId(organizationId))return reply({error:'ID-ul organizației este invalid.'},400);
      const [{data:organization,error:organizationError},{data:guilds,error:guildError},{data:roles,error:roleError},{data:settings,error:settingsError},{data:apps,error:appsError}]=await Promise.all([
        db.from('organizations').select('id,name,active,lifecycle_status,updated_at').eq('id',organizationId).maybeSingle(),
        db.from('organization_guilds').select('guild_id,guild_name,kind,enabled').eq('organization_id',organizationId),
        db.from('organization_role_mappings').select('guild_id,discord_role_id,discord_role_name,enabled').eq('organization_id',organizationId),
        db.from('organization_settings').select('discord_client_id,panel_public_url,webhook_routes,updated_at').eq('organization_id',organizationId).maybeSingle(),
        db.from('app_settings').select('key,value').eq('organization_id',organizationId).in('key',['organization_access','organization_package','page_permissions'])
      ]);
      if(organizationError||guildError||roleError||settingsError||appsError)throw organizationError||guildError||roleError||settingsError||appsError;
      if(!organization)return reply({error:'Organizația nu există.'},404);
      const bot=String(Deno.env.get('DISCORD_BOT_TOKEN')||'').trim();
      const discordGuilds=[];
      for(const guild of guilds||[]){
        if(guild.enabled===false){discordGuilds.push({guild_id:guild.guild_id,guild_name:guild.guild_name,kind:guild.kind,enabled:false,status:'disabled',role_count:0});continue;}
        if(!bot){discordGuilds.push({guild_id:guild.guild_id,guild_name:guild.guild_name,kind:guild.kind,enabled:true,status:'not_checked',role_count:0,error:'DISCORD_BOT_TOKEN lipsește.'});continue;}
        const response=await fetch(`https://discord.com/api/v10/guilds/${guild.guild_id}/roles`,{headers:discordBotHeaders(bot)});
        if(!response.ok){discordGuilds.push({guild_id:guild.guild_id,guild_name:guild.guild_name,kind:guild.kind,enabled:true,status:'error',role_count:0,error:`Discord HTTP ${response.status}`});continue;}
        const discordRoles=await response.json();
        discordGuilds.push({guild_id:guild.guild_id,guild_name:guild.guild_name,kind:guild.kind,enabled:true,status:'ok',role_count:Array.isArray(discordRoles)?discordRoles.filter((role:any)=>!role.managed&&String(role.id)!==String(guild.guild_id)).length:0});
      }
      const app=Object.fromEntries((apps||[]).map((item:any)=>[item.key,item.value]));
      const health={guilds:discordGuilds,roles_configured:(roles||[]).filter((role:any)=>role.enabled!==false).length,has_client_id:/^\d{15,22}$/.test(String(settings?.discord_client_id||'')),has_public_url:Boolean(settings?.panel_public_url),webhooks:summarizeWebhooks(settings?.webhook_routes),access:app.organization_access||null,package:app.organization_package||null,page_permission_count:Object.values(app.page_permissions||{}).reduce((total:any,ids:any)=>total+(Array.isArray(ids)?ids.length:0),0)};
      await audit(db,session,'organization_health_check',organizationId,{guilds:discordGuilds.map((guild:any)=>({guild_id:guild.guild_id,status:guild.status})),webhook_summary:health.webhooks});
      return reply({ok:true,organization:{id:organization.id,name:organization.name,active:organization.active,lifecycle_status:organization.lifecycle_status},health,checked_at:nowIso()});
    }
    if(body.action==='revoke_organization_sessions'){
      const organizationId=String(body.organization_id||'').trim();
      if(!validOrganizationId(organizationId))return reply({error:'ID-ul organizației este invalid.'},400);
      const {data:organization,error:organizationError}=await db.from('organizations').select('id,name').eq('id',organizationId).maybeSingle();
      if(organizationError)throw organizationError;if(!organization)return reply({error:'Organizația nu există.'},404);
      const {data,error}=await db.from('panel_sessions').update({revoked_at:nowIso()}).eq('organization_id',organizationId).is('revoked_at',null).select('token_hash');
      if(error)throw error;
      const revoked=Array.isArray(data)?data.length:0;
      await audit(db,session,'organization_sessions_revoked',organizationId,{revoked});
      return reply({ok:true,organization_id:organizationId,revoked_sessions:revoked});
    }
    if(body.action==='list_audit'){
      const organizationId=String(body.organization_id||'').trim();
      if(organizationId&&!validOrganizationId(organizationId))return reply({error:'ID-ul organizației este invalid.'},400);
      const query=db.from('admin_audit_log').select('id,organization_id,actor_discord_id,action,target_type,target_id,details,created_at').eq('target_type','organization').order('created_at',{ascending:false}).limit(200);
      const {data,error}=organizationId?await query.eq('organization_id',organizationId):await query;
      if(error)throw error;
      return reply({ok:true,events:data||[]});
    }
    if(body.action==='save_draft'){
      const draft=body.organization||{},name=String(draft.name||'').trim();
      if(name.length<2)return reply({error:'Introdu cel puțin numele organizației pentru draft.'},400);
      const draftId=String(draft.id||'').trim(),baseSlug=slugify(String(draft.slug||name));
      if(!baseSlug)return reply({error:'Numele organizației nu poate genera un slug valid.'},400);
      const draftRow={slug:baseSlug,name,code:String(draft.code||'').trim()||null,address:String(draft.address||'').trim()||null,logo_url:String(draft.logo_url||'').trim()||null,banner_url:String(draft.banner_url||'').trim()||null,lifecycle_status:'draft',active:false,updated_at:new Date().toISOString()};
      if(draftId){const {data,error}=await db.from('organizations').update(draftRow).eq('id',draftId).select('id').maybeSingle();if(error)throw error;if(!data)return reply({error:'Organizația nu mai există.'},404);return reply({ok:true,organization_id:draftId,lifecycle_status:'draft'});}
      const {data,error}=await db.from('organizations').insert(draftRow).select('id').single();if(error)throw error;
      await db.from('organization_lifecycle_events').insert({organization_id:data.id,event_type:'draft_created',actor_discord_id:session.discord_id,details:{name}});
      return reply({ok:true,organization_id:data.id,lifecycle_status:'draft'});
    }
    if(body.action==='publish'){
      const organizationId=String(body.organization_id||'').trim();if(!validOrganizationId(organizationId))return reply({error:'ID-ul organizației este invalid.'},400);
      const [{data:guilds},{data:settings},{data:roles}]=await Promise.all([db.from('organization_guilds').select('guild_id').eq('organization_id',organizationId),db.from('organization_settings').select('discord_client_id,panel_public_url').eq('organization_id',organizationId).maybeSingle(),db.from('organization_role_mappings').select('discord_role_id').eq('organization_id',organizationId)]);
      if(!guilds?.length)return reply({error:'Draftul nu are încă un server Discord configurat.'},400);
      if(!settings?.discord_client_id||!settings?.panel_public_url)return reply({error:'Draftul nu are configurarea Discord și URL-ul public completate.'},400);
      if(!roles?.length)return reply({error:'Draftul nu are încă roluri Discord configurate.'},400);
      const {data,error}=await db.from('organizations').update({active:true,lifecycle_status:'active',updated_at:new Date().toISOString()}).eq('id',organizationId).select('id').maybeSingle();if(error)throw error;if(!data)return reply({error:'Organizația nu există.'},404);
      await db.from('organization_lifecycle_events').insert({organization_id:organizationId,event_type:'published',actor_discord_id:session.discord_id,details:{}});
      await audit(db,session,'organization_published',organizationId,{});
      return reply({ok:true,organization_id:organizationId,lifecycle_status:'active'});
    }
    if(body.action==='discover'){
      const guildId=String(body.guild_id||'').trim();if(!/^\d{15,22}$/.test(guildId))return reply({error:'Guild ID invalid.'},400);
      const bot=String(Deno.env.get('DISCORD_BOT_TOKEN')||'').trim();if(!bot)throw new Error('DISCORD_BOT_TOKEN lipsește.');
      const [guildResponse,rolesResponse]=await Promise.all([
        fetch(`https://discord.com/api/v10/guilds/${guildId}`,{headers:discordBotHeaders(bot)}),
        fetch(`https://discord.com/api/v10/guilds/${guildId}/roles`,{headers:discordBotHeaders(bot)})
      ]);
      if(!guildResponse.ok||!rolesResponse.ok)return reply({error:`Botul nu poate accesa serverul (HTTP ${!guildResponse.ok?guildResponse.status:rolesResponse.status}). Invită botul pe server.`},400);
      const guild=await guildResponse.json(),roles=await rolesResponse.json();
      return reply({guild:{id:guild.id,name:guild.name,icon:guild.icon},roles:(roles||[]).filter((r:any)=>!r.managed&&String(r.id)!==guildId).map((r:any)=>({id:String(r.id),name:String(r.name),position:Number(r.position)})).sort((a:any,b:any)=>b.position-a.position)});
    }
    if(body.action==='save'){
      const org=body.organization||{},name=String(org.name||'').trim();if(name.length<2)throw new Error('Numele organizației este obligatoriu.');
      let slug=slugify(String(org.slug||name));if(!slug)throw new Error('Slug invalid.');
      const requestedOrganizationId=String(org.id||'').trim();
      if(requestedOrganizationId){const {data:existingOrganization,error:existingError}=await db.from('organizations').select('slug').eq('id',requestedOrganizationId).maybeSingle();if(existingError)throw existingError;if(existingOrganization?.slug)slug=String(existingOrganization.slug);}
      const row={slug,name,code:String(org.code||'').trim()||null,address:String(org.address||'').trim()||null,description:String(org.description||'').trim()||null,logo_url:String(org.logo_url||'').trim()||null,banner_url:String(org.banner_url||'').trim()||null,active:org.active!==false,updated_at:new Date().toISOString()};
      let organizationId=String(org.id||'').trim();
      if(organizationId){const {data,error}=await db.from('organizations').update(row).eq('id',organizationId).select('id').maybeSingle();if(error)throw error;if(!data)throw new Error('Organizația nu mai există. Reîncarcă lista.');}
      else{const {data,error}=await db.from('organizations').insert(row).select('id').single();if(error)throw error;organizationId=data.id;transientCreatedOrganizationId=organizationId;}
      const guilds=Array.isArray(body.guilds)?body.guilds:[];if(!guilds.length)throw new Error('Configurează cel puțin un server Discord.');
      if(organizationId){const {error}=await db.from('organization_guilds').delete().eq('organization_id',organizationId);if(error)throw error;}
      for(const guild of guilds){const guildId=String(guild.guild_id||'').trim();if(!/^\d{15,22}$/.test(guildId))throw new Error(`Guild ID invalid: ${guildId}`);const {error}=await db.from('organization_guilds').upsert({organization_id:organizationId,guild_id:guildId,guild_name:String(guild.guild_name||'').trim()||null,kind:guild.kind==='secondary'?'secondary':'primary',enabled:guild.enabled!==false},{onConflict:'guild_id'});if(error)throw error;}
      const settings=body.settings||{};let clientId=String(settings.discord_client_id||'').trim();let publicUrl=String(settings.panel_public_url||'').replace(/\/$/,'');
      if(!clientId||!publicUrl){const {data:ownerSession,error:ownerSessionError}=PLATFORM_ADMIN_DISCORD_IDS.length?await db.from('panel_sessions').select('organization_id').in('discord_id',PLATFORM_ADMIN_DISCORD_IDS).order('created_at',{ascending:false}).limit(1).maybeSingle():{data:null,error:null};if(ownerSessionError)throw ownerSessionError;const {data:platformSettings,error:platformSettingsError}=ownerSession?.organization_id?await db.from('organization_settings').select('discord_client_id,panel_public_url').eq('organization_id',ownerSession.organization_id).maybeSingle():{data:null,error:null};if(platformSettingsError)throw platformSettingsError;clientId=clientId||String(platformSettings?.discord_client_id||'').trim();publicUrl=publicUrl||String(platformSettings?.panel_public_url||'').replace(/\/$/,'');}
      if(!/^\d{15,22}$/.test(clientId))throw new Error('Configurarea platformei nu are un Discord Client ID valid.');try{new URL(publicUrl)}catch{throw new Error('Configurarea platformei nu are un URL public valid.');}
const rawRoutes =
  settings.webhook_routes &&
  typeof settings.webhook_routes === 'object'
    ? settings.webhook_routes
    : {};

const validWebhook = (value:any) => {
  try {
    const url = new URL(String(value || ''));

    return (
      url.protocol === 'https:' &&
      ['discord.com', 'discordapp.com'].includes(url.hostname) &&
      url.pathname.startsWith('/api/webhooks/')
    );
  } catch {
    return false;
  }
};

const { data: currentOrganizationSettings, error: currentOrganizationSettingsError } =
  await db
    .from('organization_settings')
    .select('webhook_routes')
    .eq('organization_id', organizationId)
    .maybeSingle();

if (currentOrganizationSettingsError) {
  throw currentOrganizationSettingsError;
}

const existingWebhookRoutes =
  currentOrganizationSettings?.webhook_routes &&
  typeof currentOrganizationSettings.webhook_routes === 'object'
    ? currentOrganizationSettings.webhook_routes
    : {};

const submittedWebhookRoutes = Object.fromEntries(
  Object.entries(rawRoutes)
    .filter(([channel, route]: any) => {
      if (!webhookChannels.has(channel)) return false;
      if (!route || typeof route !== 'object') return false;

      return true;
    })
    .map(([channel, route]: any) => {

      const existingRoute =
        existingWebhookRoutes[channel] &&
        typeof existingWebhookRoutes[channel] === 'object'
          ? existingWebhookRoutes[channel]
          : {};

      const buildTarget = (
        target: 'primary' | 'secondary'
      ) => {

        const submitted = route?.[target];
        const existing = existingRoute?.[target];

        /*
         * Dacă formularul trimite explicit acest target,
         * folosim valoarea nouă.
         */
        if (submitted && typeof submitted === 'object') {

          const enabled = submitted.enabled === true;
          const url = String(submitted.url || '').trim();

          /*
           * Debifat sau URL gol = ștergere explicită.
           */
          if (!enabled || !url) {
            return null;
          }

          if (!validWebhook(url)) {
            throw new Error(
              `Webhook Discord invalid pentru ${channel}/${target}.`
            );
          }

          return {
            enabled: true,
            url,
            ...(existing?.message_id ? { message_id: String(existing.message_id) } : {})
          };
        }

        /*
         * Dacă formularul NU a trimis targetul,
         * păstrăm configurația existentă.
         */
        if (
          existing &&
          typeof existing === 'object' &&
          existing.url
        ) {
          return existing;
        }

        return null;
      };

      return [
        channel,
        {
          primary: buildTarget('primary'),
          secondary: buildTarget('secondary')
        }
      ];
    })
);

/*
 * Păstrăm și eventualele rute existente care nu au fost
 * trimise deloc de formular.
 */
const webhook_routes = {
  ...existingWebhookRoutes,
  ...submittedWebhookRoutes
};
const { data: routePackageSetting, error: routePackageError } = await db
  .from('app_settings')
  .select('value')
  .eq('organization_id', organizationId)
  .eq('key', 'organization_package')
  .maybeSingle();
if (routePackageError) throw routePackageError;
const routePackageFeatures = resolvePackageFeatures(routePackageSetting?.value || {});
const filteredWebhookRoutes = filterWebhookRoutesForPackage(webhook_routes, routePackageFeatures);

const { error: settingsError } =
  await db
    .from('organization_settings')
    .upsert({
      organization_id: organizationId,
      discord_client_id: clientId,
      panel_public_url: publicUrl,
      webhook_routes: filteredWebhookRoutes,
      updated_by_discord_id: session.discord_id,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'organization_id'
    });

if (settingsError) {
  throw settingsError;
}
      await db.from('app_settings').upsert({organization_id:organizationId,key:'pontaj_config',value:{maxHours:12,dayEndTime:'19:59',nightEndTime:'23:00',excludeBreaks:false}},{onConflict:'organization_id,key'});
      if(body.access){const expiresAt=String(body.access.expires_at||'').trim();if(expiresAt&&Number.isNaN(Date.parse(expiresAt)))throw new Error('Data expirării este invalidă.');const {error}=await db.from('app_settings').upsert({organization_id:organizationId,key:'organization_access',value:{expires_at:expiresAt||null},updated_at:new Date().toISOString()},{onConflict:'organization_id,key'});if(error)throw error;if(!expiresAt||Date.parse(expiresAt)>Date.now())await db.from('organizations').update({active:true,updated_at:new Date().toISOString()}).eq('id',organizationId);}
      if(body.contract_template){const title=String(body.contract_template.title||'').trim(),template=String(body.contract_template.template||'').trim();if(title.length<2)throw new Error('Numele contractului este obligatoriu.');if(template.length<20)throw new Error('Textul contractului este prea scurt.');const allowed=['{{COMPANY}}','{{ADDRESS}}','{{MANAGER}}','{{EMPLOYEE_NAME}}','{{CNP}}','{{PHONE}}','{{POSITION}}','{{SALARY}}','{{PROGRAM}}','{{START_DATE}}','{{CONTRACT_NUMBER}}'];const unknown=[...template.matchAll(/{{[A-Z0-9_]+}}/g)].map(match=>match[0]).filter(value=>!allowed.includes(value));if(unknown.length)throw new Error(`C�mpuri necunoscute în contract: ${[...new Set(unknown)].join(', ')}`);const defaults=body.contract_template.defaults&&typeof body.contract_template.defaults==='object'?body.contract_template.defaults:{};const {error}=await db.from('app_settings').upsert({organization_id:organizationId,key:'contract_template',value:{title,template,defaults:{salary:String(defaults.salary||'').trim()||null}},updated_at:new Date().toISOString()},{onConflict:'organization_id,key'});if(error)throw error;}
      if(body.page_permissions && typeof body.page_permissions === 'object'){
  const allowedPages = new Set([
    'index.html',
    'anunturi.html',
    'pontaj.html',
    'cereri.html',
    'calculator.html',
    'bucatarie.html',
    'contracte.html',
    'calculatorilegal.html',
    'craftmecanics.html',
    'locatiiilegale.html',
    'marketplace.html',
    'marketplace-ilegal.html',
    'rapoarte.html',
    'status-live.html',
    'asistent.html'
  ]);



  const rules = Object.fromEntries(
    Object.entries(body.page_permissions)
      .filter(([page]) => allowedPages.has(page))
      .map(([page, ids]: any) => [
        page,
        [...new Set(
          (Array.isArray(ids) ? ids : [])
            .map(String)
            .filter(id => /^\d{15,22}$/.test(id))
        )]
      ])
  );

  const value = rules;

  const { error } = await db
    .from('app_settings')
    .upsert({
      organization_id: organizationId,
      key: 'page_permissions',
      value,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'organization_id,key'
    });

  if(error) throw error;
}
const { data: policyPackageSetting, error: policyPackageError } = await db
  .from('app_settings')
  .select('value')
  .eq('organization_id', organizationId)
  .eq('key', 'organization_package')
  .maybeSingle();
if (policyPackageError) throw policyPackageError;
const policyPackageFeatures = resolvePackageFeatures(policyPackageSetting?.value || {});

if(
  body.action_permissions &&
  typeof body.action_permissions === 'object'
){
  /*
   * Permisiuni pentru acțiuni din interiorul paginilor.
   *
   * Momentan permitem:
   * anunturi.publish = publicare / modificare / ștergere
   * anunțuri și sondaje.
   */
  const allowedActions = new Set([
    'anunturi.publish',
    'cereri.organization',
    'cereri.departments'
  ]);

  const actionRules = Object.fromEntries(
    Object.entries(body.action_permissions)
      .filter(([action]) => allowedActions.has(action))
      .map(([action, ids]: any) => [
        action,
        [
          ...new Set(
            (Array.isArray(ids) ? ids : [])
              .map(String)
              .filter(id => /^\d{15,22}$/.test(id))
          )
        ]
      ])
  );
  if (!policyPackageFeatures.includes('requests_organization')) actionRules['cereri.organization'] = [];

  // Un rol de cereri poate avea o singură destinație. Păstrăm aceeași
  // regulă și server-side, chiar dacă formularul din browser a fost ocolit.
  const organizationRequestRoles = new Set(
    actionRules['cereri.organization'] || []
  );
  if (Array.isArray(actionRules['cereri.departments'])) {
    actionRules['cereri.departments'] = actionRules['cereri.departments']
      .filter((id: string) => !organizationRequestRoles.has(id));
  }

  const { error } = await db
    .from('app_settings')
    .upsert({
      organization_id: organizationId,
      key: 'action_permissions',
      value: actionRules,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'organization_id,key'
    });

  if(error) throw error;
}
if(body.assistant_page_permissions && typeof body.assistant_page_permissions === 'object'){
  const allowedAssistantPages = new Set([
    'index.html','anunturi.html','pontaj.html','cereri.html','bucatarie.html',
    'contracte.html','calculatorilegal.html','craftmecanics.html',
    'locatiiilegale.html','marketplace.html','marketplace-ilegal.html',
    'rapoarte.html','status-live.html','asistent.html'
  ]);
  const assistantRules = Object.fromEntries(
    Object.entries(body.assistant_page_permissions)
      .filter(([page]) => allowedAssistantPages.has(page))
      .map(([page, ids]: any) => [
        page,
        [...new Set((Array.isArray(ids) ? ids : [])
          .map(String)
          .filter(id => /^\d{15,22}$/.test(id)))]
      ])
  );
  const { error } = await db.from('app_settings').upsert({
    organization_id: organizationId,
    key: 'assistant_page_permissions',
    value: assistantRules,
    updated_at: new Date().toISOString()
  }, { onConflict: 'organization_id,key' });
  if(error) throw error;
}
if(
  body.communication_permissions &&
  typeof body.communication_permissions === 'object'
){
  const clean = (audience:string, kind:string) => [
    ...new Set(
      (Array.isArray(body.communication_permissions[audience]?.[kind])
        ? body.communication_permissions[audience][kind]
        : [])
        .map(String)
        .filter(id => /^\d{15,22}$/.test(id))
    )
  ];
  const communicationPermissions = {
    organization: policyPackageFeatures.includes('announcements_organization') ? { read: clean('organization','read'), write: clean('organization','write') } : { read: [], write: [] },
    departments: { read: clean('departments','read'), write: clean('departments','write') }
  };
  const { error } = await db.from('app_settings').upsert({
    organization_id: organizationId,
    key: 'communication_permissions',
    value: communicationPermissions,
    updated_at: new Date().toISOString()
  }, { onConflict: 'organization_id,key' });
  if(error) throw error;
}
if (
  body.discipline_permissions &&
  typeof body.discipline_permissions === 'object'
) {
  const clean = (audience:string, kind:string) => [
    ...new Set(
      (Array.isArray(body.discipline_permissions[audience]?.[kind])
        ? body.discipline_permissions[audience][kind]
        : [])
        .map(String)
        .filter(id => /^\d{15,22}$/.test(id))
    )
  ];
  const disciplinePermissions = {
    organization: policyPackageFeatures.includes('discipline_organization') ? { read: clean('organization','read'), write: clean('organization','write'), sanction: clean('organization','sanction') } : { read: [], write: [], sanction: [] },
    departments: { read: clean('departments','read'), write: clean('departments','write'), sanction: clean('departments','sanction') }
  };
  const { error } = await db.from('app_settings').upsert({
    organization_id: organizationId,
    key: 'discipline_permissions',
    value: disciplinePermissions,
    updated_at: new Date().toISOString()
  }, { onConflict: 'organization_id,key' });
  if(error) throw error;
}
if (Array.isArray(body.roles)) {

  const { data: organizationPackage, error: packageError } = await db
    .from('app_settings')
    .select('value')
    .eq('organization_id', organizationId)
    .eq('key', 'organization_package')
    .maybeSingle();
  if (packageError) throw packageError;
  if (organizationPackage?.value?.code !== 'full' && body.roles.length > 10) {
    throw new Error('Pachetul Standard permite maximum 10 roluri.');
  }

  /*
   * Ștergem mapările vechi ale organizației.
   * Rolurile sunt reconstruite din configurația trimisă
   * de organizatii.html.
   */
  const { error: deleteRolesError } = await db
    .from('organization_role_mappings')
    .delete()
    .eq('organization_id', organizationId);

  if (deleteRolesError) {
    throw deleteRolesError;
  }

  /*
   * Validăm rolurile primite.
   */
  const cleanRoles = body.roles.map(
    (role: any, index: number) => {

      const guildId =
        String(role.guild_id || '').trim();

      const discordRoleId =
        String(role.discord_role_id || '').trim();

      const discordRoleName =
        String(role.discord_role_name || '').trim();

      const panelRole =
        String(
          role.panel_role ||
          role.discord_role_name ||
          `Rol ${index + 1}`
        ).trim();

      if (!/^\d{15,22}$/.test(guildId)) {
        throw new Error(
          `Guild ID invalid pentru rolul ${index + 1}.`
        );
      }

      if (!/^\d{15,22}$/.test(discordRoleId)) {
        throw new Error(
          `Discord Role ID invalid pentru rolul ${index + 1}.`
        );
      }

      if (!panelRole) {
        throw new Error(
          `Numele rolului ${index + 1} lipsește.`
        );
      }

      return {
        guild_id: guildId,
        discord_role_id: discordRoleId,
        discord_role_name:
          discordRoleName || panelRole,
        panel_role: panelRole
      };
    }
  );

  /*
   * Nu permitem același rol Discord de două ori
   * în aceeași organizație.
   */
  const uniqueRoleKeys = new Set(
    cleanRoles.map(
      (role: any) =>
        `${role.guild_id}:${role.discord_role_id}`
    )
  );

  if (uniqueRoleKeys.size !== cleanRoles.length) {
    throw new Error(
      'Același rol Discord nu poate fi configurat de două ori.'
    );
  }

  /*
   * IMPORTANT:
   *
   * permission_level rămâne doar pentru compatibilitate
   * cu structura existentă a bazei de date.
   *
   * Accesul real la pagini este stabilit prin
   * page_permissions.
   *
   * Ordinea rolurilor Discord nu mai stabilește accesul.
   */
  const rows = cleanRoles.map(
    (role: any, index: number) => ({
      organization_id: organizationId,

      guild_id:
        role.guild_id,

      discord_role_id:
        role.discord_role_id,

      discord_role_name:
        role.discord_role_name,

      panel_role:
        role.panel_role,

      permission_level: 1,

      priority:
        cleanRoles.length - index,

      enabled: true
    })
  );

  /*
   * Salvăm noile mapări.
   */
  if (rows.length) {

    const { error: insertRolesError } = await db
      .from('organization_role_mappings')
      .insert(rows);

    if (insertRolesError) {
      throw insertRolesError;
    }
  }
}
      await audit(db,session,'organization_saved',organizationId,{name,roles:Array.isArray(body.roles)?body.roles.length:0});
      return reply({ok:true,organization_id:organizationId});
    }
    if (body.action === 'reactivate_with_voucher') {
      const organizationId = String(body.organization_id || '').trim();
      const code = String(body.voucher_code || '').trim().toUpperCase();
      if (!organizationId || !code) return reply({ error: 'Organizatia si voucherul sunt obligatorii.' }, 400);
      if (organizationId !== String(session.organization_id)) return reply({ error: 'Voucherul poate fi folosit doar pentru organizatia activa.' }, 403);
      if (!validOrganizationId(organizationId)) return reply({ error: 'ID-ul organizației este invalid.' }, 400);

      const { data: redeemedRows, error: redeemError } = await db.rpc('redeem_voucher_reactivate_organization', {
        p_code: code,
        p_discord_id: session.discord_id,
        p_organization_id: organizationId
      });
      if (redeemError) {
        const message = String(redeemError.message || 'Eroare la reactivarea organizației.');
        return reply({ error: message }, redeemError.code === 'P0001' ? 409 : 500);
      }
      const redeemed = Array.isArray(redeemedRows) ? redeemedRows[0] : redeemedRows;
      if (!redeemed?.access_expires_at) return reply({ error: 'Voucherul nu a putut fi aplicat.' }, 500);
      await audit(db, session, 'organization_voucher_redeemed', organizationId, {
        duration_days: redeemed.added_days,
        expires_at: redeemed.access_expires_at,
        package_code: redeemed.package_code,
        package_features: redeemed.package_features || []
      });
      return reply({ ok: true, expires_at: redeemed.access_expires_at, added_days: redeemed.added_days, package_code: redeemed.package_code, package_features: redeemed.package_features || [] });
    }
    if(body.action==='set_package'){
      const organizationId=String(body.organization_id||'').trim();
      const code=String(body.package_code||'standard');
      if(!validOrganizationId(organizationId)||!['standard','full'].includes(code))return reply({error:'Organizația sau pachetul este invalidă.'},400);
      const unlimited=body.unlimited===true;
      const expiresAt=unlimited?null:String(body.expires_at||'').trim()||null;
      if(expiresAt&&Number.isNaN(Date.parse(expiresAt)))return reply({error:'Data expirării pachetului este invalidă.'},400);
      const features=code==='full'?[...FULL_PACKAGE_FEATURES]:[...STANDARD_PACKAGE_FEATURES];
      const {error}=await db.from('app_settings').upsert({organization_id:organizationId,key:'organization_package',value:{code,unlimited,expires_at:expiresAt,features},updated_at:nowIso()},{onConflict:'organization_id,key'});
      if(error)throw error;
      const {data:organizationSettings}=await db.from('organization_settings').select('webhook_routes').eq('organization_id',organizationId).maybeSingle();
      if(organizationSettings?.webhook_routes){
        const {error:routeError}=await db.from('organization_settings').update({webhook_routes:filterWebhookRoutesForPackage(organizationSettings.webhook_routes,features),updated_at:nowIso()}).eq('organization_id',organizationId);
        if(routeError)throw routeError;
      }
      if(code!=='full'){
        const restricted=[['action_permissions',{...(body.action_permissions||{}),'cereri.organization':[]}],['communication_permissions',{organization:{read:[],write:[]}}],['discipline_permissions',{organization:{read:[],write:[],sanction:[]}}]] as any[];
        for(const [key,value] of restricted){
          const {data:existing}=await db.from('app_settings').select('value').eq('organization_id',organizationId).eq('key',key).maybeSingle();
          if(!existing)continue;
          const next=key==='action_permissions'?{...(existing.value||{}),'cereri.organization':[]}:{...(existing.value||{}),organization:value.organization};
          const {error:permissionError}=await db.from('app_settings').update({value:next,updated_at:nowIso()}).eq('organization_id',organizationId).eq('key',key);
          if(permissionError)throw permissionError;
        }
      }
      if(code!=='full'){
        const fullOnlyPages=new Set(['calculatorilegal.html','locatiiilegale.html','marketplace-ilegal.html']);
        for(const key of ['page_permissions','assistant_page_permissions']){
          const {data:existing}=await db.from('app_settings').select('value').eq('organization_id',organizationId).eq('key',key).maybeSingle();
          if(!existing||!existing.value||typeof existing.value!=='object')continue;
          const value=Object.fromEntries(Object.entries(existing.value).filter(([page])=>!fullOnlyPages.has(page)));
          const {error:permissionError}=await db.from('app_settings').update({value,updated_at:nowIso()}).eq('organization_id',organizationId).eq('key',key);
          if(permissionError)throw permissionError;
        }
      }
      await audit(db,session,'organization_package_changed',organizationId,{code,unlimited,expires_at:expiresAt,features});
      return reply({ok:true,package:{code,unlimited,expires_at:expiresAt,features}});
    }
    if(false && body.action==='set_package'){
      const organizationId=String(body.organization_id||'').trim(),code=String(body.package_code||'standard');if(!validOrganizationId(organizationId)||!['standard','full'].includes(code))return reply({error:'Organizația sau pachetul este invalid.'},400);const unlimited=body.unlimited===true;const expiresAt=unlimited?null:String(body.expires_at||'').trim()||null;if(expiresAt&&Number.isNaN(Date.parse(expiresAt)))return reply({error:'Data expirării pachetului este invalidă.'},400);const requestedFeatures=Array.isArray(body.features)?[...new Set(body.features.map(String).filter((feature:string)=>Object.prototype.hasOwnProperty.call(PACKAGE_FEATURES,feature)))]:null;const features=code==='full'?[...FULL_PACKAGE_FEATURES]:[...new Set([...STANDARD_PACKAGE_FEATURES,...(requestedFeatures||[])])];const {error}=await db.from('app_settings').upsert({organization_id:organizationId,key:'organization_package',value:{code,unlimited,expires_at:expiresAt,features},updated_at:nowIso()},{onConflict:'organization_id,key'});if(error)throw error;await audit(db,session,'organization_package_changed',organizationId,{code,unlimited,expires_at:expiresAt,features});return reply({ok:true,package:{code,unlimited,expires_at:expiresAt,features}});
    }
    if(body.action==='list_vouchers'){
      const {data,error}=await db.from('organization_vouchers').select('id,code,package_code,features,duration_days,guild_id,organization_id,redeemed_organization_id,redeemed_by_discord_id,redeemed_at,expires_at,revoked_at,revoked_by_discord_id,revoked_reason,created_at').order('created_at',{ascending:false}).limit(500);if(error)throw error;return reply({ok:true,vouchers:data||[]});
    }
    if(body.action==='delete_voucher'){
      const id=String(body.voucher_id||'').trim();const reason=String(body.reason||'Șters de administrator').trim().slice(0,200);if(!id)return reply({error:'Voucherul lipsește.'},400);const {data,error}=await db.from('organization_vouchers').update({revoked_at:nowIso(),revoked_by_discord_id:session.discord_id,revoked_reason:reason||'Șters de administrator'}).eq('id',id).is('redeemed_at',null).is('revoked_at',null).select('id,code,revoked_at').maybeSingle();if(error)throw error;if(!data)return reply({error:'Voucherul nu există, a fost folosit sau a fost deja revocat.'},404);if(validOrganizationId(String(session.organization_id||'')))await db.from('admin_audit_log').insert({organization_id:session.organization_id,actor_discord_id:session.discord_id,action:'organization_voucher_revoked',target_type:'voucher',target_id:String(data.id),details:{code:data.code,reason,operation:'delete_voucher'}});return reply({ok:true,revoked:data});
    }
    if(body.action==='revoke_voucher'){
      const id=String(body.voucher_id||'').trim();const reason=String(body.reason||'Revocat de administrator').trim().slice(0,200);if(!id)return reply({error:'Voucherul lipsește.'},400);const {data,error}=await db.from('organization_vouchers').update({revoked_at:nowIso(),revoked_by_discord_id:session.discord_id,revoked_reason:reason||'Revocat de administrator'}).eq('id',id).is('redeemed_at',null).is('revoked_at',null).select('id,code,revoked_at').maybeSingle();if(error)throw error;if(!data)return reply({error:'Voucherul nu există, a fost folosit sau a fost deja revocat.'},404);if(validOrganizationId(String(session.organization_id||'')))await db.from('admin_audit_log').insert({organization_id:session.organization_id,actor_discord_id:session.discord_id,action:'organization_voucher_revoked',target_type:'voucher',target_id:String(data.id),details:{code:data.code,reason,operation:'revoke_voucher'}});return reply({ok:true,revoked:data});
    }
    if(body.action==='generate_vouchers'){
      const packageCode=String(body.package_code||'standard');const count=Math.max(1,Math.min(100,Number(body.count)||1));const duration=Math.max(1,Math.min(3650,Number(body.duration_days)||30));const guildId=String(body.guild_id||'').trim();if(!['standard','full'].includes(packageCode))return reply({error:'Pachet invalid.'},400);if(guildId&&!/^\d{15,22}$/.test(guildId))return reply({error:'Guild ID invalid.'},400);const features=packageCode==='full'?[...FULL_PACKAGE_FEATURES]:[...STANDARD_PACKAGE_FEATURES];const redemptionDeadline=new Date(Date.now()+365*86400000).toISOString();const rows:any[]=[];for(let i=0;i<count;i++){const bytes=crypto.getRandomValues(new Uint8Array(9));const code=`${packageCode.toUpperCase()}-${Array.from(bytes).map(value=>value.toString(36).padStart(2,'0')).join('').slice(0,12).toUpperCase()}`;rows.push({code,package_code:packageCode,features,duration_days:duration,expires_at:redemptionDeadline,guild_id:guildId||null,created_by_discord_id:session.discord_id});}const {data,error}=await db.from('organization_vouchers').insert(rows).select('code,package_code,features,duration_days,guild_id,expires_at,created_at');if(error)throw error;if(validOrganizationId(String(session.organization_id||''))){await db.from('admin_audit_log').insert({organization_id:session.organization_id,actor_discord_id:session.discord_id,action:'organization_vouchers_generated',target_type:'voucher_batch',target_id:null,details:{package_code:packageCode,count:rows.length,duration_days:duration,guild_id:guildId||null,redemption_deadline:redemptionDeadline}});}return reply({ok:true,vouchers:data||[]});
    }
    if(body.action==='extend'){
      const organizationId=String(body.organization_id||'').trim(),expiresAt=String(body.expires_at||'').trim();if(!validOrganizationId(organizationId)||Number.isNaN(Date.parse(expiresAt))||Date.parse(expiresAt)<=Date.now())return reply({error:'Alege o dată viitoare pentru prelungire.'},400);
      const {data,error}=await db.from('organizations').update({active:true,updated_at:new Date().toISOString()}).eq('id',organizationId).select('id').maybeSingle();if(error)throw error;if(!data)return reply({error:'Organizația nu există.'},404);
      const {error:settingError}=await db.from('app_settings').upsert({organization_id:organizationId,key:'organization_access',value:{expires_at:expiresAt},updated_at:nowIso()},{onConflict:'organization_id,key'});if(settingError)throw settingError;await audit(db,session,'organization_access_extended',organizationId,{expires_at:expiresAt});return reply({ok:true,expires_at:expiresAt});
    }
    if(body.action==='set_access'){
      const organizationId=String(body.organization_id||'').trim(),expiresAt=String(body.expires_at||'').trim(),active=body.active!==false;
      if(!validOrganizationId(organizationId))return reply({error:'ID-ul organizației este invalid.'},400);if(expiresAt&&Number.isNaN(Date.parse(expiresAt)))return reply({error:'Data expirării este invalidă.'},400);
      const effectiveActive=active&&(!expiresAt||Date.parse(expiresAt)>Date.now());const {data,error}=await db.from('organizations').update({active:effectiveActive,updated_at:new Date().toISOString()}).eq('id',organizationId).select('id').maybeSingle();if(error)throw error;if(!data)return reply({error:'Organizația nu există.'},404);
      const {error:settingError}=await db.from('app_settings').upsert({organization_id:organizationId,key:'organization_access',value:{expires_at:expiresAt||null},updated_at:nowIso()},{onConflict:'organization_id,key'});if(settingError)throw settingError;await audit(db,session,'organization_access_changed',organizationId,{active:effectiveActive,expires_at:expiresAt||null});return reply({ok:true,active:effectiveActive,expires_at:expiresAt||null});
    }
    if(body.action==='delete'){
      const organizationId=String(body.organization_id||'').trim();
      if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(organizationId))return reply({error:'ID-ul organizației este invalid.'},400);
      const {data:organization,error:findError}=await db.from('organizations').select('id,name').eq('id',organizationId).maybeSingle();
      if(findError)throw findError;if(!organization)return reply({error:'Organizația nu mai există.'},404);
      if(String(body.confirm_name||'').trim()!==organization.name)return reply({error:'Confirmarea nu corespunde numelui organizației.'},400);
      const {count,error:countError}=await db.from('organizations').select('id',{count:'exact',head:true});if(countError)throw countError;
      if((count||0)<=1)return reply({error:'Ultima organizație nu poate fi ștearsă. Creează întâi alta.'},409);
      await audit(db,session,'organization_deleted',organizationId,{name:organization.name});
      const tenantTables=['panel_notification_reads','community_poll_votes','community_reactions','community_poll_options','community_posts','disciplinary_warnings','disciplinary_sanctions','panel_notifications','profiles','marketplace_ilegal','marketplace','app_settings','absences','shifts','panel_sessions','organization_members','organization_role_mappings','organization_guilds','organization_settings','admin_audit_log'];
      for(const table of tenantTables){const {error}=await db.from(table).delete().eq('organization_id',organizationId);if(error)throw new Error(`Ștergerea datelor din ${table} a eșuat: ${error.message}`);}
      const {error:deleteError}=await db.from('organizations').delete().eq('id',organizationId);if(deleteError)throw deleteError;
      return reply({ok:true,deleted_organization_id:organizationId});
    }
    return reply({error:'Acțiune necunoscută.'},400);
  }catch(error){
    console.error(error);
    if(transientCreatedOrganizationId&&cleanupDb)await cleanupDb.from('organizations').delete().eq('id',transientCreatedOrganizationId);
    const databaseError=error as {message?:unknown;details?:unknown;hint?:unknown;code?:unknown};
    const message=error instanceof Error?error.message:String(databaseError?.message||'Eroare internă.');
    const details=[databaseError?.details,databaseError?.hint,databaseError?.code].filter(Boolean).map(String).join(' · ');
    return reply({error:details?`${message} (${details})`:message},400);
  }
});
