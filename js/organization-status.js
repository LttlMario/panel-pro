(() => {
  if (!location.pathname.endsWith('administrare-organizatie.html')) return;
  const config = () => window.PANEL_SUPABASE_CONFIG;
  const load = async () => {
    const c = config(), token = localStorage.getItem('panel_session_token');
    const response = await fetch(`${c.url}/functions/v1/get-organization-status`, { headers: { apikey: c.publishableKey, Authorization: `Bearer ${c.publishableKey}`, 'x-panel-session': token } });
    const result = await response.json(); if (!response.ok) throw Error(result.error || 'Status indisponibil.');
    const org = result.organization, settings = result.settings || {}, access = settings.organization_access || {}, pack = settings.organization_package || {};
    document.getElementById('info').innerHTML = `<div class="rounded-xl bg-slate-950 p-4"><small>Organizație</small><b class="block mt-1">${org.name}</b></div><div class="rounded-xl bg-slate-950 p-4"><small>Status</small><b class="block mt-1">${org.lifecycle_status || (org.active ? 'active' : 'paused')}</b></div><div class="rounded-xl bg-slate-950 p-4"><small>Pachet</small><b class="block mt-1">${pack.code || 'standard'}</b></div><div class="rounded-xl bg-slate-950 p-4"><small>Expiră</small><b class="block mt-1">${access.expires_at ? new Date(access.expires_at).toLocaleString('ro-RO') : 'Nelimitat'}</b></div>`;
    if (org.lifecycle_status === 'draft' && !document.getElementById('finalize-organization')) {
      const button = document.createElement('button'); button.id = 'finalize-organization'; button.className = 'mt-5 rounded-xl bg-indigo-700 px-4 py-3 font-bold'; button.textContent = 'Activează organizația Draft';
      document.querySelector('main section')?.appendChild(button);
      button.onclick = async () => { button.disabled = true; const r = await fetch(`${c.url}/functions/v1/finalize-organization`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: c.publishableKey, 'x-panel-session': token }, body: JSON.stringify({ organization_id: org.id }) }); const j = await r.json(); document.getElementById('status').textContent = r.ok ? 'Organizația a fost activată.' : (j.error || 'Activarea a eșuat.'); if (r.ok) load(); button.disabled = false; };
    }
  };
  load().catch(error => { const status = document.getElementById('status'); if (status) status.textContent = error.message; });
})();
