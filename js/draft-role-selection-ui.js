(() => {
  if (!location.pathname.endsWith('creare-organizatie-voucher.html')) return;
  const waitForBox = (fn) => {
    const run = () => { const box = document.getElementById('draft-config'); if (box) fn(box); else setTimeout(run, 200); };
    run();
  };
  waitForBox((box) => {
    if (box.dataset.roleSaveReady) return;
    box.dataset.roleSaveReady = 'true';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'rounded-xl bg-emerald-700 px-5 py-3 font-bold';
    button.textContent = 'Salvează rolurile selectate';
    box.querySelector('div').append(button);
    button.addEventListener('click', async () => {
      const roles = [...box.querySelectorAll('[data-draft-role]:checked')].map((checkbox) => ({
        id: checkbox.dataset.draftRole,
        name: checkbox.dataset.roleName,
        panel_role: checkbox.dataset.roleName
      }));
      const status = document.getElementById('draft-config-status');
      if (!roles.length) { status.textContent = 'Selectează cel puțin un rol.'; return; }
      if (!window.draftOrganizationId) { status.textContent = 'Organizația Draft nu a fost creată încă.'; return; }
      button.disabled = true;
      try {
        const config = window.PANEL_SUPABASE_CONFIG;
        const response = await fetch(`${config.url}/functions/v1/save-draft-roles`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', apikey: config.publishableKey, Authorization: `Bearer ${config.publishableKey}` },
          body: JSON.stringify({
            access_token: localStorage.getItem('discord_access_token'),
            voucher_code: document.getElementById('voucher')?.value.trim(),
            guild_id: document.getElementById('guild')?.value.trim(),
            organization_id: window.draftOrganizationId,
            roles
          })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Salvarea a eșuat.');
        if (window.saveDraftConfiguration) await window.saveDraftConfiguration({ silent: true });
        status.textContent = `Au fost salvate ${result.count} roluri și configurația curentă.`;
      } catch (error) { status.textContent = error.message; }
      button.disabled = false;
    });
  });
})();
