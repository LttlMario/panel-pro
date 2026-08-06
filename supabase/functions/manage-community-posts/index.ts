import {createClient} from 'jsr:@supabase/supabase-js@2';
import {requirePanelSession} from '../_shared/panel-session.ts';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-panel-session','Content-Type':'application/json'};
const roleLevel=(role:string)=>{const r=(role||'').toLocaleLowerCase('ro-RO');if(r.includes('coordonator')||['admin','owner'].includes(r))return 7;if(r==='lider')return 6;if(['colider','co-lider','co lider'].includes(r))return 5;if(r.includes('manager'))return 4;if(r.includes('familia'))return 3;if(r.includes('sef')||r.includes('șef'))return 2;return 1};
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:cors});
Deno.serve(async(req)=>{if(req.method==='OPTIONS')return new Response('ok',{headers:cors});if(req.method!=='POST')return reply({error:'Method not allowed'},405);try{
 const body=await req.json();
 if(body.action==='create'){if(body.audience==='family')body.audience='organization';if(body.audience==='mechanics')body.audience='departments';if(!['organization','departments'].includes(String(body.audience||'')))return reply({error:'Alege organizația sau departamentul.'},400);}
 const keys=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')??'{}'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||keys.default;const db=createClient(Deno.env.get('SUPABASE_URL')!,key);
 const session=await requirePanelSession(db,req),du={id:session.discord_id};const level=session.permission_level,organizationId=session.organization_id;
 const {data:announcementSetting}=await db.from('app_settings').select('value').eq('organization_id',organizationId).eq('key','page_permissions').maybeSingle();
 const announcementPermissions=announcementSetting?.value?.announcement_permissions||{};
 const allows=(kind:string)=>{const levels=Array.isArray(announcementPermissions[kind])?announcementPermissions[kind].map(Number).filter(Number.isFinite):[];return levels.length?levels.includes(Number(level)):Number(level)>=1;};
 if(body.action==='announcement_access')return reply({read:allows('read'),write:allows('write')});
 if(['update','delete'].includes(body.action)&&!allows('write'))return reply({error:'Gradul tău nu are drept de publicare în Anunțuri.'},403);
 const {data:user}=await db.from('users').select('*').eq('discord_id',du.id).single();if(!user)return reply({error:'Utilizatorul nu există în panel.'},403);
 const own=async(id:string)=>{const {data,error}=await db.from('community_posts').select('*').eq('organization_id',organizationId).eq('id',id).maybeSingle();if(error)throw error;if(!data)throw new Error('Postarea nu mai există în organizația activă.');if(level<99&&String(data.author_discord_id)!==String(du.id))throw new Error('Poți administra numai postările tale.');return data};
 if(body.action==='create'){
  if(!allows('write'))return reply({error:'Gradul tău nu are drept de publicare în Anunțuri.'},403);
  if(level<1)return reply({error:'Este necesar un grad numeric valid pentru publicare.'},403);if(!['organization','departments','family','mechanics'].includes(body.audience))throw new Error('Alege audiența.');
  const audience=body.audience==='family'?'organization':body.audience==='mechanics'?'departments':body.audience;
  const {data:post,error}=await db.from('community_posts').insert({organization_id:organizationId,post_type:body.post_type,title:body.title,content:body.content,author_discord_id:du.id,author_name:user.display_name||user.username}).select().single();if(error)throw error;
  if(body.post_type==='poll'){const options=(body.options||[]).map((x:string,i:number)=>({organization_id:organizationId,post_id:post.id,option_text:x,position:i}));const {error:e}=await db.from('community_poll_options').insert(options);if(e)throw e}
  const discordMessageId=await notifyDiscord(post,body.options||[],body.audience);if(discordMessageId)await db.from('community_posts').update({discord_message_id:discordMessageId}).eq('id',post.id);return reply({post});
 }
 if(body.action==='update'){const post=await own(body.post_id);const {error}=await db.from('community_posts').update({title:body.title,content:body.content,updated_at:new Date().toISOString()}).eq('organization_id',organizationId).eq('id',body.post_id);if(error)throw error;if(post.post_type==='poll'&&Array.isArray(body.options)){if(body.options.length<2)throw new Error('Sondajul trebuie să aibă minimum două opțiuni.');const {data:existing}=await db.from('community_poll_options').select('option_text').eq('organization_id',organizationId).eq('post_id',body.post_id).order('position');const changed=JSON.stringify((existing||[]).map((x:any)=>x.option_text))!==JSON.stringify(body.options);if(changed){const {error:deleteOptionsError}=await db.from('community_poll_options').delete().eq('organization_id',organizationId).eq('post_id',body.post_id);if(deleteOptionsError)throw deleteOptionsError;const {error:insertOptionsError}=await db.from('community_poll_options').insert(body.options.map((text:string,position:number)=>({organization_id:organizationId,post_id:body.post_id,option_text:text,position})));if(insertOptionsError)throw insertOptionsError}}return reply({ok:true})}
 if(body.action==='delete'){const post=await own(body.post_id);const {data:deleted,error}=await db.from('community_posts').delete().eq('organization_id',organizationId).eq('id',body.post_id).select('id');if(error)throw error;if(!deleted?.length)throw new Error('Postarea nu a fost ștearsă.');if(post.discord_message_id){const {data:cfg}=await db.from('organization_settings').select('webhook_routes').eq('organization_id',organizationId).maybeSingle();const route=cfg?.webhook_routes?.organization||{};for(const webhook of [route.primary?.url,route.secondary?.url].filter(Boolean))await fetch(`${webhook}/messages/${post.discord_message_id}`,{method:'DELETE'})}return reply({ok:true,deleted_id:body.post_id})}
 if(body.action==='marketplace_delete'){const table=body.table;if(!['marketplace','marketplace_ilegal'].includes(table))throw new Error('Tabel Marketplace invalid.');const {data:item,error:itemError}=await db.from(table).select('id,created_by_discord_id').eq('organization_id',organizationId).eq('id',body.item_id).maybeSingle();if(itemError)throw itemError;if(!item)throw new Error('Anunțul nu mai există.');if(level<99&&String(item.created_by_discord_id||'')!==String(du.id))return reply({error:'Poți șterge numai anunțurile publicate de tine.'},403);const {data:deleted,error}=await db.from(table).delete().eq('organization_id',organizationId).eq('id',body.item_id).select('id');if(error)throw error;if(!deleted?.length)throw new Error('Anunțul nu a fost șters.');return reply({ok:true,deleted_id:body.item_id})}
 if(body.action==='react'){const key={organization_id:organizationId,post_id:body.post_id,user_discord_id:du.id,reaction:body.reaction};const {data}=await db.from('community_reactions').select('id').match(key).maybeSingle();const q=data?db.from('community_reactions').delete().eq('organization_id',organizationId).eq('id',data.id):db.from('community_reactions').insert(key);const {error}=await q;if(error)throw error;return reply({ok:true})}
 if(body.action==='vote'){const {data:option}=await db.from('community_poll_options').select('post_id').eq('organization_id',organizationId).eq('id',body.option_id).single();if(!option||option.post_id!==body.post_id)throw new Error('Opțiune invalidă.');const {error}=await db.from('community_poll_votes').upsert({organization_id:organizationId,post_id:body.post_id,option_id:body.option_id,user_discord_id:du.id},{onConflict:'post_id,user_discord_id'});if(error)throw error;await updateDiscordPoll(body.post_id);return reply({ok:true})}
 return reply({error:'Acțiune necunoscută.'},400);
async function notifyDiscord(post:any, options:string[], audience:string){

    const {data:discordConfig}=await db
        .from('organization_settings')
        .select('*')
        .eq('organization_id',organizationId)
        .maybeSingle();
    const family = false;

    const route = discordConfig?.webhook_routes?.[audience==='departments'?'departments':'organization'];
    const url = route?.primary?.url || route?.secondary?.url;

    if(!url){
        console.error('Webhook lipsă pentru:', post.audience);
        return null;
    }

    const site = (
        discordConfig?.panel_public_url ||
        'https://lttlmario.github.io/panel-mafie'
    ).replace(/\/$/,'');

    const postUrl = `${site}/anunturi.html?post=${post.id}`;

    const roleId = family
        ? discordConfig?.family_role_id
        : discordConfig?.mechanics_role_id;


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


    const sent = await fetch(`${url}?wait=true`,{

        method:'POST',

        headers:{
            'Content-Type':'application/json'
        },

        body:JSON.stringify({

            embeds:[{

                title:post.title,
                description:post.content,
                color:family ? 15548997 : 3447003,
                fields,
                url:postUrl,

                footer:{
                    text:
                    `${post.post_type === 'poll'
                        ? 'Sondaj'
                        : post.post_type === 'question'
                        ? 'Întrebare'
                        : 'Anunț'} • ${post.author_name}`
                }

            }]

        })

    });


    const message = sent.ok
        ? await sent.json()
        : null;


    if(roleId){

        await fetch(url,{

            method:'POST',

            headers:{
                'Content-Type':'application/json'
            },

            body:JSON.stringify({

                content:`<@&${roleId}>`,

                allowed_mentions:{
                    roles:[roleId]
                }

            })

        });

    }


    return message?.id || null;

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


    const family = false;


    const route = discordConfig?.webhook_routes?.organization;
    const url = route?.primary?.url || route?.secondary?.url;


    if(!url) return;


    const site = (
            discordConfig?.panel_public_url ||
            'https://lttlmario.github.io/panel-mafie'
        ).replace(/\/$/,'');


    const postUrl = `${site}/anunturi.html?post=${post.id}`;


    await fetch(`${url}/messages/${post.discord_message_id}`,{

        method:'PATCH',

        headers:{
            'Content-Type':'application/json'
        },

        body:JSON.stringify({

            embeds:[{

                title:post.title,

                description:post.content,

                color:family ? 15548997 : 3447003,

                url:postUrl,

                fields:[

                    {
                        name:`Rezultate live • ${total} voturi`,
                        value:result || 'Încă nu există voturi.'
                    },

                    {
                        name:'🗳️ Votează în panel',
                        value:`[Deschide sondajul](${postUrl})`
                    }

                ],

                footer:{
                    text:`Sondaj • ${post.author_name}`
                }

            }]

        })

    });

}
 }catch(e){console.error(e);return reply({error:e instanceof Error?e.message:'Eroare necunoscută.'},400)}});
