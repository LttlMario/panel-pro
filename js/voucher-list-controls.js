(() => {
  const host = document.querySelector('main section');
  if (!host || document.getElementById('voucher-list')) return;
  const escapeHtml = window.panelEscapeHtml || ((value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character])));
  const box = document.createElement('div');
  box.id = 'voucher-list';
  box.className = 'mt-6 border-t border-slate-700 pt-5';
  box.innerHTML = '<h2 class="text-lg font-black">Vouchere generate</h2><div class="mt-3 overflow-auto"><table class="w-full text-left text-xs"><thead><tr class="border-b border-slate-800 text-slate-400"><th class="p-2">Cod</th><th class="p-2">Pachet</th><th class="p-2">Guild ID</th><th class="p-2">Expiră</th><th class="p-2">Status</th><th class="p-2">Acțiune</th></tr></thead><tbody id="voucher-rows"></tbody></table></div>';
  host.appendChild(box);

  const load = async () => {
    const config = window.PANEL_SUPABASE_CONFIG;
    const token = localStorage.getItem('panel_session_token');
    const response = await fetch(`${config.url}/functions/v1/manage-organizations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: config.publishableKey, Authorization: `Bearer ${config.publishableKey}`, 'x-panel-session': token },
      body: JSON.stringify({ action: 'list_vouchers' })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw Error(payload.error || 'Lista nu poate fi încărcată.');
    const rows = (payload.vouchers || []).map((voucher) => {
      const row = document.createElement('tr');
      row.className = 'border-b border-slate-800';
      const expired = voucher.expires_at && Date.parse(voucher.expires_at) <= Date.now();
      const status = voucher.revoked_at ? 'Revocat' : voucher.redeemed_at ? 'Folosit' : expired ? 'Expirat' : 'Activ';
      const expires = voucher.expires_at ? new Date(voucher.expires_at).toLocaleDateString('ro-RO') : '—';
      row.innerHTML = `<td class="p-2 font-mono">${escapeHtml(voucher.code)}</td><td class="p-2">${escapeHtml(voucher.package_code)}</td><td class="p-2">${escapeHtml(voucher.guild_id || 'Orice server')}</td><td class="p-2">${escapeHtml(expires)}</td><td class="p-2">${status}</td><td class="p-2">${!voucher.redeemed_at && !voucher.revoked_at ? `<button data-revoke="${escapeHtml(voucher.id)}" class="rounded bg-red-900 px-2 py-1">Revocă</button>` : '—'}</td>`;
      return row;
    });
    const body = document.getElementById('voucher-rows');
    if (!body) return;
    body.replaceChildren(...(rows.length ? rows : [Object.assign(document.createElement('tr'), { innerHTML: '<td colspan="6" class="p-3 text-slate-400">Nu există vouchere.</td>' })]));
    body.querySelectorAll('[data-revoke]').forEach((button) => button.addEventListener('click', async () => {
      if (!window.confirm('Revoci voucherul?')) return;
      await fetch(`${config.url}/functions/v1/manage-organizations`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', apikey: config.publishableKey, Authorization: `Bearer ${config.publishableKey}`, 'x-panel-session': token },
        body: JSON.stringify({ action: 'revoke_voucher', voucher_id: button.dataset.revoke })
      });
      await load();
    }));
  };
  load().catch((error) => {
    const body = document.getElementById('voucher-rows');
    if (body) body.replaceChildren(Object.assign(document.createElement('tr'), { innerHTML: `<td colspan="6" class="p-3 text-red-300">${escapeHtml(error.message)}</td>` }));
  });
})();
