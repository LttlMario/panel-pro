(() => {
  const isFinesPage = false;
  const URL=window.PANEL_SUPABASE_CONFIG.url;
  const KEY=window.PANEL_SUPABASE_CONFIG.publishableKey;
  const db = window.createPanelSupabaseClient();
  const user = window.getUser?.() || {};
  let posts=[], filter='all', editing=null, draft=null;
  let canWriteAnnouncements = false;
  let isPlatformAdmin = false;
  let readAudiences = ['organization', 'departments'];
  let writeAudiences = ['organization', 'departments'];
  let organizationId = null;
  let organizationReady = null;
  const $=s=>document.querySelector(s), esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const invoke=async(body)=>{const token=window.getPanelDiscordAccessToken?.()||'',panelSession=localStorage.getItem('panel_session_token')||'';if(!panelSession){requestFreshLogin();throw new Error('Sesiunea securizată a panelului lipsește. Autentifică-te din nou.')}const res=await fetch(`${URL}/functions/v1/manage-community-posts`,{method:'POST',headers:{'Content-Type':'application/json',apikey:KEY,Authorization:`Bearer ${KEY}`,'x-panel-session':panelSession},body:JSON.stringify({...body,...(token?{access_token:token}:{})})});let json={};try{json=await res.json()}catch{json={}}if(res.status===401){requestFreshLogin();throw new Error('Sesiunea panelului a expirat. Autentifică-te din nou.')}if(!res.ok){
    console.error("EDGE ERROR RESPONSE:", json);
    throw new Error(
        json.error ||
        json.message ||
        JSON.stringify(json) ||
        `Operația a eșuat. Cod HTTP: ${res.status}`
    );
}return json};
  function requestFreshLogin(){sessionStorage.setItem('panel_return_after_login',location.href);setTimeout(()=>{location.href='login.html?v=20260819-session-return-fix'},700)}
  async function loadAnnouncementAccess() {
      try {
          const access = await invoke({ action: 'announcement_access', section: isFinesPage ? 'fines' : 'announcements' });

          const canRead = access?.read === true;
          const canWrite = access?.write === true;

          canWriteAnnouncements = canWrite;
          isPlatformAdmin = access?.platform_admin === true;
          readAudiences = Array.isArray(access?.read_audiences) ? access.read_audiences : (canRead ? ['organization', 'departments'] : []);
          writeAudiences = Array.isArray(access?.write_audiences) ? access.write_audiences : (canWrite ? ['organization', 'departments'] : []);

          if (!canRead) {
              $('#feed').innerHTML = `
                  <div class="empty">
                      Nu ai permisiunea de a accesa Anunțuri & Sondaje.
                  </div>
              `;

            canWriteAnnouncements = false;
            $('#create-button').hidden = true;

            return {
                read: false,
                write: false
            };
          }

          $('#create-button').hidden = !canWrite;

          return {
              read: true,
              write: canWrite
          };

      } catch (error) {
          console.error(
              'Nu pot verifica permisiunile pentru Anunțuri:',
              error
          );
        canWriteAnnouncements = false;
        $('#create-button').hidden = true;

        return {
            read: false,
            write: false
        };
      }
  }

async function load() {
    if (!organizationId) {
        console.error('Nu există organization_id activ.');

        $('#feed').innerHTML = `
            <div class="empty">
                Nu a fost identificată organizația activă.
            </div>
        `;

        return;
    }

    // Audiența este filtrată în query, înainte ca datele să ajungă în browser.
    // Filtrarea doar în render ar permite unui utilizator să descarce datele celeilalte audiențe.
    const postResult = await db
        .from('community_posts')
        .select('*')
        .eq('organization_id', organizationId)
        .in('audience', readAudiences)
        .order('created_at', { ascending: false });

    const postIds = (postResult.data || []).map(post => post.id).filter(Boolean);
    const [optionResult, reactionResult, voteResult, memberResult] = await Promise.all([
        postIds.length ? db.from('community_poll_options').select('*').eq('organization_id', organizationId).in('post_id', postIds) : Promise.resolve({ data: [], error: null }),
        postIds.length ? db.from('community_reactions').select('*').eq('organization_id', organizationId).in('post_id', postIds) : Promise.resolve({ data: [], error: null }),
        postIds.length ? db.from('community_poll_votes').select('*').eq('organization_id', organizationId).in('post_id', postIds) : Promise.resolve({ data: [], error: null }),
        db.from('organization_members').select('discord_id').eq('organization_id', organizationId).eq('active', true)
    ]);

    const memberIds = [...new Set((memberResult.data || [])
        .map(member => String(member.discord_id || '').trim())
        .filter(Boolean))];
    const userResult = memberResult.error || !memberIds.length
        ? { data: [], error: memberResult.error || null }
        : await db.from('users').select('discord_id,display_name,username').in('discord_id', memberIds);

    const error =
        postResult.error ||
        optionResult.error ||
        reactionResult.error ||
        voteResult.error ||
        memberResult.error ||
        userResult.error;

    if (error) {
        console.error('Eroare încărcare anunțuri:', error);

        $('#feed').innerHTML = `
            <div class="empty">
                Nu pot citi datele din Supabase:
                ${esc(error.message || error.code || 'eroare necunoscută')}
            </div>
        `;

        return;
    }

    const voters = userResult.data || [];

        posts = (postResult.data || [])
            .filter(Boolean)
            .filter(post => readAudiences.includes(post.audience))
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

        community_voters: voters
    }));

    render();

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
}  function render(){const visible=posts
.filter(Boolean)
.filter(p =>
    filter==='all' ||
    p.audience===filter ||
    (filter==='fine' && p.post_type==='fine') ||
    (filter==='poll' && p.post_type==='poll')
);$('#feed').innerHTML=visible.length?visible.map(card).join(''):'<div class="empty">Nu există postări în această categorie.</div>';document.querySelectorAll('.post').forEach(node=>{const id=node.id.slice(5),post=posts.find(item=>String(item.id)===id);if(post?.post_type==='fine'){const badges=node.querySelectorAll('.badge');if(badges[1])badges[1].textContent='Amendă';}});bindCards()}
  function card(p){
      const own =
          String(p.author_discord_id) ===
          String(user.discord_id || user.id);

      const manage =
          isPlatformAdmin ||
          (writeAudiences.includes(p.audience) && own);

      const reactions = ['✅','👍','❤️','🤔'];
    const totals=Object.fromEntries(reactions.map(r=>[r,p.community_reactions.filter(x=>x.reaction===r).length]));const mine=new Set(p.community_reactions.filter(x=>String(x.user_discord_id)===String(user.discord_id||user.id)).map(x=>x.reaction));const votes=p.community_poll_votes||[],myVote=votes.find(v=>String(v.user_discord_id)===String(user.discord_id||user.id)),people=p.community_voters||[];const poll=p.post_type==='poll'?`<div class="poll">${(p.community_poll_options||[]).sort((a,b)=>a.position-b.position).map(o=>{const optionVotes=votes.filter(v=>v.option_id===o.id),pc=votes.length?Math.round(optionVotes.length*100/votes.length):0,names=optionVotes.map(v=>{const person=people.find(x=>String(x.discord_id)===String(v.user_discord_id));return esc(person?.display_name||person?.username||v.user_discord_id)});return `<div class="poll-choice"><button class="poll-option" data-vote="${o.id}"><span class="poll-bar" style="width:${pc}%"></span><span class="poll-content"><span>${esc(o.option_text)}${myVote?.option_id===o.id?' ✓':''}</span><b>${pc}% · ${optionVotes.length}</b></span></button><details class="poll-voters"><summary>👥 Vezi cine a votat (${optionVotes.length})</summary><div>${names.length?names.map(n=>`<span>${n}</span>`).join(''):'<em>Nu a votat nimeni.</em>'}</div></details></div>`}).join('')}</div>`:'';return `<article id="post-${p.id}" class="post"><div class="community-head"><div class="badges"><span class="badge ${p.audience}">${p.audience==='organization'?'Organizație':'Birouri / Angajați'}</span><span class="badge">${p.post_type==='poll'?'Sondaj':p.post_type==='question'?'Întrebare':'Anunț'}</span></div></div><h3>${esc(p.title)}</h3><div class="post-body">${esc(p.content)}</div>${poll}<div class="meta">${esc(p.author_name)} · ${new Date(p.created_at).toLocaleString('ro-RO')}</div><div class="community-actions"><div class="reactions">${reactions.map(r=>`<button class="reaction ${mine.has(r)?'selected':''}" data-react="${r}">${r} ${totals[r]}</button>`).join('')}</div>${manage?`<div class="owner-actions"><button class="text-action" data-edit="${p.id}">Editează</button><button class="text-action danger" data-delete="${p.id}">Șterge</button></div>`:''}</div></article>`}
  function bindCards(){$$('[data-react]').forEach(b=>b.onclick=()=>withFeedback(b,act('react',{post_id:b.closest('.post').id.slice(5),reaction:b.dataset.react})));$$('[data-vote]').forEach(b=>b.onclick=()=>withFeedback(b,act('vote',{post_id:b.closest('.post').id.slice(5),option_id:b.dataset.vote})));$$('[data-delete]').forEach(b=>b.onclick=async()=>{if(confirm('Ștergi definitiv această postare?'))await act('delete',{post_id:b.dataset.delete})});$$('[data-edit]').forEach(b=>b.onclick=()=>openEdit(b.dataset.edit))}
  async function withFeedback(button,promise){button.style.opacity='.55';button.style.pointerEvents='none';button.disabled=true;try{await promise}finally{button.style.opacity='';button.style.pointerEvents='';button.disabled=false}}
  const $$=s=>[...document.querySelectorAll(s)];async function act(action,payload){
    try{
        await invoke({
            action,
            organization_id: organizationId,
            ...payload
        });

        await load();

    }catch(e){
        alert(e.message)
    }
}
  function option(value=''){const row=document.createElement('div');row.className='poll-option-row';row.innerHTML=`<input class="poll-input" maxlength="120" value="${esc(value)}" placeholder="Opțiune"><button type="button" class="text-action danger">×</button>`;row.querySelector('button').onclick=()=>row.remove();$('#poll-options').appendChild(row)}
  function openEdit(id){const p=posts.find(x=>String(x.id)===String(id));editing=p.id;$('#form-heading').textContent='Editează postarea';$('#post-type').value=p.post_type;$('#post-type').disabled=true;$('#post-title').value=p.title;$('#post-content').value=p.content;$('#poll-wrap').hidden=p.post_type!=='poll';$('#poll-options').innerHTML='';(p.community_poll_options||[]).sort((a,b)=>a.position-b.position).forEach(o=>option(o.option_text));$('#post-modal').hidden=false}
 function closePostComposer(){ $('#post-modal').hidden=true; $('#audience-modal').hidden=true; draft=null; editing=null; }
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

    if (!canWriteAnnouncements) {
        alert('Nu ai permisiunea de a publica anunțuri sau sondaje.');
        return;
    }

    editing = null;

    $('#post-form').reset();
    $('#post-type').disabled = false;
    $('#poll-options').innerHTML = '';
    $('#poll-wrap').hidden = true;

    $('#post-modal').hidden = false;
};
$('#post-type').onchange=e=>{$('#poll-wrap').hidden=e.target.value!=='poll';if(e.target.value==='poll'&&!$('#poll-options').children.length){option();option()}};$('#add-option').onclick=()=>option();$('#post-form').onsubmit=e=>{e.preventDefault();const options=$$('.poll-input').map(x=>x.value.trim()).filter(Boolean);if($('#post-type').value==='poll'&&options.length<2)return alert('Adaugă minimum două opțiuni.');draft={post_type:$('#post-type').value,title:$('#post-title').value.trim(),content:$('#post-content').value.trim(),options};if(editing)return act('update',{post_id:editing,...draft}).then(()=>$('#post-modal').hidden=true);$('#post-modal').hidden=true;$('#audience-modal').hidden=false};$$('[data-audience]').forEach(b=>b.onclick=async()=>{b.disabled=true;try{await act('create',{...draft,audience:b.dataset.audience});$('#audience-modal').hidden=true}catch(e){alert(e.message)}finally{b.disabled=false}});$$('[data-filter]').forEach(b=>b.onclick=()=>{$$('[data-filter]').forEach(x=>x.classList.remove('active'));b.classList.add('active');filter=b.dataset.filter;render()});
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
