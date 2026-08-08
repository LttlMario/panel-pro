(() => {
  'use strict';

  if (!location.pathname.endsWith('organizatii.html')) return;

  const config = window.PANEL_SUPABASE_CONFIG;
  if (!config) return;
  let running = false;
  let realtimeChannel = null;
  let realtimeOrganizationId = '';

  function getOrganizationId() {
    try {
      const organization = JSON.parse(localStorage.getItem('panel_active_organization') || 'null');
      return String(organization?.id || organization?.organization_id || '').trim();
    } catch (_) { return ''; }
  }

  function storageKey(organizationId) { return `status_live_message_ids:${organizationId}`; }
  function getMessageIds(organizationId) {
    try { return JSON.parse(localStorage.getItem(storageKey(organizationId)) || '{}'); } catch (_) { return {}; }
  }

  async function syncStatusLive() {
    if (running) return;
    const organizationId = getOrganizationId();
    if (!organizationId) return;
    running = true;
    try {
      const response = await fetch(`${config.url}/functions/v1/status-live-sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: config.publishableKey,
          Authorization: `Bearer ${config.publishableKey}`,
          'x-panel-session': localStorage.getItem('panel_session_token') || ''
        },
        body: JSON.stringify({ organization_id: organizationId, message_ids: getMessageIds(organizationId) })
      });
      if (!response.ok) return;
      const data = await response.json().catch(() => ({}));
      if (data.message_ids) localStorage.setItem(storageKey(organizationId), JSON.stringify(data.message_ids));
    } finally { running = false; }
  }

  async function refreshRealtimeChannel() {
    const organizationId = getOrganizationId();
    if (!organizationId || organizationId === realtimeOrganizationId) return;
    realtimeOrganizationId = organizationId;
    try {
      const client = window.createPanelSupabaseClient?.();
      if (!client) return;
      if (realtimeChannel) await client.removeChannel(realtimeChannel);
      realtimeChannel = client.channel(`status-live-background-${organizationId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'shifts', filter: `organization_id=eq.${organizationId}` }, syncStatusLive)
        .subscribe();
    } catch (_) {}
  }

  function startBackgroundSync() {
    syncStatusLive();
    refreshRealtimeChannel();
    window.setInterval(() => { syncStatusLive(); refreshRealtimeChannel(); }, 60000);
  }

  window.syncStatusLiveInBackground = syncStatusLive;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startBackgroundSync, { once: true });
  else startBackgroundSync();
})();
