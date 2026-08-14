(() => {
  if (!location.pathname.endsWith('administrare-organizatie.html')) return;
  const config = () => window.PANEL_SUPABASE_CONFIG;

  const renderInfo = (organization, settings) => {
    const host = document.getElementById('info');
    if (!host) return;
    const access = settings.organization_access || {};
    const pack = settings.organization_package || {};
    const rows = [
      ['Organizație', organization.name || '—'],
      ['Status', organization.lifecycle_status || (organization.active ? 'active' : 'paused')],
      ['Pachet', pack.code || 'standard'],
      ['Expiră', access.expires_at ? new Date(access.expires_at).toLocaleString('ro-RO') : 'Nelimitat']
    ];
    host.replaceChildren(...rows.map(([label, value]) => {
      const card = document.createElement('div');
      card.className = 'rounded-xl bg-slate-950 p-4';
      const title = document.createElement('small');
      title.textContent = label;
      const content = document.createElement('b');
      content.className = 'block mt-1';
      content.textContent = String(value);
      card.append(title, content);
      return card;
    }));
  };

  const load = async () => {
    if (!document.getElementById('info')) return;
    const c = config();
    const token = localStorage.getItem('panel_session_token');
    const response = await fetch(`${c.url}/functions/v1/get-organization-status`, {
      headers: { apikey: c.publishableKey, Authorization: `Bearer ${c.publishableKey}`, 'x-panel-session': token }
    });
    const result = await response.json();
    if (!response.ok) throw Error(result.error || 'Status indisponibil.');
    const organization = result.organization || {};
    renderInfo(organization, result.settings || {});
    if (organization.lifecycle_status === 'draft' && !document.getElementById('finalize-organization')) {
      const button = document.createElement('button');
      button.id = 'finalize-organization';
      button.className = 'mt-5 rounded-xl bg-indigo-700 px-4 py-3 font-bold';
      button.textContent = 'Activează organizația Draft';
      document.querySelector('main section')?.appendChild(button);
      button.onclick = async () => {
        button.disabled = true;
        const finalize = await fetch(`${c.url}/functions/v1/finalize-organization`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: c.publishableKey, 'x-panel-session': token },
          body: JSON.stringify({ organization_id: organization.id })
        });
        const payload = await finalize.json().catch(() => ({}));
        const status = document.getElementById('status');
        if (status) status.textContent = finalize.ok ? 'Organizația a fost activată.' : (payload.error || 'Activarea a eșuat.');
        if (finalize.ok) await load();
        button.disabled = false;
      };
    }
  };

  load().catch(error => {
    const status = document.getElementById('status');
    if (status) status.textContent = error.message || 'Datele nu au putut fi încărcate.';
  });
})();
