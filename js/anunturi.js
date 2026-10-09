(() => {
  const URL=window.PANEL_SUPABASE_CONFIG.url;
  const KEY=window.PANEL_SUPABASE_CONFIG.publishableKey;
  const db = window.createPanelSupabaseClient();
  const user = window.getUser?.() || {};
  const currentProposalPage = location.pathname.split('/').pop();
  const proposalOnly = ['propuneri.html', 'propuneri-angajati.html', 'propuneri-organizatie.html'].includes(currentProposalPage);
  const pageProposalAudience = currentProposalPage === 'propuneri-angajati.html' ? 'departments' : currentProposalPage === 'propuneri-organizatie.html' ? 'organization' : '';
  const communityPageAudience = ['organization', 'departments'].includes(document.body?.dataset?.communityAudience)
    ? document.body.dataset.communityAudience
    : pageProposalAudience;
  let posts=[], filter=proposalOnly ? 'proposal' : 'all', editing=null, draft=null;
  let canWriteAnnouncements = false;
  let isPlatformAdmin = false;
  let readAudiences = [];
  let writeAudiences = [];
  let proposalWriteAudiences = [];
  let proposalReadAudiences = [];
  let announcementAccess = { read: false, write: false };
  let organizationId = null;
  let organizationReady = null;
  let loadPromise = null;
  const communityQueryTimeoutMs = 15000;
  const $=s=>document.querySelector(s), esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  if ($('#post-type') && !$('#post-type option[value="proposal"]')) $('#post-type').insertAdjacentHTML('beforeend','<option value="proposal">Propunere</option>');
  const invoke=async(body)=>{const token=window.getPanelDiscordAccessToken?.()||'',panelSession=localStorage.getItem('panel_session_token')||'';if(!panelSession){requestFreshLogin();throw new Error('Sesiunea securizată a panelului lipsește. Autentifică-te din nou.')}const controller=new AbortController(),timeout=window.setTimeout(()=>controller.abort(),communityQueryTimeoutMs);let res;try{res=await fetch(`${URL}/functions/v1/manage-community-posts`,{method:'POST',headers:{'Content-Type':'application/json',apikey:KEY,Authorization:`Bearer ${KEY}`,'x-panel-session':panelSession},body:JSON.stringify({...body,...(token?{access_token:token}:{})}),signal:controller.signal})}catch(error){if(error?.name==='AbortError')throw new Error('Verificarea permisiunilor a durat prea mult. Verifică internetul și încearcă din nou.');throw error}finally{window.clearTimeout(timeout)}let json={};try{json=await res.json()}catch{json={}}if(res.status===401){requestFreshLogin();throw new Error('Sesiunea panelului a expirat. Autentifică-te din nou.')}if(!res.ok){
    console.error("EDGE ERROR RESPONSE:", json);
    throw new Error(
        json.error ||
        json.message ||
        JSON.stringify(json) ||
        `Operația a eșuat. Cod HTTP: ${res.status}`
    );
}return json};
  const showFeedMessage=(message,retry=false)=>{const feed=$('#feed');if(!feed)return;feed.innerHTML=`<div class="empty">${esc(message)}${retry?'<br><button type="button" class="btn secondary" data-retry-community style="margin-top:14px">Încearcă din nou</button>':''}</div>`;feed.querySelector('[data-retry-community]')?.addEventListener('click',()=>load())};
  async function runCommunityQuery(factory, timeoutMessage='Încărcarea anunțurilor a durat prea mult.'){const controller=new AbortController(),timeout=window.setTimeout(()=>controller.abort(),communityQueryTimeoutMs);try{return await factory(controller.signal)}catch(error){if(error?.name==='AbortError')throw new Error(timeoutMessage);throw error}finally{window.clearTimeout(timeout)}}
  function requestFreshLogin(){sessionStorage.setItem('panel_return_after_login',location.href);setTimeout(()=>{location.href='login.html?v=20260819-session-return-fix'},700)}
  async function loadAnnouncementAccess() {
      try {
          const access = await invoke({ action: 'announcement_access', section: 'announcements' });

          const canRead = access?.read === true;
          const canWrite = access?.write === true;

          isPlatformAdmin = access?.platform_admin === true;
          readAudiences = Array.isArray(access?.read_audiences) ? access.read_audiences.map(String).filter(Boolean) : [];
          writeAudiences = Array.isArray(access?.write_audiences) ? access.write_audiences.map(String).filter(Boolean) : [];
          proposalWriteAudiences = Array.isArray(access?.proposal_write_audiences) ? access.proposal_write_audiences.map(String).filter(Boolean) : [];
          proposalReadAudiences = Array.isArray(access?.proposal_read_audiences) ? access.proposal_read_audiences.map(String).filter(Boolean) : [];
          if (proposalOnly) { readAudiences = proposalReadAudiences; writeAudiences = Array.isArray(access?.proposal_write_audiences) ? access.proposal_write_audiences.map(String).filter(Boolean) : []; }
          const pageCanRead = communityPageAudience ? readAudiences.includes(communityPageAudience) : canRead;
          const pageCanWrite = communityPageAudience ? writeAudiences.includes(communityPageAudience) : canWrite;
          canWriteAnnouncements = pageCanWrite;
          configureAudienceChoices();
          window.dispatchEvent(new CustomEvent('community:permissions-updated'));

          if (!pageCanRead) {
              announcementAccess = { read: false, write: false };
              showFeedMessage(communityPageAudience === 'organization'
                ? 'Nu ai permisiunea de a accesa Anunțuri organizație.'
                : communityPageAudience === 'departments'
                  ? 'Nu ai permisiunea de a accesa Anunțuri angajați.'
                  : 'Nu ai permisiunea de a accesa Anunțuri & Sondaje.');

            canWriteAnnouncements = false;
            $('#create-button').hidden = true;

            return {
                read: false,
                write: false
            };
          }

          $('#create-button').hidden = !pageCanWrite;
          announcementAccess = { read: true, write: pageCanWrite };

          return {
              read: true,
              write: pageCanWrite
          };

      } catch (error) {
          console.error(
              'Nu pot verifica permisiunile pentru Anunțuri:',
              error
          );
        canWriteAnnouncements = false;
        $('#create-button').hidden = true;
        showFeedMessage(error.message || 'Permisiunile pentru Anunțuri nu sunt disponibile momentan.', true);

        return {
            read: false,
            write: false
        };
      }
  }

async function loadNow() {
    if (!organizationId) {
        console.error('Nu există organization_id activ.');

        showFeedMessage('Nu a fost identificată organizația activă.');

        return;
    }

    const visibleAudiences = communityPageAudience ? [communityPageAudience] : (proposalOnly ? proposalReadAudiences : readAudiences);
    if (!visibleAudiences.length) {
        showFeedMessage('Nu ai nicio audiență de comunicare permisă.');
        return;
    }

    // Audiența este filtrată în query, înainte ca datele să ajungă în browser.
    // Filtrarea doar în render ar permite unui utilizator să descarce datele celeilalte audiențe.
    const postResult = proposalOnly
      ? await runCommunityQuery((signal) => db.from('community_proposals').select('id,audience,title,content,author_discord_id,author_name,discord_message_id,created_at,updated_at,proposal_status,proposal_decision_note').eq('organization_id', organizationId).in('audience', visibleAudiences).order('created_at', { ascending: false }).abortSignal(signal).then((result) => ({ ...result, data: (result.data || []).map((post) => ({ ...post, post_type: 'proposal' })) })))
      : await runCommunityQuery((signal) => db.from('community_posts').select('id,post_type,audience,title,content,author_discord_id,author_name,discord_message_id,created_at,updated_at').eq('organization_id', organizationId).in('audience', visibleAudiences).neq('post_type', 'proposal').order('created_at', { ascending: false }).abortSignal(signal));
    if (postResult.error) {
        showFeedMessage(`Nu pot citi anunțurile din Supabase: ${postResult.error.message || postResult.error.code || 'eroare necunoscută'}`, true);
        return;
    }

    const postIds = (postResult.data || []).map(post => post.id).filter(Boolean);
    if (!postIds.length) {
        posts = [];
        render();
        window.dispatchEvent(new CustomEvent('community:posts-updated'));
        return;
    }

    const pollPostIds = (postResult.data || []).filter(post => post.post_type === 'poll').map(post => post.id).filter(Boolean);
    const proposalPostIds = (postResult.data || []).filter(post => post.post_type === 'proposal').map(post => post.id).filter(Boolean);
    const [optionResult, reactionResult, voteResult, readResult, proposalVoteResult] = await Promise.all([
        pollPostIds.length ? runCommunityQuery((signal) => db.from('community_poll_options').select('id,post_id,option_text,position').eq('organization_id', organizationId).in('post_id', pollPostIds).abortSignal(signal)) : Promise.resolve({ data: [], error: null }),
        runCommunityQuery((signal) => db.from('community_reactions').select('post_id,user_discord_id,reaction').eq('organization_id', organizationId).in('post_id', postIds).abortSignal(signal)),
        pollPostIds.length ? runCommunityQuery((signal) => db.from('community_poll_votes').select('post_id,option_id,user_discord_id').eq('organization_id', organizationId).in('post_id', pollPostIds).abortSignal(signal)) : Promise.resolve({ data: [], error: null }),
        runCommunityQuery((signal) => db.from('community_post_reads').select('post_id,user_discord_id,display_name,confirmed_at').eq('organization_id', organizationId).in('post_id', postIds).order('confirmed_at').abortSignal(signal)),
        proposalPostIds.length ? runCommunityQuery((signal) => db.from('community_proposal_votes_v2').select('proposal_id,user_discord_id,display_name,vote,created_at').eq('organization_id', organizationId).in('proposal_id', proposalPostIds).abortSignal(signal).then((result) => ({ ...result, data: (result.data || []).map((vote) => ({ ...vote, post_id: vote.proposal_id })) }))) : Promise.resolve({ data: [], error: null })
    ]);

    const voterIds = [...new Set((voteResult.data || [])
        .map(vote => String(vote.user_discord_id || '').trim())
        .filter(Boolean))];
    const userResult = voterIds.length
        ? await runCommunityQuery((signal) => db.from('users').select('discord_id,display_name,username').in('discord_id', voterIds).abortSignal(signal))
        : { data: [], error: null };

    const error =
        postResult.error ||
        optionResult.error ||
        reactionResult.error ||
        voteResult.error ||
        readResult.error ||
        proposalVoteResult.error ||
        userResult.error;

    if (error) {
        console.error('Eroare încărcare anunțuri:', error);

        showFeedMessage(`Nu pot citi datele din Supabase: ${error.message || error.code || 'eroare necunoscută'}`, true);

        return;
    }

    const voters = userResult.data || [];

        posts = (postResult.data || [])
            .filter(Boolean)
            .filter(post => visibleAudiences.includes(post.audience))
            .map(post => ({
                ...post,

        community_poll_options:
            (optionResult.data || [])
                .filter(x => x.post_id === post.id),

        community_reactions:
            (reactionResult.data || [])
                .filter(x => x.post_id === post.id),

        community_poll_votes:
            (voteResult.data || [])
                .filter(x => x.post_id === post.id),

        community_post_reads:
            (readResult.data || [])
                .filter(x => x.post_id === post.id),

        community_proposal_votes:
            (proposalVoteResult.data || [])
                .filter(x => x.post_id === post.id),

        community_voters: voters
    }));

    render();
    window.dispatchEvent(new CustomEvent('community:posts-updated'));

    const wanted =
        new URLSearchParams(location.search).get('post');

    if (wanted) {
        setTimeout(() => {
            const element =
                document.getElementById(`post-${wanted}`);

            if (element) {
                element.classList.add('highlight');

                element.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center'
                });
            }
        }, 100);
    }
}
async function load(){
    if (loadPromise) return loadPromise;
    loadPromise = loadNow().catch((error) => {
        console.error('Eroare neașteptată la încărcarea anunțurilor:', error);
        showFeedMessage(error.message || 'Anunțurile nu au putut fi încărcate momentan.', true);
    }).finally(() => { loadPromise = null; });
    return loadPromise;
  }
  function render(){const visible=posts
.filter(Boolean)
.filter(p =>
    filter==='all' ||
    (filter==='announcements' && p.post_type!=='poll' && p.post_type!=='fine' && p.post_type!=='proposal') ||
    (filter==='proposal' && p.post_type==='proposal') ||
    (filter==='poll' && p.post_type==='poll') ||
    p.audience===filter ||
    (filter==='fine' && p.post_type==='fine') ||
    (filter==='poll-organization' && p.post_type==='poll' && p.audience==='organization') ||
    (filter==='poll-departments' && p.post_type==='poll' && p.audience==='departments')
);$('#feed').innerHTML=visible.length?visible.map(card).join(''):'<div class="empty">Nu există postări în această categorie.</div>';document.querySelectorAll('.post').forEach(node=>{const id=node.id.slice(5),post=posts.find(item=>String(item.id)===id);if(post?.post_type==='fine'){const badges=node.querySelectorAll('.badge');if(badges[1])badges[1].textContent='Amendă';}});bindCards()}
  function card(p){
      const own =
          String(p.author_discord_id) ===
          String(user.discord_id || user.id);

      const manage =
          isPlatformAdmin ||
          (writeAudiences.includes(p.audience) && own);

      const reactions = ['✅','❌','👍','❤️','🤔'];
      if (p.post_type === 'proposal') {
        const proposalVotes = p.community_proposal_votes || [];
        const myProposalVote = proposalVotes.find(v => String(v.user_discord_id) === String(user.discord_id || user.id));
        const support = proposalVotes.filter(v => v.vote === 'support').length;
        const against = proposalVotes.filter(v => v.vote === 'against').length;
        const status = ({new:'Nouă',review:'În analiză',accepted:'Acceptată',rejected:'Respinsă'})[p.proposal_status || 'new'] || 'Nouă';
        return `<article id="post-${p.id}" class="post"><div class="community-head"><div class="badges"><span class="badge ${p.audience}">${p.audience==='organization'?'Organizație':'Birouri / Angajați'}</span><span class="badge">Propunere · ${status}</span></div></div><h3>${esc(p.title)}</h3><div class="post-body">${esc(p.content)}</div><div class="proposal-votes">✅ Susțin: <b>${support}</b> · ❌ Contra: <b>${against}</b></div><div class="community-actions"><button class="reaction ${myProposalVote?.vote==='support'?'selected':''}" data-proposal-vote="support" data-proposal-id="${p.id}">✅ Susțin</button><button class="reaction ${myProposalVote?.vote==='against'?'selected':''}" data-proposal-vote="against" data-proposal-id="${p.id}">❌ Contra</button>${manage?`<div class="owner-actions"><button class="text-action" data-proposal-status="accepted" data-proposal-id="${p.id}">Acceptă</button><button class="text-action danger" data-proposal-status="rejected" data-proposal-id="${p.id}">Respinge</button></div>`:''}</div></article>`;
      }
    const reads=p.community_post_reads||[],hasRead=reads.some(x=>String(x.user_discord_id)===String(user.discord_id||user.id)),votes=p.community_poll_votes||[],myVote=votes.find(v=>String(v.user_discord_id)===String(user.discord_id||user.id)),people=p.community_voters||[];const poll=p.post_type==='poll'?`<div class="poll">${(p.community_poll_options||[]).sort((a,b)=>a.position-b.position).map(o=>{const optionVotes=votes.filter(v=>v.option_id===o.id),pc=votes.length?Math.round(optionVotes.length*100/votes.length):0,names=optionVotes.map(v=>{const person=people.find(x=>String(x.discord_id)===String(v.user_discord_id));return esc(person?.display_name||person?.username||v.user_discord_id)});return `<div class="poll-choice"><button class="poll-option" data-vote="${o.id}"><span class="poll-bar" style="width:${pc}%"></span><span class="poll-content"><span>${esc(o.option_text)}${myVote?.option_id===o.id?' ✓':''}</span><b>${pc}% · ${optionVotes.length}</b></span></button><details class="poll-voters"><summary>👥 Vezi cine a votat (${optionVotes.length})</summary><div>${names.length?names.map(n=>`<span>${n}</span>`).join(''):'<em>Nu a votat nimeni.</em>'}</div></details></div>`}).join('')}</div>`:'';const readNames=reads.map(x=>esc(x.display_name||x.user_discord_id));return `<article id="post-${p.id}" class="post"><div class="community-head"><div class="badges"><span class="badge ${p.audience}">${p.audience==='organization'?'Organizație':'Birouri / Angajați'}</span><span class="badge">${p.post_type==='poll'?'Sondaj':p.post_type==='question'?'Întrebare':'Anunț'}</span></div></div><h3>${esc(p.title)}</h3><div class="post-body">${esc(p.content)}</div>${poll}<div class="meta">${esc(p.author_name)} · ${new Date(p.created_at).toLocaleString('ro-RO')}</div><div class="community-actions"><div class="reactions"><button class="reaction ${hasRead?'selected':''}" data-read="${p.id}">✅ Am citit ${reads.length}</button></div>${reads.length?`<details class="poll-voters"><summary>Vezi cine a citit</summary><div>${readNames.map(n=>`<span>${n}</span>`).join('')}</div></details>`:''}${manage?`<div class="owner-actions"><button class="text-action" data-edit="${p.id}">Editează</button><button class="text-action danger" data-delete="${p.id}">Șterge</button></div>`:''}</div></article>`}
  function bindCards(){$$('[data-read]').forEach(b=>b.onclick=()=>withFeedback(b,act('read',{post_id:b.dataset.read})));$$('[data-vote]').forEach(b=>b.onclick=()=>withFeedback(b,act('vote',{post_id:b.closest('.post').id.slice(5),option_id:b.dataset.vote})));$$('[data-proposal-vote]').forEach(b=>b.onclick=()=>withFeedback(b,act('proposal_vote',{post_id:b.dataset.proposalId,vote:b.dataset.proposalVote})));$$('[data-proposal-status]').forEach(b=>b.onclick=()=>withFeedback(b,act('proposal_status',{post_id:b.dataset.proposalId,status:b.dataset.proposalStatus})));$$('[data-delete]').forEach(b=>b.onclick=async()=>{if(confirm('Ștergi definitiv această postare?'))await act('delete',{post_id:b.dataset.delete})});$$('[data-edit]').forEach(b=>b.onclick=()=>openEdit(b.dataset.edit))}
  async function withFeedback(button,promise){button.style.opacity='.55';button.style.pointerEvents='none';button.disabled=true;try{await promise}finally{button.style.opacity='';button.style.pointerEvents='';button.disabled=false}}
  const $$=s=>[...document.querySelectorAll(s)];async function act(action,payload){
    try{
        const result = await invoke({
            action,
            organization_id: organizationId,
            ...payload
        });

        if (action === 'create' && result?.discord_warning) {
            throw new Error(`Anunțul a fost salvat în panel, dar nu a ajuns în Discord: ${result.discord_warning}`);
        }

        await load();

    }catch(e){
        alert(e.message)
    }
}
  function configureAudienceChoices() {
    $$('[data-audience]').forEach((button) => {
      button.hidden = !writeAudiences.includes(button.dataset.audience)
        || Boolean(communityPageAudience && button.dataset.audience !== communityPageAudience);
    });
  }
  function option(value=''){const host=$('#poll-options');if(!host)return;const row=document.createElement('div');row.className='poll-option-row';row.innerHTML=`<input class="poll-input" maxlength="120" value="${esc(value)}" placeholder="Opțiune"><button type="button" class="text-action danger">×</button>`;row.querySelector('button').onclick=()=>row.remove();host.appendChild(row)}
  function openEdit(id){const p=posts.find(x=>String(x.id)===String(id));editing=p.id;$('#form-heading').textContent='Editează postarea';$('#post-type').value=p.post_type;$('#post-type').disabled=true;$('#post-title').value=p.title;$('#post-content').value=p.content;$('#poll-wrap').hidden=p.post_type!=='poll';if($('#poll-options')) $('#poll-options').innerHTML='';(p.community_poll_options||[]).sort((a,b)=>a.position-b.position).forEach(o=>option(o.option_text));$('#post-modal').hidden=false}
  function closePostComposer(){ $('#post-modal').hidden=true; $('#audience-modal').hidden=true; draft=null; editing=null; }
  function openAnnouncementComposer(type = 'announcement') {
    if (!canWriteAnnouncements) { alert('Nu ai permisiunea de a publica anunțuri sau sondaje.'); return; }
    editing = null;
    $('#post-form').reset();
    $('#post-type').disabled = false;
    $('#post-type').value = type;
    if ($('#poll-options')) $('#poll-options').innerHTML = '';
    $('#poll-wrap').hidden = type !== 'poll';
    if (type === 'poll') { option(); option(); }
    $('#post-modal').hidden = false;
  }
  window.communityAnnouncementsApi = {
    getPosts: () => posts.slice(),
    getAccess: () => ({ ...announcementAccess, audience: communityPageAudience || null, readAudiences: readAudiences.slice(), writeAudiences: writeAudiences.slice(), proposalReadAudiences: proposalReadAudiences.slice(), proposalWriteAudiences: proposalWriteAudiences.slice() }),
    renderCard: (post) => card(post),
    bindRenderedCards: (root = document) => bindCards.call(null, root),
    openComposer: openAnnouncementComposer,
    configureAudienceChoices
  };
 document.addEventListener('DOMContentLoaded', async () => {
    organizationReady = (async () => {
        if (typeof window.ensurePanelSession === 'function') await window.ensurePanelSession();
        organizationId = window.getActiveOrganizationId?.() || null;
        if (!organizationId) throw new Error('Nu există o organizație UUID activă pentru anunțuri.');
    })();
    try {
        await organizationReady;
    } catch (error) {
        console.error('Sesiunea organizației nu a putut fi validată:', error);
        requestFreshLogin();
        return;
    }
    $('[data-close]')?.addEventListener('click', closePostComposer);
    $('[data-back]')?.addEventListener('click', () => { $('#audience-modal').hidden=true; $('#post-modal').hidden=false; });


    const announcementAccess =
        await loadAnnouncementAccess();

    if (!announcementAccess.read) {
        return;
    }
    $('#create-button').onclick = () => {
      if (typeof window.openUnifiedCreate === 'function') return window.openUnifiedCreate();
      openAnnouncementComposer();
    };
$('#post-type').onchange=e=>{$('#poll-wrap').hidden=e.target.value!=='poll';if(e.target.value==='poll'&&!$('#poll-options').children.length){option();option()}};$('#add-option')?.addEventListener('click',()=>option());$('#post-form').onsubmit=e=>{e.preventDefault();const options=$$('.poll-input').map(x=>x.value.trim()).filter(Boolean);if($('#post-type').value==='poll'&&options.length<2)return alert('Adaugă minimum două opțiuni.');draft={post_type:$('#post-type').value,title:$('#post-title').value.trim(),content:$('#post-content').value.trim(),options};if(editing)return act('update',{post_id:editing,...draft}).then(()=>$('#post-modal').hidden=true);$('#post-modal').hidden=true;if(communityPageAudience){act('create',{...draft,audience:communityPageAudience});}else{configureAudienceChoices();$('#audience-modal').hidden=false}};$$('[data-audience]').forEach(b=>b.onclick=async()=>{b.disabled=true;try{await act('create',{...draft,audience:b.dataset.audience});$('#audience-modal').hidden=true}catch(e){alert(e.message)}finally{b.disabled=false}});$$('[data-filter]').forEach(b=>b.onclick=()=>{$$('[data-filter]').forEach(x=>x.classList.remove('active'));b.classList.add('active');filter=b.dataset.filter;render()});
    load();

    db
        .channel(`community-live-${organizationId}`)
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'community_posts',
                filter: `organization_id=eq.${organizationId}`
            },
            load
        )
        .subscribe();
        });
  document.head.insertAdjacentHTML('beforeend','<style>.poll-choice{display:grid;gap:6px}.poll-option{width:100%}.poll-voters{margin:0 4px 6px;color:#94a3b8;font-size:12px}.poll-voters summary{cursor:pointer;user-select:none}.poll-voters>div{display:flex;gap:6px;flex-wrap:wrap;padding:9px 0}.poll-voters span{padding:4px 8px;border:1px solid #334155;border-radius:999px;background:#0b1220;color:#cbd5e1}</style>');
document.addEventListener('DOMContentLoaded', async () => {
    try { await (organizationReady || Promise.resolve()); } catch (_) { return; }

    if (!organizationId) {
        return;
    }

    db
        .channel(`community-interactions-live-${organizationId}`)

        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'community_poll_votes',
                filter: `organization_id=eq.${organizationId}`
            },
            load
        )

        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'community_reactions',
                filter: `organization_id=eq.${organizationId}`
            },
            load
        )

        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'community_poll_options',
                filter: `organization_id=eq.${organizationId}`
            },
            load
        )

        .subscribe();
});
  document.addEventListener('DOMContentLoaded',()=>{const content=$('#post-content');content.required=false;content.placeholder='Conținut opțional';});
})();
