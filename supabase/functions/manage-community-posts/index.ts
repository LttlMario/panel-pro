Exit code: 0
Wall time: 1.7 seconds
Output:
import {createClient} from 'jsr:@supabase/supabase-js@2';
import {requirePanelSession} from '../_shared/panel-session.ts';
import {isPlatformAdminDiscordId} from '../_shared/platform-admin.ts';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-panel-session','Content-Type':'application/json'};

const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:cors});
const normalizeBlackMarketName=(value:unknown)=>String(value??'').replace(/^\s*\d{1,12}\s+/,'').replace(/^\s*\d{1,12}\s*[|:/#-]\s*/,'').replace(/\s*[|:/#-]\s*\d{1,12}\s*$/,'').replace(/\s+\d{1,12}\s*$/,'').replace(/\s*[[(]\s*\d{1,12}\s*[\])]\s*$/,'').replace(/\s{2,}/g,' ').trim();
Deno.serve(async(req)=>{if(req.method==='OPTIONS')return new Response('ok',{headers:cors});if(req.method!=='POST')return reply({error:'Method not allowed'},405);try{
 const body=await req.json();
if (body.action === 'create') {
    if (!['organization', 'departments'].includes(String(body.audience || ''))) {
        return reply({
            error: 'Alege OrganizaÈ›ie sau Birouri / AngajaÈ›i.'
        }, 400);
    }
}
 const keys=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')??'{}'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||keys.default;const db=createClient(Deno.env.get('SUPABASE_URL')!,key);
const session = await requirePanelSession(db, req);

const du = {
    id: session.discord_id
};

const organizationId = session.organization_id;

const isPlatformAdmin = isPlatformAdminDiscordId(session.discord_id);
const { data: permissionSettings, error: permissionSettingsError } =
    await db
        .from('app_settings')
        .select('key,value')
        .eq('organization_id', organizationId)
        .in('key', [
            'page_permissions',
            'action_permissions',
            'communication_permissions'
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

const hasAnnouncementPageAccess =
    isPlatformAdmin ||
    sessionDiscordRoleIds.some(roleId =>
        allowedAnnouncementRoles.includes(roleId)
    );

const canPublishAnnouncements =
    isPlatformAdmin ||
    sessionDiscordRoleIds.some(roleId =>
        allowedAnnouncementPublishRoles.includes(roleId)
    );
const audienceRoles = (audience:string, kind:'read'|'write') =>
    Array.isArray(communicationPermissions?.[audience]?.[kind])
        ? communicationPermissions[audience][kind].map(String)
        : [];
const canForAudience = (audience:string, kind:'read'|'write') =>
    isPlatformAdmin || sessionDiscordRoleIds.some(roleId => audienceRoles(audience, kind).includes(roleId));
const readAudiences = isPlatformAdmin
    ? ['organization','departments']
    : ['organization','departments'].filter(audience => canForAudience(audience,'read'));
const writeAudiences = isPlatformAdmin
    ? ['organization','departments']
    : ['organization','departments'].filter(audience => canForAudience(audience,'write'));
if (body.action === 'announcement_access') {
    return reply({
        read: communicationSetting ? readAudiences.length > 0 : hasAnnouncementPageAccess,
        write: communicationSetting ? writeAudiences.length > 0 : canPublishAnnouncements,
        read_audiences: communicationSetting ? readAudiences : (hasAnnouncementPageAccess ? ['organization','departments'] : []),
        write_audiences: communicationSetting ? writeAudiences : (canPublishAnnouncements ? ['organization','departments'] : []),
        platform_admin: isPlatformAdmin
    });
}
if (
    body.action === 'create' &&
    !(communicationSetting ? canForAudience(String(body.audience || ''), 'write') : canPublishAnnouncements)
) {
    return reply({
        error: 'Rolul tÄƒu nu are permisiunea de a publica sau administra anunÈ›uri È™i sondaje.'
    }, 403);
}
 const {data:user}=await db.from('users').select('*').eq('discord_id',du.id).single();if(!user)return reply({error:'Utilizatorul nu existÄƒ Ã®n panel.'},403);
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
            'Postarea nu mai existÄƒ Ã®n organizaÈ›ia activÄƒ.'
        );
    }

    if (
        !isPlatformAdmin &&
        String(data.author_discord_id) !== String(du.id)
    ) {
        throw new Error(
            'PoÈ›i administra numai postÄƒrile tale.'
        );
    }

    return data;
};
 if(body.action==='create'){


    if (!['organization', 'departments'].includes(body.audience)) {
        throw new Error('Alege OrganizaÈ›ie sau Birouri / AngajaÈ›i.');
    }
    if (communicationSetting && !canForAudience(String(body.audience), 'write')) {
        return reply({ error: 'Rolul tÄƒu nu poate publica pentru aceastÄƒ audienÈ›Äƒ.' }, 403);
    }

    const audience = body.audience;
    const {data:post,error}=await db.from('community_posts').insert({
        organization_id: organizationId,
        audience: audience,
        post_type: body.post_type === 'fine' ? 'fine' : body.post_type,
        title: body.title,
        content: body.content,
        author_discord_id: du.id,
        author_name: user.display_name || user.username
    }).select().single();
    if(body.post_type==='poll'){const options=(body.options||[]).map((x:string,i:number)=>({organization_id:organizationId,post_id:post.id,option_text:x,position:i}));const {error:e}=await db.from('community_poll_options').insert(options);if(e)throw e}
    const discordMessageId = await notifyDiscord(
        post,
        body.options || [],
        post.audience
    );

    if (discordMessageId) {
        await db
            .from('community_posts')
            .update({
                discord_message_id: discordMessageId
            })
            .eq('organization_id', organizationId)
            .eq('id', post.id);
    }

    return reply({ post });
 }
 if(body.action==='update'){const post=await own(body.post_id);if(communicationSetting&&!canForAudience(String(post.audience||'organization'),'write'))return reply({error:'Rolul tÄƒu nu poate modifica aceastÄƒ audienÈ›Äƒ.'},403);const {error}=await db.from('community_posts').update({title:body.title,content:body.content,updated_at:new Date().toISOString()}).eq('organization_id',organizationId).eq('id',body.post_id);if(error)throw error;if(post.post_type==='poll'&&Array.isArray(body.options)){if(body.options.length<2)throw new Error('Sondajul trebuie sÄƒ aibÄƒ minimum douÄƒ opÈ›iuni.');const {data:existing}=await db.from('community_poll_options').select('option_text').eq('organization_id',organizationId).eq('post_id',body.post_id).order('position');const changed=JSON.stringify((existing||[]).map((x:any)=>x.option_text))!==JSON.stringify(body.options);if(changed){const {error:deleteOptionsError}=await db.from('community_poll_options').delete().eq('organization_id',organizationId).eq('post_id',body.post_id);if(deleteOptionsError)throw deleteOptionsError;const {error:insertOptionsError}=await db.from('community_poll_options').insert(body.options.map((text:string,position:number)=>({organization_id:organizationId,post_id:body.post_id,option_text:text,position})));if(insertOptionsError)throw insertOptionsError}}return reply({ok:true})}
 if (body.action === 'delete') {
    const post = await own(body.post_id);
    if (communicationSetting && !canForAudience(String(post.audience || 'organization'), 'write')) {
        return reply({ error: 'Rolul tÄƒu nu poate È™terge aceastÄƒ audienÈ›Äƒ.' }, 403);
    }

    const { data: deleted, error } = await db
        .from('community_posts')
        .delete()
        .eq('organization_id', organizationId)
        .eq('id', body.post_id)
        .select('id');

    if (error) throw error;

    if (!deleted?.length) {
        throw new Error('Postarea nu a fost È™tearsÄƒ.');
    }

    if (post.discord_message_id) {
        const { data: cfg } = await db
            .from('organization_settings')
            .select('webhook_routes')
            .eq('organization_id', organizationId)
            .maybeSingle();

        const audience =
            post.audience === 'departments'
                ? 'departments'
                : 'organization';

        const routeKey = post.post_type === 'fine'
            ? (audience === 'departments' ? 'fines_departments' : 'fines_organization')
            : audience;
        const route = cfg?.webhook_routes?.[routeKey] || {};

        const webhooks = [
            route.primary?.url,
            route.secondary?.url
        ].filter(Boolean);

        for (const webhook of webhooks) {
            await fetch(
                `${webhook}/messages/${post.discord_message_id}`,
                {
                    method: 'DELETE'
                }
            );
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
   const globalMarketplace=table==='marketplace_ilegal'&&isPlatformAdmin;
   const itemQuery=db.from(table).select('id,organization_id,created_by_discord_id,discord_message_ids').eq('id',body.item_id);
   if(!globalMarketplace)itemQuery.eq('organization_id',organizationId);
   const {data:item,error:itemError}=await itemQuery.maybeSingle();
   if(itemError)throw itemError;
   if(!item)throw new Error('AnunÈ›ul nu mai existÄƒ sau nu este accesibil.');
   if(!isPlatformAdmin&&String(item.created_by_discord_id||'')!==String(du.id))return reply({error:'PoÈ›i È™terge numai anunÈ›urile publicate de tine.'},403);
   const deleteQuery=db.from(table).delete().eq('id',body.item_id);
   if(!globalMarketplace)deleteQuery.eq('organization_id',organizationId);
   const {data:deleted,error}=await deleteQuery.select('id');
   if(error)throw error;
   if(!deleted?.length)throw new Error('AnunÈ›ul nu a fost È™ters.');
   const messageRefs = Array.isArray(item.discord_message_ids) ? item.discord_message_ids : [];
   for (const ref of messageRefs) {
     if (!ref?.webhook || !ref?.id) continue;
     try { await fetch(`${String(ref.webhook).replace(/\/$/, '')}/messages/${encodeURIComponent(String(ref.id))}`, { method: 'DELETE' }); } catch (_) {}
   }
   return reply({ok:true,deleted_id:body.item_id});
 }
 if(body.action==='marketplace_update'){if(body.table!=='marketplace_ilegal')throw new Error('Tabel Marketplace invalid.');const itemQuery=db.from('marketplace_ilegal').select('id,organization_id,created_by_discord_id').eq('id',body.item_id);if(!isPlatformAdmin)itemQuery.eq('organization_id',organizationId);const {data:item,error:itemError}=await itemQuery.maybeSingle();if(itemError)throw itemError;if(!item)return reply({error:'AnunÈ›ul nu existÄƒ sau nu aparÈ›ine organizaÈ›iei active.'},404);if(!isPlatformAdmin&&String(item.created_by_discord_id||'')!==String(du.id))return reply({error:'PoÈ›i edita numai anunÈ›urile publicate de tine.'},403);const {data:updated,error:updateError}=await db.from('marketplace_ilegal').update({nume:normalizeBlackMarketName(body.nume),telefon:String(body.telefon||''),tip_actiune:body.tip_actiune||null,categorie:body.categorie||null,subcategorie:body.subcategorie||null,produse:String(body.produse||''),pret:body.pret||null,imagini_json:body.imagini_json||'[]',imagine_url:body.imagine_url||null,updated_at:new Date().toISOString()}).eq('id',body.item_id).select('*').single();if(updateError)throw updateError;return reply({ok:true,item:updated})}
 if(body.action==='react'){const key={organization_id:organizationId,post_id:body.post_id,user_discord_id:du.id,reaction:body.reaction};const {data}=await db.from('community_reactions').select('id').match(key).maybeSingle();const q=data?db.from('community_reactions').delete().eq('organization_id',organizationId).eq('id',data.id):db.from('community_reactions').insert(key);const {error}=await q;if(error)throw error;return reply({ok:true})}
 if(body.action==='vote'){const {data:option}=await db.from('community_poll_options').select('post_id').eq('organization_id',organizationId).eq('id',body.option_id).single();if(!option||option.post_id!==body.post_id)throw new Error('OpÈ›iune invalidÄƒ.');const {error}=await db.from('community_poll_votes').upsert({organization_id:organizationId,post_id:body.post_id,option_id:body.option_id,user_discord_id:du.id},{onConflict:'post_id,user_discord_id'});if(error)throw error;await updateDiscordPoll(body.post_id);return reply({ok:true})}
 return reply({error:'AcÈ›iune necunoscutÄƒ.'},400);
async function notifyDiscord(post:any, options:string[], audience:string){

    const {data:discordConfig}=await db
        .from('organization_settings')
        .select('*')
        .eq('organization_id',organizationId)
        .maybeSingle();


    const routeKey = post.post_type === 'fine'
        ? (audience === 'departments' ? 'fines_departments' : 'fines_organization')
        : (audience === 'departments' ? 'departments' : 'organization');
    const route = discordConfig?.webhook_routes?.[routeKey];
    const url = route?.primary?.url || route?.secondary?.url;

    if (!url) {
        console.error(
            `Webhook lipsÄƒ pentru organizaÈ›ia ${organizationId}, audienÈ›a ${audience}`
        );

        return null;
    }

    const site = (
        discordConfig?.panel_public_url ||
        'https://lttlmario.github.io/panel-pro'
    ).replace(/\/$/,'');

    const postUrl = `${site}/anunturi.html?post=${post.id}`;



    const fields:Array<{name:string,value:string}> = [];


    if(post.post_type === 'poll' && options.length){

        fields.push({
            name:'Rezultate live',
            value: options
                .map((x:string)=>`â–«ï¸ ${x} â€” 0 voturi (0%)`)
                .join('\n')
        });

    }


    fields.push({
        name: post.post_type === 'poll'
            ? 'ðŸ—³ï¸ VoteazÄƒ Ã®n panel'
            : 'ðŸ’¬ RÄƒspunde Ã®n panel',

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
                color: audience === 'organization' ? 5865 : 3447003,
                fields,
                url:postUrl,

                footer:{
                    text:
                    `${post.post_type === 'poll'
                        ? 'Sondaj'
                        : post.post_type === 'question'
                        ? 'ÃŽntrebare'
                        : 'AnunÈ›'} â€¢ ${post.author_name}`
                }

            }]

        })

    });


    if (!sent.ok) {
        const discordError = await sent.text();

        console.error(
            `Discord webhook error pentru organizaÈ›ia ${organizationId}, audienÈ›a ${audience}:`,
            sent.status,
            discordError
        );

        throw new Error(
            `Postarea a fost creatÄƒ, dar Discord a rÄƒspuns cu eroarea HTTP ${sent.status}.`
        );
    }

    const message = await sent.json();

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

            return `â–«ï¸ ${o.option_text} â€” ${count} voturi (${percent}%)`;

        })
        .join('\n');



    const audience =
        post.audience === 'departments'
            ? 'departments'
            : 'organization';

    const routeKey = post.post_type === 'fine'
        ? (audience === 'departments' ? 'fines_departments' : 'fines_organization')
        : audience;
    const route = discordConfig?.webhook_routes?.[routeKey];

    const url = route?.primary?.url || route?.secondary?.url;


    if(!url) return;


    const site = (
            discordConfig?.panel_public_url ||
            'https://lttlmario.github.io/panel-pro'
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

                color: audience === 'organization' ? 5865 : 3447003,

                url:postUrl,

                fields:[

                    {
                        name:`Rezultate live â€¢ ${total} voturi`,
                        value:result || 'ÃŽncÄƒ nu existÄƒ voturi.'
                    },

                    {
                        name:'ðŸ—³ï¸ VoteazÄƒ Ã®n panel',
                        value:`[Deschide sondajul](${postUrl})`
                    }

                ],

                footer:{
                    text:`Sondaj â€¢ ${post.author_name}`
                }

            }]

        })

    });

}
 }catch(e){console.error(e);return reply({error:e instanceof Error?e.message:'Eroare necunoscutÄƒ.'},400)}});

