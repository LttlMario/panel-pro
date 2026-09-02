(() => {
  'use strict';
  if (!location.pathname.endsWith('status-live.html')) return;

  const key = 'status_live_message_ids';
  let messageIds = {};
  try { messageIds = JSON.parse(localStorage.getItem(key) || '{}'); } catch (_) { messageIds = {}; }

  async function syncLiveEmbed() {
    const config = window.PANEL_SUPABASE_CONFIG;
    const organizationId = (typeof activeOrganizationId !== 'undefined' ? activeOrganizationId : null) || window.getActiveOrganizationId?.();
    if (!config || !organizationId) return;
    const response = await fetch(`${config.url}/functions/v1/status-live-sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: config.publishableKey, Authorization: `Bearer ${config.publishableKey}`, 'x-panel-session': localStorage.getItem('panel_session_token') || '' },
      body: JSON.stringify({ organization_id: organizationId, message_ids: messageIds })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Sincronizarea Status Live a eșuat.');
    messageIds = data.message_ids || messageIds;
    localStorage.setItem(key, JSON.stringify(messageIds));
    return data;
  }

  const waitForStatusPage = () => {
    if (typeof window.fetchAndRenderActiveShifts !== 'function') return setTimeout(waitForStatusPage, 250);
    window.sendStatusLiveToDiscord = async () => {
      try { await syncLiveEmbed(); } catch (error) { console.error('Status Live Discord:', error); }
    };
    // Discord nu trebuie actualizat la fiecare secundă; acest interval evita
    // rate-limit-ul webhookului și păstrează actualizarea suficient de rapidă.
    window.setInterval(() => {
      window.fetchAndRenderActiveShifts(true).catch?.((error) => console.error('Status Live:', error));
    }, 60000);
  };
  document.addEventListener('DOMContentLoaded', waitForStatusPage, { once: true });
})();
