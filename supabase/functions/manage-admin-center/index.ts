import { createClient } from 'jsr:@supabase/supabase-js@2';
import { requirePanelSession } from '../_shared/panel-session.ts';
import { isPlatformAdminDiscordId } from '../_shared/platform-admin.ts';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-panel-session','Access-Control-Allow-Methods':'POST,OPTIONS','Content-Type':'application/json'};
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
    if(!isPlatformAdminDiscordId(discordUser.id))return reply({error:'Această funcție este rezervată administratorului platformei.'},403);
    if(body.action==='notifications'){
      const {data:notes,error}=await db.from('panel_notifications').select('*').eq('organization_id',organizationId).or(`recipient_discord_id.is.null,recipient_discord_id.eq.${discordUser.id}`).order('created_at',{ascending:false}).limit(40);if(error)throw error;
      const {data:reads}=await db.from('panel_notification_reads').select('notification_id').eq('organization_id',organizationId).eq('discord_id',discordUser.id);
      return reply({notifications:notes||[],read_ids:(reads||[]).map(x=>x.notification_id)});
    }
    if(body.action==='mark_read'){
      const ids=(Array.isArray(body.ids)?body.ids:[]).slice(0,100);if(ids.length)await db.from('panel_notification_reads').upsert(ids.map((id:unknown)=>({organization_id:organizationId,notification_id:id,discord_id:discordUser.id})),{onConflict:'notification_id,discord_id'});return reply({ok:true});
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
    if(body.action==='import_config'){
      const value=body.value;if(!value||typeof value!=='object')return reply({error:'Configurație invalidă.'},400);const {error}=await db.from('app_settings').upsert({organization_id:organizationId,key:'pontaj_config',value,updated_at:new Date().toISOString()},{onConflict:'organization_id,key'});if(error)throw error;await db.from('admin_audit_log').insert({organization_id:organizationId,actor_discord_id:discordUser.id,actor_name:actorName,action:'config_import',target_type:'app_settings',target_id:'pontaj_config'});return reply({ok:true});
    }
    return reply({error:'Acțiune necunoscută.'},400);
  }catch(error){return reply({error:error instanceof Error?error.message:'Eroare internă.'},500)}
});
