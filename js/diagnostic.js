(() => {
  const config = window.PANEL_SUPABASE_CONFIG;
  const user = typeof getUser === 'function' ? getUser() : null;
  if (!user || typeof isPlatformAdmin !== 'function' || !isPlatformAdmin()) { location.href = '403.html'; return; }

  const $ = (selector) => document.querySelector(selector);
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' })[character]);
  const displayName = $('#user-display-name');
  const role = $('#user-role');
  const avatar = $('#user-avatar');
  if (displayName) displayName.textContent = user.display_name || user.username || 'Coordonator';
  if (role) role.textContent = user.role || user.default_role || 'Coordonator';
  if (avatar) avatar.src = user.avatar || user.avatar_url || '';
  let diagnosticRunning = false;
  let monitorTimer = null;
  const monitorIntervalMs = 300000;

  async function invokeDiagnostics() {
    const token = window.getPanelDiscordAccessToken?.() || '';
    const sessionToken = await window.ensurePanelSession();
    if (!token) throw new Error('Sesiunea Discord lipsește. Autentifică-te din nou.');
    let result = {};
    try {
      result = await window.panelRequestJson('manage-discord-config', { method: 'POST', timeoutMs: 15000, headers: { 'x-panel-session': sessionToken }, body: JSON.stringify({ action:'diagnose', access_token:token }) });
    } catch (error) {
      if (error?.status === 401) {
        sessionStorage.setItem('panel_return_after_login', location.href);
        setTimeout(() => { location.href = 'login.html'; }, 900);
      }
      if (error?.name === 'AbortError') throw new Error('Verificarea Discord/Supabase a durat prea mult.');
      throw new Error(error?.message || 'Verificarea sistemului a eșuat.');
    }
    const localChecks = [];
    const selectedPages = Array.isArray(user.allowed_pages) ? user.allowed_pages : [];
    const platformAdmin = user.platform_admin === true || user.is_platform_admin === true;
    localChecks.push({ category:'Acces local', label:'Roluri Discord selectate', status:platformAdmin || selectedPages.length ? 'ok' : 'warning', message:platformAdmin ? 'Administrator platformă.' : `${selectedPages.length} pagini selectate după rolurile Discord.`, duration_ms:0 });
    const expiresAt = window.getPanelSessionExpiresAt?.() || 0;
    const sessionIsValid = Boolean(sessionToken) && Number.isFinite(expiresAt) && expiresAt > Date.now();
    localChecks.push({ category:'Sesiune', label:'Sesiune panel', status:sessionIsValid ? 'ok' : 'warning', message:sessionIsValid ? `Sesiune securizată activă; expiră la ${new Date(expiresAt).toLocaleString('ro-RO')}.` : 'Sesiunea lipsește sau a expirat. Autentifică-te din nou.', duration_ms:0 });
    localChecks.push({ category:'Conectivitate', label:'Browser online', status:navigator.onLine ? 'ok' : 'error', message:navigator.onLine ? 'Conexiunea browserului este activă.' : 'Browserul raportează lipsă de conexiune.', duration_ms:0 });
    return { ...result, results:[...(Array.isArray(result.results) ? result.results : []), ...localChecks] };
  }

  function render(data) {
    const results = Array.isArray(data.results) ? data.results : [];
    const summary = data.summary || { ok:0, warning:0, error:0 };
    $('#summary-total').textContent = results.length;
    $('#summary-ok').textContent = summary.ok || 0;
    $('#summary-warning').textContent = summary.warning || 0;
    $('#summary-error').textContent = summary.error || 0;
    const groups = results.reduce((map, item) => { (map[item.category] ||= []).push(item); return map; }, {});
    $('#diagnostic-results').innerHTML = Object.entries(groups).map(([category, items]) => `<section class="diagnostic-group"><h2>${escapeHtml(category)}</h2>${items.map((item) => {
      const icon = item.status === 'ok' ? '✓' : item.status === 'warning' ? '!' : '×';
      return `<div class="check-row"><span class="check-icon ${item.status}">${icon}</span><span class="check-label">${escapeHtml(item.label)}</span><span class="check-message">${escapeHtml(item.message)}</span><span class="check-duration">${Number(item.duration_ms || 0)} ms</span></div>`;
    }).join('')}</section>`).join('') || '<div class="empty-state">Funcția nu a returnat rezultate.</div>';
    const date = data.checked_at ? new Date(data.checked_at).toLocaleString('ro-RO') : 'acum';
    $('#diagnostic-status').textContent = summary.error ? `Verificare terminată la ${date}. Sunt ${summary.error} probleme care necesită rezolvare.` : summary.warning ? `Verificare terminată la ${date}. Sistemul funcționează, dar există ${summary.warning} avertismente.` : `Verificare terminată la ${date}. Toate testele au trecut.`;
  }

  async function runDiagnostics(manual = false) {
    if (diagnosticRunning) return;
    const button = $('#run-diagnostics');
    diagnosticRunning = true;
    button.disabled = true; button.textContent = 'Se verifică…';
    $('#diagnostic-status').textContent = manual ? 'Verificarea poate dura câteva secunde. Nu închide pagina.' : 'Monitorizarea automată verifică sistemul…';
    try { render(await invokeDiagnostics()); }
    catch (error) { $('#diagnostic-status').textContent = `Eroare la monitorizare: ${error.message}`; }
    finally { diagnosticRunning = false; button.disabled = false; button.textContent = 'Rulează din nou'; }
  }
  $('#run-diagnostics').addEventListener('click', () => runDiagnostics(true));
  monitorTimer = window.setInterval(() => { if (document.visibilityState === 'visible') runDiagnostics(false); }, monitorIntervalMs);
  runDiagnostics(false);
})();
