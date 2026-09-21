(() => {
  'use strict';
  const cfg = window.PANEL_SUPABASE_CONFIG || {};
  const page = location.pathname.split('/').pop() || 'index.html';
  const call = (body) => fetch(`${cfg.url}/functions/v1/manage-platform-sponsorships`, { method:'POST', headers:{'Content-Type':'application/json', apikey:cfg.publishableKey, Authorization:`Bearer ${cfg.publishableKey}`}, body:JSON.stringify(body)}).then(async r => { const d=await r.json().catch(()=>({})); if(!r.ok) throw Error(d.error||'Sponsorizarea nu a putut fi încărcată.'); return d; });
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const init = async () => {
    if (!cfg.url || !cfg.publishableKey || page === 'sponsorizari.html') return;
    try {
      const data = await call({ action:'active', page });
      (data.sponsorships || []).forEach((item) => {
        const box = document.createElement('aside');
        box.className = `panel-sponsorship panel-sponsorship-${item.size} panel-sponsorship-${item.placement}`;
        box.innerHTML = `<a href="${escapeHtml(item.target_url)}" target="_blank" rel="sponsored noopener" aria-label="${escapeHtml(item.title)}"><img src="${escapeHtml(item.image_url)}" alt="${escapeHtml(item.title)}" loading="lazy"><span>${escapeHtml(item.sponsor_name)}</span></a>`;
        box.querySelector('a').addEventListener('click', () => call({action:'track',id:item.id,metric:'click'}).catch(()=>{}));
        if (item.placement === 'sidebar') {
          let rail = document.getElementById('panel-sponsorship-rail');
          if (!rail) { rail = document.createElement('aside'); rail.id = 'panel-sponsorship-rail'; rail.setAttribute('aria-label','Zonă de publicitate'); rail.innerHTML = '<div class="panel-sponsorship-label">Zonă de publicitate</div>'; document.body.append(rail); document.body.classList.add('has-panel-sponsorship-rail'); }
          rail.append(box);
        }
        else {
          let stack = document.getElementById('panel-sponsorship-stack');
          if (!stack) { stack = document.createElement('section'); stack.id = 'panel-sponsorship-stack'; stack.setAttribute('aria-label','Zonă de publicitate'); stack.innerHTML = '<div class="panel-sponsorship-label">Zonă de publicitate</div>'; (document.getElementById('panel-global-footer') || document.body).before(stack); }
          stack.append(box);
        }
        call({action:'track',id:item.id,metric:'impression'}).catch(()=>{});
      });
    } catch (_) {}
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true}); else init();
})();
