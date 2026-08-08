import { createClient } from 'jsr:@supabase/supabase-js@2';
import { requirePanelSession } from '../_shared/panel-session.ts';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-panel-session','Access-Control-Allow-Methods':'POST,OPTIONS','Content-Type':'application/json'};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:cors});
const roleLevel=(value:unknown)=>{const text=String(value||'').toLowerCase();const number=Number(value);if(Number.isFinite(number))return number;if(text.includes('admin')||text.includes('owner'))return 7;if(text.includes('manager'))return 4;return 1};
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
    const level=session.permission_level, organizationId=session.organization_id,actorName=user.display_name||user.username||discordUser.id;
    const adminByLevel=Number(level)>=99;
    if (adminByLevel) Deno.env.set('PLATFORM_OWNER_DISCORD_IDS', `${Deno.env.get('PLATFORM_OWNER_DISCORD_IDS') || ''},${discordUser.id}`);
    if(body.action==='notifications'){
      const {data:notes,error}=await db.from('panel_notifications').select('*').eq('organization_id',organizationId).or(`recipient_discord_id.is.null,recipient_discord_id.eq.${discordUser.id}`).order('created_at',{ascending:false}).limit(40);if(error)throw error;
      const {data:reads}=await db.from('panel_notification_reads').select('notification_id').eq('organization_id',organizationId).eq('discord_id',discordUser.id);
      return reply({notifications:notes||[],read_ids:(reads||[]).map(x=>x.notification_id)});
    }
    if(body.action==='mark_read'){
      const ids=(Array.isArray(body.ids)?body.ids:[]).slice(0,100);if(ids.length)await db.from('panel_notification_reads').upsert(ids.map((id:unknown)=>({organization_id:organizationId,notification_id:id,discord_id:discordUser.id})),{onConflict:'notification_id,discord_id'});return reply({ok:true});
    }
    const platformOwners=String(Deno.env.get('PLATFORM_OWNER_DISCORD_IDS')||'').split(',').map(value=>value.trim()).filter(Boolean);if(!platformOwners.includes(String(discordUser.id)))return reply({error:'Această funcție este rezervată administratorului platformei.'},403);
    if(level<7)return reply({error:'Acțiunea necesită rol de administrator.'},403);
    if(body.action==='members'){
      const {data:members,error}=await db.from('organization_members').select('*').eq('organization_id',organizationId).eq('active',true).order('permission_level',{ascending:false});if(error)throw error;
      const ids=(members||[]).map((m:any)=>m.discord_id),{data:users}=ids.length?await db.from('users').select('discord_id,username,display_name,avatar,avatar_url').in('discord_id',ids):{data:[]};
      const profiles=new Map((users||[]).map((u:any)=>[String(u.discord_id),u]));return reply({members:(members||[]).map((m:any)=>({...profiles.get(String(m.discord_id)),...m,role:m.panel_role}))});
    }
    if(body.action==='member_role'){
      const target=String(body.discord_id||''),role=String(body.role||'').trim(),permission=Number(body.permission_level);if(!target||!role||permission<1||permission>99)return reply({error:'Gradul numeric este invalid.'},400);
      const {error}=await db.from('organization_members').update({panel_role:role,permission_level:permission,last_verified_at:new Date().toISOString()}).eq('organization_id',organizationId).eq('discord_id',target);if(error)throw error;
      await db.from('panel_sessions').update({revoked_at:new Date().toISOString()}).eq('organization_id',organizationId).eq('discord_id',target).is('revoked_at',null);return reply({ok:true});
    }
    if(body.action==='member_kick'){
      const target=String(body.discord_id||'');if(!target)return reply({error:'Discord ID lipsește.'},400);
      await db.from('organization_members').update({active:false}).eq('organization_id',organizationId).eq('discord_id',target);
      await db.from('panel_sessions').update({revoked_at:new Date().toISOString()}).eq('organization_id',organizationId).eq('discord_id',target).is('revoked_at',null);return reply({ok:true});
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
