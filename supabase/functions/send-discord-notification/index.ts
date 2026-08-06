import { createClient } from 'jsr:@supabase/supabase-js@2';
import { requirePanelSession } from '../_shared/panel-session.ts';

const cors = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-panel-session','Content-Type':'application/json'};
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:cors});
const levels: Record<string, number> = {
  organization: 1,
  pontaj: 1,
  requests: 1,
  contracts: 4,
  marketplace: 1,
  illegal_marketplace: 3,
  live_status: 1
};
const channels=new Set(Object.keys(levels));

Deno.serve(async request=>{
  if(request.method==='OPTIONS')return new Response('ok',{headers:cors});
  if(request.method!=='POST')return reply({error:'Metodă invalidă.'},405);
  try{
    const contentType=request.headers.get('content-type')||'';
    let channel='',payload:unknown,forwardBody:BodyInit,forwardHeaders:Record<string,string>={};
    if(contentType.includes('multipart/form-data')){
      const form=await request.formData();channel=String(form.get('_panel_channel')||'');form.delete('_panel_channel');form.delete('_panel_access_token');forwardBody=form;
    }else{
      const body=await request.json();channel=String(body.channel||'');payload=body.payload;forwardBody=JSON.stringify(payload);forwardHeaders['Content-Type']='application/json';
    }
    if(!channels.has(channel))return reply({error:'Canal Discord invalid.'},400);
    const keys=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')??'{}'),serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||keys.default;if(!serviceKey)throw new Error('Cheia service role lipsește.');
    const db=createClient(Deno.env.get('SUPABASE_URL')!,serviceKey);
    const session=await requirePanelSession(db,request,levels[channel]);
    const {data:config,error}=await db.from('organization_settings').select('webhook_routes').eq('organization_id',session.organization_id).maybeSingle();if(error)throw error;
    const route=config?.webhook_routes?.[channel];
    const configuredUrls=[route?.primary?.url,route?.secondary?.url].filter(Boolean).map(String);
    const webhooks=[...new Set(configuredUrls)];
    if(!webhooks.length)throw new Error(`Webhook-ul ${channel} nu este configurat pentru organizația activă.`);
    for(const webhook of webhooks){
      const parsed=new URL(webhook);if(parsed.protocol!=='https:'||parsed.hostname!=='discord.com')throw new Error('Webhook Discord invalid.');
      const sent=await fetch(webhook,{method:'POST',headers:forwardHeaders,body:forwardBody});if(!sent.ok)throw new Error(`Discord a răspuns cu HTTP ${sent.status}.`);
    }
    return reply({ok:true,routes:webhooks.length});
  }catch(error){console.error(error);return reply({error:error instanceof Error?error.message:'Eroare necunoscută.'},400)}
});
