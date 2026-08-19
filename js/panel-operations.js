(() => {
  'use strict';
  if (window.__panelOperationsLoaded) return;
  window.__panelOperationsLoaded = true;

  const SESSION_MAX_AGE = 12 * 60 * 60 * 1000;
  const config = window.PANEL_SUPABASE_CONFIG || {};
  const user = (() => { try { return JSON.parse(localStorage.getItem('discord_user') || 'null'); } catch (_) { return null; } })();
  const client = () => window.supabaseClient || null;
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  async function invoke(action, payload = {}) {
    const accessToken=window.getPanelDiscordAccessToken?.() || '';
    if(!accessToken) throw new Error('Sesiunea Discord lipsește. Autentifică-te din nou.');
    const sessionToken=await window.ensurePanelSession();
    const response=await fetch(`${config.url}/functions/v1/manage-admin-center`,{method:'POST',headers:{'Content-Type':'application/json',apikey:config.publishableKey,Authorization:`Bearer ${config.publishableKey}`,'x-panel-session':sessionToken||''},body:JSON.stringify({action,access_token:accessToken,...payload})});
    const data=await response.json().catch(()=>({})); if(!response.ok) throw new Error(data.error||`HTTP ${response.status}`); return data;
  }
  window.panelAdminInvoke = invoke;

  function enforceSession() {
    if (!user || location.pathname.endsWith('/login.html')) return;
    const expiresAt = new Date(localStorage.getItem('panel_session_expires_at') || 0).getTime();
    if (localStorage.getItem('panel_session_token') && expiresAt > Date.now()) return;
    localStorage.removeItem('discord_user');
    localStorage.removeItem('panel_session_token');
    localStorage.removeItem('panel_session_expires_at');
    localStorage.removeItem('panel_active_organization');
    localStorage.removeItem('panel_organizations');
    alert('Sesiunea a expirat. Autentifică-te din nou pentru siguranță.');
    location.replace('login.html');
  }

  window.panelAudit = async (action, targetType = null, targetId = null, details = {}) => {
    if (!user) return;
    try { await invoke('audit',{event:action,target_type:targetType,target_id:targetId,details}); } catch(error) { console.warn('Jurnalul administrativ nu este disponibil.',error.message); }
  };

  function makeTablesMobileFriendly() {
    document.querySelectorAll('table').forEach(table => {
      if (table.parentElement?.classList.contains('panel-table-scroll')) return;
      const wrapper = document.createElement('div');
      wrapper.className = 'panel-table-scroll';
      table.parentNode.insertBefore(wrapper, table);
      wrapper.appendChild(table);
    });
  }

  async function setupNotifications() {
    if (!user || document.getElementById('panel-notification-button')) return;
    const button = document.createElement('button');
    button.id = 'panel-notification-button'; button.type = 'button'; button.className = 'panel-notification-button';
    button.innerHTML = '<span aria-hidden="true">🔔</span><b hidden>0</b>'; button.setAttribute('aria-label', 'Centrul de notificări');
    const drawer = document.createElement('section'); drawer.id = 'panel-notification-drawer'; drawer.hidden = true;
    drawer.innerHTML = '<header><strong>Notificări</strong><button type="button" aria-label="Închide">×</button></header><div class="panel-notification-list"><p>Se încarcă…</p></div>';
    document.body.append(button, drawer);
    let loading = false;
    async function load() {
      if (loading) return;
      loading = true;
      try {
        const result=await invoke('notifications');
        const notes=result.notifications||[], readIds = new Set((result.read_ids || []).map(x => String(x)));
        const active = notes.filter(n => !n.expires_at || new Date(n.expires_at) > new Date());
        const unread = active.filter(n => !readIds.has(String(n.id)));
        const badge = button.querySelector('b'); badge.textContent = unread.length; badge.hidden = !unread.length;
        drawer.querySelector('.panel-notification-list').innerHTML = active.length ? active.map(n => { const link = window.panelSafeLink?.(n.link); return `<article class="${readIds.has(String(n.id))?'':'unread'} level-${escapeHtml(n.level || 'info')}"><div><strong>${escapeHtml(n.title)}</strong><time>${new Date(n.created_at).toLocaleString('ro-RO')}</time></div><p>${escapeHtml(n.message)}</p>${link?`<a href="${escapeHtml(link)}">Deschide</a>`:''}</article>`; }).join('') : '<p class="panel-empty">Nu există notificări.</p>';
        if (unread.length && !drawer.hidden) await invoke('mark_read',{ids:unread.map(n=>n.id)});
      } catch(error) {
        drawer.querySelector('.panel-notification-list').innerHTML=`<p class="panel-empty">${escapeHtml(error.message)}</p>`;
      } finally {
        loading = false;
      }
    }
    button.onclick = async () => { drawer.hidden = !drawer.hidden; if (!drawer.hidden) await load(); };
    drawer.querySelector('header button').onclick = () => { drawer.hidden = true; };
    await load();
    window.addEventListener('focus', () => load());
    window.setInterval(() => { if (document.visibilityState !== 'hidden') load(); }, 30000);
  }

  function setupAdminBackup() {
    if (!location.pathname.endsWith('/admin.html') && !location.pathname.endsWith('admin.html')) return;
    const host = document.querySelector('main .space-y-6'); if (!host || document.getElementById('admin-backup-center')) return;
    const panel = document.createElement('section'); panel.id = 'admin-backup-center'; panel.className = 'bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg';
    panel.innerHTML = '<h3 class="text-base font-bold">Backup / import configurare</h3><p class="text-xs text-slate-400 mt-1">Exportă setările locale și programul de pontaj într-un fișier JSON sau importă un backup valid.</p><div class="flex flex-wrap gap-3 mt-4"><button id="panel-export-settings" class="panel-action">Descarcă backup</button><label class="panel-action">Importă backup<input id="panel-import-settings" type="file" accept="application/json" hidden></label></div><hr class="my-5 border-slate-800"><h3 class="text-base font-bold">Trimite notificare în panel</h3><div class="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3"><input id="panel-note-title" maxlength="120" placeholder="Titlu" class="panel-field"><select id="panel-note-level" class="panel-field"><option value="info">Informare</option><option value="success">Succes</option><option value="warning">Avertisment</option><option value="error">Urgent</option></select><textarea id="panel-note-message" maxlength="1000" placeholder="Mesajul notificării" class="panel-field md:col-span-2"></textarea><input id="panel-note-recipient" placeholder="Discord ID (gol = toată lumea)" class="panel-field"><button id="panel-send-note" class="panel-action">Publică notificarea</button></div>';
    host.appendChild(panel);
    panel.querySelector('#panel-export-settings').onclick = () => {
      const payload = {schemaVersion:1, exportedAt:new Date().toISOString(), settings:JSON.parse(localStorage.getItem('workforce_admin_settings') || '{}')};
      const blob = new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`panel-config-${new Date().toISOString().slice(0,10)}.json`; a.click(); URL.revokeObjectURL(a.href); panelAudit('config_export','app_settings');
    };
    panel.querySelector('#panel-import-settings').onchange = async event => {
      const file=event.target.files?.[0]; if(!file)return;
      try { const parsed=JSON.parse(await file.text()); if(parsed.schemaVersion!==1 || !parsed.settings?.pontajConfig) throw new Error('Format incompatibil'); await invoke('import_config',{value:parsed.settings.pontajConfig}); localStorage.setItem('workforce_admin_settings',JSON.stringify(parsed.settings)); alert('Backup importat. Pagina se reîncarcă.'); location.reload(); } catch(error){ alert(`Import respins: ${error.message}`); }
    };
    panel.querySelector('#panel-send-note').onclick = async () => {
      const title=panel.querySelector('#panel-note-title').value.trim(), message=panel.querySelector('#panel-note-message').value.trim(), recipient=panel.querySelector('#panel-note-recipient').value.trim(), level=panel.querySelector('#panel-note-level').value;
      if(!title || !message) return alert('Completează titlul și mesajul.');
      try { await invoke('create_notification',{title,message,level,recipient}); } catch(error) { return alert(`Notificarea nu a putut fi publicată: ${error.message}`); }
      panel.querySelector('#panel-note-title').value=''; panel.querySelector('#panel-note-message').value=''; panel.querySelector('#panel-note-recipient').value=''; alert('Notificarea a fost publicată.');
    };
  }

  function setupReportTools() {
    if (!location.pathname.endsWith('/rapoarte.html') && !location.pathname.endsWith('rapoarte.html')) return;
    const exportButton=[...document.querySelectorAll('button')].find(button=>/CSV/i.test(button.textContent||''));
    if(!exportButton || document.getElementById('panel-print-report')) return;
    const print=document.createElement('button'); print.id='panel-print-report'; print.type='button'; print.className=exportButton.className; print.innerHTML='<span>🖨️</span><span>Tipărește / PDF</span>'; print.onclick=()=>window.print(); exportButton.parentElement?.appendChild(print);
    const printStyle=document.createElement('style'); printStyle.textContent='@media print{aside,header,footer,button,#panel-notification-button,#panel-notification-drawer{display:none!important}main{display:block!important;overflow:visible!important}.panel-table-scroll{overflow:visible!important}table{min-width:0!important;font-size:10px!important}body{background:white!important;color:black!important}}'; document.head.appendChild(printStyle);
  }

  const style = document.createElement('style'); style.textContent = `
    .panel-table-scroll{max-width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch}.panel-field{width:100%;padding:10px 12px;border:1px solid #334155;border-radius:12px;background:#020617;color:#e2e8f0;font-size:12px}.panel-notification-button{position:fixed;right:20px;top:76px;z-index:3900;width:44px;height:44px;border:1px solid #334155;border-radius:14px;background:#0f172a;color:#fff;box-shadow:0 10px 30px #02061788;transition:transform .18s ease,box-shadow .18s ease}.panel-notification-button:hover{transform:translateY(-2px);box-shadow:0 14px 34px #020617cc}.panel-notification-button b{position:absolute;right:-5px;top:-5px;min-width:19px;padding:2px 5px;border-radius:999px;background:#ef4444;font-size:10px}#panel-notification-drawer{position:fixed;right:18px;top:128px;z-index:3900;width:min(390px,calc(100vw - 24px));max-height:65vh;overflow:auto;border:1px solid #334155;border-radius:18px;background:#0f172a;color:#e2e8f0;box-shadow:0 22px 60px #020617cc}#panel-notification-drawer header{position:sticky;top:0;display:flex;justify-content:space-between;padding:14px 16px;background:#111827;border-bottom:1px solid #334155}#panel-notification-drawer header button{font-size:22px}.panel-notification-list article{padding:13px 16px;border-bottom:1px solid #1e293b}.panel-notification-list article.unread{background:#064e3b33}.panel-notification-list article.level-warning{border-left:3px solid #f59e0b}.panel-notification-list article.level-error{border-left:3px solid #ef4444}.panel-notification-list article.level-success{border-left:3px solid #10b981}.panel-notification-list article div{display:flex;justify-content:space-between;gap:12px}.panel-notification-list time{font-size:10px;color:#64748b}.panel-notification-list p{margin-top:5px;font-size:12px;color:#94a3b8}.panel-notification-list a{display:inline-block;margin-top:7px;color:#34d399;font-size:12px}.panel-empty{padding:24px;text-align:center}.panel-action{display:inline-flex;align-items:center;padding:10px 14px;border-radius:12px;background:#1e293b;color:#e2e8f0;font-size:12px;font-weight:700;cursor:pointer}@media(max-width:640px){.panel-notification-button{right:12px;top:auto;bottom:84px}#panel-notification-drawer{right:12px;top:auto;bottom:136px;max-height:58vh}main{min-width:0}table{min-width:680px}.p-8{padding:1rem!important}}
  `; document.head.appendChild(style);

  enforceSession();
  const start = () => { makeTablesMobileFriendly(); setupNotifications(); setupAdminBackup(); setupReportTools(); };
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', start, {once:true}) : start();
})();
