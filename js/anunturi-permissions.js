(() => {
  const config = window.PANEL_SUPABASE_CONFIG;
  if (!config || !location.pathname.endsWith('anunturi.html')) return;
  document.addEventListener('DOMContentLoaded', async () => {
    try {
      const response = await fetch(`${config.url}/functions/v1/manage-community-posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: config.publishableKey, Authorization: `Bearer ${config.publishableKey}`, 'x-panel-session': localStorage.getItem('panel_session_token') || '' },
        body: JSON.stringify({ action: 'announcement_access' })
      });
      const access = await response.json();
      if (!response.ok || access.read === false) {
        const shell = document.querySelector('.community-shell') || document.querySelector('main');
        if (shell) shell.innerHTML = '<div class="rounded-2xl border border-amber-700/50 bg-amber-950/20 p-6 text-sm text-amber-200">Gradul tău nu are drept de citire pentru Anunțuri.</div>';
        return;
      }
      if (access.write === false) document.getElementById('create-button')?.remove();
    } catch (error) { console.error('Permisiuni Anunțuri:', error); }
  }, { once: true });
})();
