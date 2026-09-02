(() => {
  if (!location.pathname.endsWith('secrete-platforma.html')) return;
  const config = window.PANEL_SUPABASE_CONFIG;
  const list = document.getElementById('secret-list');
  const status = document.getElementById('secret-status-message');
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' })[character]);
  const setStatus = (message, kind = '') => { status.textContent = message; status.className = `text-xs ${kind === 'error' ? 'text-rose-300' : kind === 'success' ? 'text-emerald-300' : 'text-slate-400'}`; };
  const request = async (body) => {
    const session = await window.ensurePanelSession();
    const response = await fetch(`${config.url}/functions/v1/manage-platform-secrets`, { method:'POST', headers:{'Content-Type':'application/json',apikey:config.publishableKey,Authorization:`Bearer ${config.publishableKey}`,'x-panel-session':session}, body:JSON.stringify(body) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Operația a eșuat (${response.status}).`);
    return payload;
  };
  const render = (items) => {
    list.innerHTML = items.map((item) => `<article class="secret-card" data-secret-card="${escapeHtml(item.name)}">
      <div class="flex items-start justify-between gap-4"><div><h2>${escapeHtml(item.label)}</h2><p class="mt-1">Nume intern: <code class="text-slate-300">${escapeHtml(item.name)}</code></p></div><span class="secret-status ${item.configured ? 'ready' : 'missing'}">${item.configured ? 'CONFIGURAT' : 'LIPSEȘTE'}</span></div>
      <p class="mt-3">Aplicat automat în: ${escapeHtml((item.applied_to || []).join(', ') || 'nicio funcție') }.</p>
      <div class="mt-4 hidden" data-editor><input class="secret-input" type="password" autocomplete="new-password" placeholder="Valoare nouă (nu este afișată)"></div>
      <div class="mt-4 flex flex-wrap gap-2"><button type="button" class="secret-button secondary" data-change>Schimbă secretul</button><button type="button" class="secret-button primary" data-apply>Aplică peste tot</button>${String(item.name).startsWith('public_community_webhook_') || String(item.name).startsWith('public_rating_webhook_') ? '<button type="button" class="secret-button secondary" data-test>Testează webhookul</button>' : ''}</div>
    </article>`).join('');
    list.querySelectorAll('[data-secret-card]').forEach((card) => {
      const name = card.dataset.secretCard; const editor = card.querySelector('[data-editor]'); const input = card.querySelector('input'); const change = card.querySelector('[data-change]'); const apply = card.querySelector('[data-apply]'); const test = card.querySelector('[data-test]');
      change.addEventListener('click', async () => {
        if (editor.classList.contains('hidden')) { editor.classList.remove('hidden'); input.focus(); change.textContent = 'Salvează secretul'; return; }
        if (!input.value.trim()) { setStatus('Introdu o valoare înainte de salvare.', 'error'); return; }
        change.disabled = true; apply.disabled = true; setStatus('Se salvează fără a afișa valoarea…');
        try { const result = await request({ action:'set', name, value:input.value }); input.value=''; editor.classList.add('hidden'); change.textContent='Schimbă secretul'; setStatus(`Secretul a fost salvat și aplicat în ${(result.applied_to || []).length} locuri.`, 'success'); await load(); } catch (error) { setStatus(error.message, 'error'); } finally { change.disabled=false; apply.disabled=false; }
      });
      apply.addEventListener('click', async () => { apply.disabled=true; setStatus('Se verifică aplicarea…'); try { const result=await request({action:'apply',name}); setStatus(`Secretul este activ pentru ${(result.applied_to || []).length} locuri.`, 'success'); } catch(error) { setStatus(error.message, 'error'); } finally { apply.disabled=false; } });
      test?.addEventListener('click', async () => { test.disabled=true; setStatus('Se testează webhookul…'); try { await request({action:'test_webhook',name}); setStatus('Webhookul a răspuns cu succes.', 'success'); } catch(error) { setStatus(error.message, 'error'); } finally { test.disabled=false; } });
    });
  };
  async function load() { setStatus('Se verifică statusul…'); try { const result=await request({action:'list'}); render(result.secrets || []); setStatus('Status actualizat.', 'success'); } catch(error) { list.innerHTML=`<div class="rounded-2xl border border-rose-400/30 bg-rose-950/20 p-6 text-rose-200">${escapeHtml(error.message)}</div>`; setStatus(error.message, 'error'); } }
  document.getElementById('refresh-secrets').addEventListener('click', load);
  load();
})();
