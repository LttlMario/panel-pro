(function () {
  const duration = 6 * 60 * 60 * 1000;
  let timer = null;
  let interval = null;
  const button = () => document.getElementById('dashboard-wheel-button');
  const status = () => document.getElementById('dashboard-wheel-status');
  const format = (ms) => {
    const seconds = Math.max(0, Math.ceil(ms / 1000));
    return [Math.floor(seconds / 3600), Math.floor((seconds % 3600) / 60), seconds % 60].map((v) => String(v).padStart(2, '0')).join(':');
  };
  const call = (action) => window.panelRequestJson('wheel-timer', { method: 'POST', body: JSON.stringify({ action }), timeoutMs: 12000, retry: true });
  function render() {
    const target = button(); const label = status();
    if (!target || !label) return;
    const remaining = timer ? new Date(timer.completes_at).getTime() - Date.now() : 0;
    const active = Boolean(timer && remaining > 0);
    target.disabled = active; target.classList.toggle('opacity-50', active); target.classList.toggle('cursor-not-allowed', active);
    target.textContent = active ? '⏳ Timer activ — ' + format(remaining) : '🎡 Am dat la roată';
    label.textContent = active ? 'Revino după 6 ore pentru următoarea rotire.' : 'Disponibil acum. Timerul se salvează automat în cont.';
  }
  async function load() { try { timer = (await call('status')).timer || null; render(); } catch (error) { status().textContent = error.message || 'Timerul nu este disponibil momentan.'; } }
  async function start() { const target = button(); target.disabled = true; try { timer = (await call('start')).timer; render(); } catch (error) { await load(); alert(error.message || 'Timerul nu a putut fi pornit.'); } }
  document.addEventListener('DOMContentLoaded', () => { if (!button()) return; button().addEventListener('click', start); load(); interval = window.setInterval(render, 1000); });
})();
