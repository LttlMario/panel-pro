(() => {
  if (!location.pathname.endsWith('creare-organizatie-voucher.html')) return;
  const waitForBox = (fn) => {
    const run = () => { const box = document.getElementById('draft-config'); if (box) fn(box); else setTimeout(run, 200); };
    run();
  };
  waitForBox((box) => {
    if (box.dataset.roleDiscoveryReady) return;
    box.dataset.roleDiscoveryReady = 'true';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'rounded-xl bg-cyan-700 px-5 py-3 font-bold';
    button.textContent = 'Verifică serverul și citește rolurile';
    const output = document.createElement('div');
    output.className = 'mt-3 space-y-2 text-sm';
    box.querySelector('div').append(button, output);
    button.addEventListener('click', async () => {
      button.disabled = true;
      output.textContent = 'Se verifică serverul...';
      try {
        const config = window.PANEL_SUPABASE_CONFIG;
        const response = await fetch(`${config.url}/functions/v1/discover-draft-roles`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', apikey: config.publishableKey, Authorization: `Bearer ${config.publishableKey}` },
          body: JSON.stringify({
            access_token: localStorage.getItem('discord_access_token'),
            voucher_code: document.getElementById('voucher')?.value.trim(),
            guild_id: document.getElementById('guild')?.value.trim()
          })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Nu s-au putut citi rolurile.');
        output.innerHTML = (result.roles || []).map((role) => `<label class="flex items-center gap-2 rounded-lg border border-slate-700 p-2"><input type="checkbox" data-draft-role="${role.id}" data-role-name="${role.name.replace(/"/g, '&quot;')}"><span class="min-w-36">${role.name}</span></label>`).join('') || 'Nu există roluri disponibile.';
        window.draftAvailableRoles = result.roles || [];
        if (window.renderDraftPagePermissions) window.renderDraftPagePermissions(window.draftAvailableRoles);
        window.dispatchEvent(new CustomEvent('draft-roles-discovered'));
      } catch (error) { output.textContent = error.message; }
      button.disabled = false;
    });
  });
})();
