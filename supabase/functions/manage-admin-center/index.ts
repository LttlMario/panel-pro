import { createClient } from 'jsr:@supabase/supabase-js@2.112.3';
import { requirePanelSession } from '../_shared/panel-session.ts';
import { isPlatformAdminAccount, PLATFORM_ADMIN_DISCORD_IDS } from '../_shared/platform-admin.ts';
const cors={'Access-Control-Allow-Origin':'https://lttlmario.github.io','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-panel-session','Access-Control-Allow-Methods':'POST,OPTIONS','Content-Type':'application/json'};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:cors});
Deno.serve(async request=>{
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  try{
    const body=await request.json();
    const keys=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')??'{}');
    const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||keys.default;
    if(!serviceKey)return reply({error:'Cheia de server lipsește.'},500);
    const db=createClient(Deno.env.get('SUPABASE_URL')!,serviceKey);
    const session=await requirePanelSession(db,request),discordUser={id:session.discord_id};
    const {data:user}=await db.from('users').select('display_name,username').eq('discord_id',discordUser.id).maybeSingle();
    if(!user)return reply({error:'Utilizatorul nu este înregistrat în panel.'},403);
    const organizationId=session.organization_id,actorName=user.display_name||user.username||discordUser.id;
    const isPlatformAdmin=await isPlatformAdminAccount(db,discordUser.id);

    if(['notifications','mark_read'].includes(String(body.action||''))){
      const {data:permissionRows,error:permissionError}=await db.from('app_settings').select('key,value').eq('organization_id',organizationId).in('key',['page_permissions','communication_permissions','discipline_permissions']);
      if(permissionError)throw permissionError;
      const settings=new Map((permissionRows||[]).map((item:any)=>[item.key,item.value&&typeof item.value==='object'?item.value:{}]));
      const pagePermissions:any=settings.get('page_permissions')||{};
      const roleIds=(session.discord_role_ids||[]).map(String);
      const hasRole=(value:unknown)=>Array.isArray(value)&&value.map(String).some((roleId:string)=>roleIds.includes(roleId));
      const hasPageAccess=(page:string)=>isPlatformAdmin||(Array.isArray(pagePermissions[page])&&hasRole(pagePermissions[page]));
      const hasScopedAccess=(key:string,page:string)=>{
        if(isPlatformAdmin)return true;
        if(key.startsWith('page:'))return hasPageAccess(page);
        const [group,scope]=key.split(':');
        const settingKey=group==='communication'?'communication_permissions':group==='discipline'?'discipline_permissions':group;
        const setting=settings.get(settingKey);
        if(!setting)return hasPageAccess(page);
        const permissions=setting?.[scope];
        return hasRole(permissions?.read)||hasRole(permissions?.write)||hasRole(permissions?.sanction);
      };
      const visible=(note:any)=>{
        const recipient=String(note.recipient_discord_id||'');
        if(recipient===String(discordUser.id))return true;
        const page=String(note.required_page||'');
        if(page&&!hasPageAccess(page))return false;
        const accessKey=String(note.access_key||'');
        if(accessKey&&!hasScopedAccess(accessKey,page))return false;
        return true;
      };
      if(body.action==='notifications'){
        const {data:notes,error}=await db.from('panel_notifications').select('*').eq('organization_id',organizationId).order('created_at',{ascending:false}).limit(100);if(error)throw error;
        const active=(notes||[]).filter((note:any)=>!note.expires_at||new Date(note.expires_at).getTime()>Date.now()).filter(visible);
        const {data:reads}=await db.from('panel_notification_reads').select('notification_id').eq('organization_id',organizationId).eq('discord_id',discordUser.id);
        return reply({notifications:active,read_ids:(reads||[]).map((item:any)=>item.notification_id)});
      }
      const ids=(Array.isArray(body.ids)?body.ids:[]).map(String).slice(0,100);
      if(ids.length){
        const {data:owned,error:ownedError}=await db.from('panel_notifications').select('id').eq('organization_id',organizationId).in('id',ids);if(ownedError)throw ownedError;
        await db.from('panel_notification_reads').upsert((owned||[]).map((item:any)=>({organization_id:organizationId,notification_id:item.id,discord_id:discordUser.id})),{onConflict:'notification_id,discord_id'});
      }
      return reply({ok:true});
    }

    if(!isPlatformAdmin)return reply({error:'Această funcție este rezervată administratorului platformei.'},403);
    const snowflake=(value:unknown)=>/^\d{15,22}$/.test(String(value||'').trim());
    const now=()=>new Date().toISOString();
    const audit=async(action:string,target:string|null,details:Record<string,unknown>={})=>{
      const {error}=await db.from('admin_audit_log').insert({organization_id:organizationId,actor_discord_id:discordUser.id,actor_name:actorName,action,target_type:'platform',target_id:target,details});
      if(error)throw error;
    };
    if(body.action==='platform_admins'){
      const {data,error}=await db.from('platform_administrators').select('discord_id,display_name,active,created_at,updated_at').order('created_at',{ascending:true});
      if(error)throw error;
      const roots=PLATFORM_ADMIN_DISCORD_IDS.map(discord_id=>({discord_id,display_name:'Administrator principal',active:true,root:true}));
      const configured=(data||[]).map((item:any)=>({...item,root:false}));
      return reply({administrators:[...roots,...configured.filter((item:any)=>!PLATFORM_ADMIN_DISCORD_IDS.includes(String(item.discord_id)))]});
    }
    if(body.action==='platform_admin_add'){
      const target=String(body.discord_id||'').trim(),displayName=String(body.display_name||'').trim().slice(0,120)||null;
      if(!snowflake(target))return reply({error:'Discord ID invalid. Introdu un ID numeric valid.'},400);
      if(PLATFORM_ADMIN_DISCORD_IDS.includes(target))return reply({error:'Acest ID este deja administrator principal.'},409);
      const {error}=await db.from('platform_administrators').upsert({discord_id:target,display_name:displayName,active:true,updated_at:now()},{onConflict:'discord_id'});
      if(error)throw error;
      await audit('platform_admin_added',target,{display_name:displayName});
      return reply({ok:true});
    }
    if(body.action==='platform_admin_remove'){
      const target=String(body.discord_id||'').trim();
      if(!snowflake(target))return reply({error:'Discord ID invalid.'},400);
      if(PLATFORM_ADMIN_DISCORD_IDS.includes(target))return reply({error:'Administratorul principal nu poate fi eliminat.'},400);
      if(target===String(discordUser.id))return reply({error:'Nu îți poți elimina propriul acces.'},400);
      const {error}=await db.from('platform_administrators').update({active:false,updated_at:now()}).eq('discord_id',target);
      if(error)throw error;
      await db.from('panel_sessions').update({revoked_at:now()}).eq('discord_id',target).is('revoked_at',null);
      await audit('platform_admin_removed',target);
      return reply({ok:true});
    }
    if(body.action==='platform_bans'){
      const {data,error}=await db.from('platform_user_bans').select('discord_id,reason,active,banned_by_discord_id,created_at,updated_at').order('created_at',{ascending:false});
      if(error)throw error;
      return reply({bans:data||[]});
    }
    if(body.action==='platform_ban'){
      const target=String(body.discord_id||'').trim(),reason=String(body.reason||'Blocat de administrator').trim().slice(0,500)||'Blocat de administrator';
      if(!snowflake(target))return reply({error:'Discord ID invalid.'},400);
      if(PLATFORM_ADMIN_DISCORD_IDS.includes(target)||await isPlatformAdminAccount(db,target))return reply({error:'Un administrator al platformei nu poate fi blocat.'},400);
      const {error}=await db.from('platform_user_bans').upsert({discord_id:target,reason,active:true,banned_by_discord_id:discordUser.id,updated_at:now()},{onConflict:'discord_id'});
      if(error)throw error;
      await db.from('panel_sessions').update({revoked_at:now()}).eq('discord_id',target).is('revoked_at',null);
      await audit('platform_user_banned',target,{reason});
      return reply({ok:true});
    }
    if(body.action==='platform_unban'){
      const target=String(body.discord_id||'').trim();
      if(!snowflake(target))return reply({error:'Discord ID invalid.'},400);
      const {error}=await db.from('platform_user_bans').update({active:false,updated_at:now()}).eq('discord_id',target);
      if(error)throw error;
      await audit('platform_user_unbanned',target);
      return reply({ok:true});
    }
    if(body.action==='members'){
      const {data:members,error}=await db.from('organization_members').select('organization_id,discord_id,panel_role,active,last_verified_at,created_at').eq('organization_id',organizationId).eq('active',true).order('created_at',{ascending:true});if(error)throw error;
      const ids=(members||[]).map((m:any)=>m.discord_id),{data:users}=ids.length?await db.from('users').select('discord_id,username,display_name,avatar,avatar_url').in('discord_id',ids):{data:[]};
      const profiles=new Map((users||[]).map((u:any)=>[String(u.discord_id),u]));return reply({members:(members||[]).map((m:any)=>({...profiles.get(String(m.discord_id)),...m,role:m.panel_role}))});
    }
    if(body.action==='online_members'){
      const onlineSince=new Date(Date.now()-90*1000).toISOString();
      const {data:sessions,error:sessionError}=await db.from('panel_sessions').select('discord_id,last_seen_at,expires_at').eq('organization_id',organizationId).is('revoked_at',null).gt('expires_at',new Date().toISOString()).gt('last_seen_at',onlineSince).order('last_seen_at',{ascending:false});
      if(sessionError)throw sessionError;
      const uniqueIds=[...new Set((sessions||[]).map((session:any)=>String(session.discord_id)))];
      const {data:users,error:userError}=uniqueIds.length?await db.from('users').select('discord_id,username,display_name,role,default_role').in('discord_id',uniqueIds):{data:[],error:null};
      if(userError)throw userError;
      const profiles=new Map((users||[]).map((user:any)=>[String(user.discord_id),user]));
      const {data:members,error:memberError}=uniqueIds.length?await db.from('organization_members').select('discord_id,panel_role').eq('organization_id',organizationId).in('discord_id',uniqueIds):{data:[],error:null};
      if(memberError)throw memberError;
      const roles=new Map((members||[]).map((member:any)=>[String(member.discord_id),member.panel_role]));
      return reply({online_members:(sessions||[]).filter((session:any,index:number,array:any[])=>index===array.findIndex((item:any)=>String(item.discord_id)===String(session.discord_id))).map((session:any)=>({...profiles.get(String(session.discord_id)),discord_id:String(session.discord_id),panel_role:roles.get(String(session.discord_id))||profiles.get(String(session.discord_id))?.role||profiles.get(String(session.discord_id))?.default_role||'Rol neconfigurat'}))});
    }
    if(body.action==='member_kick'){
      const target=String(body.discord_id||'');if(!target)return reply({error:'Discord ID lipsește.'},400);
      await db.from('organization_members').update({active:false}).eq('organization_id',organizationId).eq('discord_id',target);
      await db.from('panel_sessions').update({revoked_at:new Date().toISOString()}).eq('organization_id',organizationId).eq('discord_id',target).is('revoked_at',null);return reply({ok:true});
    }
    if(body.action==='member_ban'){
      const target=String(body.discord_id||'').trim(),reason=String(body.reason||'Blocat de administrator').trim().slice(0,500)||'Blocat de administrator';
      if(!snowflake(target))return reply({error:'Discord ID invalid.'},400);
      if(PLATFORM_ADMIN_DISCORD_IDS.includes(target)||await isPlatformAdminAccount(db,target))return reply({error:'Un administrator al platformei nu poate fi blocat.'},400);
      const {error}=await db.from('platform_user_bans').upsert({discord_id:target,reason,active:true,banned_by_discord_id:discordUser.id,updated_at:now()},{onConflict:'discord_id'});
      if(error)throw error;
      await db.from('panel_sessions').update({revoked_at:now()}).eq('discord_id',target).is('revoked_at',null);
      await audit('member_banned',target,{reason,organization_id:organizationId});
      return reply({ok:true});
    }
    if(body.action==='member_delete'){
      const target=String(body.discord_id||'');if(!target)return reply({error:'Discord ID lipsește.'},400);if(target===String(discordUser.id))return reply({error:'Nu îți poți șterge propriul cont de administrator.'},400);
      await db.from('panel_sessions').delete().eq('discord_id',target);
      await db.from('organization_members').delete().eq('organization_id',organizationId).eq('discord_id',target);
      const {error}=await db.from('users').delete().eq('discord_id',target);if(error)throw error;return reply({ok:true});
    }
    if(body.action==='audit'){
      const {error}=await db.from('admin_audit_log').insert({organization_id:organizationId,actor_discord_id:discordUser.id,actor_name:actorName,action:String(body.event||'admin_action').slice(0,120),target_type:body.target_type||null,target_id:body.target_id==null?null:String(body.target_id),details:body.details||{}});if(error)throw error;return reply({ok:true});
    }
    if(body.action==='create_notification'){
      const title=String(body.title||'').trim().slice(0,120),message=String(body.message||'').trim().slice(0,1000);if(!title||!message)return reply({error:'Titlul și mesajul sunt obligatorii.'},400);
      const {data,error}=await db.from('panel_notifications').insert({organization_id:organizationId,title,message,level:['info','success','warning','error'].includes(body.level)?body.level:'info',recipient_discord_id:String(body.recipient||'').trim()||null,link:String(body.link||'').trim()||null}).select('id').single();if(error)throw error;
      await db.from('admin_audit_log').insert({organization_id:organizationId,actor_discord_id:discordUser.id,actor_name:actorName,action:'notification_create',target_type:'panel_notification',target_id:String(data.id),details:{recipient:body.recipient||'all'}});return reply({id:data.id});
    }
    if(body.action==='logs'){
      const [shiftsResult,absencesResult,marketResult,blackMarketResult,auditResult]=await Promise.all([
        db.from('shifts').select('discord_id,status,shift_type,duration,stop_reason,started_at,ended_at,created_at').eq('organization_id',organizationId).order('created_at',{ascending:false}).limit(350),
        db.from('absences').select('discord_id,colleague_name,notice_type,reason,notes,end_at,created_at').eq('organization_id',organizationId).order('created_at',{ascending:false}).limit(250),
        db.from('marketplace').select('nume,display_name,tip_actiune,produse,pret,created_at').eq('organization_id',organizationId).order('created_at',{ascending:false}).limit(150),
        db.from('marketplace_ilegal').select('nume,tip_actiune,produse,pret,created_at').eq('organization_id',organizationId).order('created_at',{ascending:false}).limit(150),
        db.from('admin_audit_log').select('actor_name,actor_discord_id,action,target_type,target_id,created_at').eq('organization_id',organizationId).order('created_at',{ascending:false}).limit(300),
      ]);
      for(const result of [shiftsResult,absencesResult,marketResult,blackMarketResult,auditResult]) if(result.error) throw result.error;
      const activityIds=[...new Set([...(shiftsResult.data||[]).map((item:any)=>String(item.discord_id||'')),...(absencesResult.data||[]).map((item:any)=>String(item.discord_id||''))].filter(Boolean))];
      const usersResult=activityIds.length?await db.from('users').select('discord_id,username,display_name').in('discord_id',activityIds):{data:[],error:null};
      if(usersResult.error) throw usersResult.error;
      return reply({users:usersResult.data||[],shifts:shiftsResult.data||[],absences:absencesResult.data||[],marketplace:marketResult.data||[],marketplace_ilegal:blackMarketResult.data||[],audit:auditResult.data||[]});
    }
    if(body.action==='operations'){
      const now=new Date().toISOString();
      const [shiftsResult,absencesResult]=await Promise.all([
        db.from('shifts').select('id,status').eq('organization_id',organizationId).in('status',['active','paused']),
        db.from('absences').select('id').eq('organization_id',organizationId).gte('end_at',now),
      ]);
      if(shiftsResult.error) throw shiftsResult.error;if(absencesResult.error) throw absencesResult.error;
      return reply({active_shifts:(shiftsResult.data||[]).filter((shift:any)=>shift.status==='active').length,paused_shifts:(shiftsResult.data||[]).filter((shift:any)=>shift.status==='paused').length,active_absences:(absencesResult.data||[]).length});
    }
    if(body.action==='force_close_shifts'){
      const {data:shifts,error}=await db.from('shifts').select('id,started_at,status,paused_at,paused_seconds').eq('organization_id',organizationId).in('status',['active','paused']);
      if(error) throw error;
      const now=new Date(),endTime=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Bucharest',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(now);
      let closed=0;
      for(const shift of shifts||[]){let paused=Number(shift.paused_seconds)||0;if(shift.status==='paused'&&shift.paused_at)paused+=Math.max(0,Math.floor((now.getTime()-new Date(shift.paused_at).getTime())/1000));const seconds=Math.max(0,Math.floor((now.getTime()-new Date(shift.started_at).getTime())/1000)-paused);const duration=`${Math.floor(seconds/3600).toString().padStart(2,'0')}:${Math.floor((seconds%3600)/60).toString().padStart(2,'0')}:${(seconds%60).toString().padStart(2,'0')}`;const result=await db.from('shifts').update({status:'completed',ended_at:now.toISOString(),end_time:endTime,duration,duration_ms:seconds*1000,stop_reason:'Încheiere de urgență – acțiune administrator'}).eq('organization_id',organizationId).eq('id',shift.id).in('status',['active','paused']).select('id').maybeSingle();if(result.error)throw result.error;if(result.data)closed++;}
      await db.from('admin_audit_log').insert({organization_id:organizationId,actor_discord_id:discordUser.id,actor_name:actorName,action:'shifts_emergency_stop',target_type:'shifts',details:{count:closed}});return reply({ok:true,closed});
    }
    if(body.action==='save_pontaj_config'){
      const value=body.value;if(!value||typeof value!=='object')return reply({error:'Configurație invalidă.'},400);
      const maxHours=Number(value.maxHours),dayEnd=String(value.dayEndTime||''),nightEnd=String(value.nightEndTime||'');
      if(!Number.isFinite(maxHours)||maxHours<1||maxHours>24||!/^[0-2]\d:[0-5]\d$/.test(dayEnd)||!/^[0-2]\d:[0-5]\d$/.test(nightEnd))return reply({error:'Configurația pontajului este invalidă.'},400);
      const safeValue={maxHours,mode:['normal','strict'].includes(String(value.mode))?String(value.mode):'normal',globalNotice:String(value.globalNotice||'').slice(0,500),dayEndTime:dayEnd,nightEndTime:nightEnd,excludeBreaks:Boolean(value.excludeBreaks)};
      const {error}=await db.from('app_settings').upsert({organization_id:organizationId,key:'pontaj_config',value:safeValue,updated_at:new Date().toISOString()},{onConflict:'organization_id,key'});if(error)throw error;
      await db.from('admin_audit_log').insert({organization_id:organizationId,actor_discord_id:discordUser.id,actor_name:actorName,action:'pontaj_config_update',target_type:'app_settings',target_id:'pontaj_config'});return reply({ok:true});
    }
    if(body.action==='import_config'){
      const value=body.value;if(!value||typeof value!=='object')return reply({error:'Configurație invalidă.'},400);const {error}=await db.from('app_settings').upsert({organization_id:organizationId,key:'pontaj_config',value,updated_at:new Date().toISOString()},{onConflict:'organization_id,key'});if(error)throw error;await db.from('admin_audit_log').insert({organization_id:organizationId,actor_discord_id:discordUser.id,actor_name:actorName,action:'config_import',target_type:'app_settings',target_id:'pontaj_config'});return reply({ok:true});
    }
    return reply({error:'Acțiune necunoscută.'},400);
  }catch(error){
    const details=error&&typeof error==='object'?(error as {message?:unknown;status?:unknown}):null;
    const message=error instanceof Error?error.message:String(details?.message||'Eroare internă.');
    const status=Number(details?.status)||(/^Sesiunea|^Utilizatorul nu este înregistrat/.test(message)?401:500);
    return reply({error:message},status);
  }
});
