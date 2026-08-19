(() => {
  'use strict';

  const config = window.PANEL_SUPABASE_CONFIG;
  if (!config || !location.pathname.endsWith('anunturi.html')) return;

  const state = { warnings: [], sanctions: [], access: null, filter: null };
  const $ = (id) => document.getElementById(id);
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const sessionHeaders = () => ({
    'Content-Type': 'application/json',
    apikey: config.publishableKey,
    Authorization: `Bearer ${config.publishableKey}`,
    'x-panel-session': localStorage.getItem('panel_session_token') || ''
  });
  const call = async (body) => {
    const response = await fetch(`${config.url}/functions/v1/manage-community-posts`, {
      method: 'POST', headers: sessionHeaders(), body: JSON.stringify(body)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(result.error || `Operația a eșuat (${response.status}).`);
      error.status = response.status;
      error.code = result.code || '';
      throw error;
    }
    return result;
  };
  const hasWrite = (scope) => Boolean(state.access?.[scope]?.write);
  const hasSanction = (scope) => Boolean(state.access?.[scope]?.sanction);
  const currentDiscordId = () => {
    try { return String(window.getUser?.()?.discord_id || JSON.parse(localStorage.getItem('discord_user') || 'null')?.discord_id || ''); }
    catch (_) { return ''; }
  };
  const scopeLabel = (scope) => scope === 'departments' ? 'Birouri / Angajați' : 'Organizație';
  const typeLabel = (kind) => kind === 'warning' ? 'Avertisment' : 'Sancțiune financiară';

  function notice(message, tone = 'info') {
    const element = $('discipline-summary');
    if (!element) return;
    element.innerHTML = `<div class="discipline-notice ${tone}">${esc(message)}</div>`;
  }

  function closeModal() {
    const modal = $('discipline-modal');
    if (modal) modal.hidden = true;
  }

  function visibleScopeRecords(kind) {
    const rows = kind === 'warnings' ? state.warnings : state.sanctions;
    return rows.filter((row) => row.target_scope === 'departments' || row.target_scope === 'organization');
  }

  function render() {
    const kind = state.filter === 'sanctions' ? 'sanctions' : 'warnings';
    const rows = visibleScopeRecords(kind);
    const activeWarnings = state.warnings.filter((row) => row.status === 'active').length;
    const activeSanctions = state.sanctions.filter((row) => row.status === 'issued').length;
    $('discipline-summary').innerHTML = `<div class="discipline-metrics"><span>${activeWarnings} avertismente active</span><span>${activeSanctions} sancțiuni emise</span></div>`;
    $('discipline-heading').textContent = kind === 'warnings' ? 'Avertismente' : 'Sancțiuni financiare';
    $('discipline-description').textContent = kind === 'warnings'
      ? 'Avertismentele sunt numărate separat pentru fiecare angajat sau organizație.'
      : 'Sancțiunile sunt create manual după atingerea pragului de 3 avertismente active.';
    $('discipline-feed').innerHTML = rows.length ? rows.map((row) => card(row, kind === 'warnings' ? 'warning' : 'sanction')).join('') : '<div class="empty">Nu există înregistrări în această categorie.</div>';
    $('discipline-feed').querySelectorAll('[data-discipline-resolve]').forEach((button) => {
      button.addEventListener('click', async () => {
        const kindValue = button.dataset.kind;
        const status = kindValue === 'sanction' ? 'paid' : 'resolved';
        if (!window.confirm(kindValue === 'sanction' ? 'Marchezi sancțiunea ca plătită?' : 'Marchezi avertismentul ca rezolvat?')) return;
        button.disabled = true;
        try { await call({ action: 'discipline_resolve', kind: kindValue, id: button.dataset.disciplineResolve, status }); await load(); }
        catch (error) { notice(error.message, 'error'); button.disabled = false; }
      });
    });
    $('discipline-feed').querySelectorAll('[data-discipline-delete]').forEach((button) => {
      button.addEventListener('click', async () => {
        if (!window.confirm('Ștergi definitiv această înregistrare disciplinară?')) return;
        button.disabled = true;
        try { await call({ action: 'discipline_delete', kind: button.dataset.kind, id: button.dataset.disciplineDelete }); await load(); if (state.filter) render(); }
        catch (error) { notice(error.message, 'error'); button.disabled = false; }
      });
    });
  }

  function card(row, kind) {
    const isActive = kind === 'warning' ? row.status === 'active' : row.status === 'issued';
    const sameTarget = state.warnings.filter((item) => item.status === 'active' && item.target_scope === row.target_scope && String(item.target_discord_id || '') === String(row.target_discord_id || ''));
    const canResolve = kind === 'warning' ? hasWrite(row.target_scope) : hasSanction(row.target_scope);
    const canDelete = Boolean(state.access?.platform_admin) || String(row.issued_by_discord_id || '') === currentDiscordId() || (kind === 'warning' ? hasWrite(row.target_scope) : hasSanction(row.target_scope));
    const status = kind === 'warning'
      ? (row.status === 'active' ? 'Activ' : row.status === 'resolved' ? 'Rezolvat' : 'Revocat')
      : (row.status === 'issued' ? 'Emis' : row.status === 'paid' ? 'Plătit' : row.status === 'waived' ? 'Anulat' : 'Anulat');
    return `<article class="discipline-card ${isActive ? 'is-active' : ''}">
      <div class="discipline-card-head"><div><span class="badge ${kind === 'warning' ? 'discipline-warning' : 'discipline-sanction'}">${typeLabel(kind)}</span><span class="badge">${scopeLabel(row.target_scope)}</span></div><span class="discipline-status">${status}</span></div>
      <h4>${esc(row.target_name)}</h4>
      ${kind === 'warning' ? `<p class="discipline-count">Avertismentul ${sameTarget.length} din maximum 3 active</p>` : `<p class="discipline-count">${esc(row.amount)} ${esc(row.currency)} · ${row.warning_count_snapshot} avertismente la emitere</p>`}
      <p class="discipline-reason">${esc(row.reason)}</p>
      ${row.notes ? `<p class="discipline-notes">${esc(row.notes)}</p>` : ''}
      <div class="meta">Emis de ${esc(row.issued_by_name)} · ${new Date(row.created_at).toLocaleString('ro-RO')}</div>
      ${(() => { const evidenceUrl = window.panelSafeAssetUrl?.(row.evidence_url, '') || ''; return evidenceUrl ? `<a class="discipline-evidence" href="${esc(evidenceUrl)}" target="_blank" rel="noopener noreferrer">Deschide dovada</a>` : ''; })()}
      ${(canResolve && isActive) || canDelete ? `<div class="owner-actions">${canResolve && isActive ? `<button class="text-action" data-discipline-resolve="${esc(row.id)}" data-kind="${kind}">${kind === 'sanction' ? 'Marchează plătită' : 'Marchează rezolvat'}</button>` : ''}${canDelete ? `<button class="text-action danger" data-discipline-delete="${esc(row.id)}" data-kind="${kind}">Șterge</button>` : ''}</div>` : ''}
    </article>`;
  }

  function updateCreateButton() {
    const canCreate = hasWrite('departments') || hasWrite('organization') || hasSanction('departments') || hasSanction('organization');
    $('discipline-create-button').hidden = !canCreate;
    const warningOption = $('discipline-kind')?.querySelector('option[value="warning"]');
    const sanctionOption = $('discipline-kind')?.querySelector('option[value="sanction"]');
    if (warningOption) warningOption.hidden = !hasWrite('departments') && !hasWrite('organization');
    if (sanctionOption) sanctionOption.hidden = !hasSanction('departments') && !hasSanction('organization');
  }

  async function loadTargets() {
    const scope = $('discipline-scope').value;
    if ($('discipline-kind').value === 'warning' && !hasWrite(scope) && hasSanction(scope)) {
      $('discipline-kind').value = 'sanction';
      $('sanction-fields').hidden = false;
    }
    const target = $('discipline-target');
    target.innerHTML = '<option value="">Se încarcă…</option>';
    try {
      const result = await call({ action: 'discipline_targets', target_scope: scope });
      target.innerHTML = (result.targets || []).map((item) => `<option value="${esc(item.discord_id || 'organization')}">${esc(item.name)}${item.role ? ` · ${esc(item.role)}` : ''}</option>`).join('');
      if (!target.options.length) target.innerHTML = '<option value="">Nu există destinatari disponibili</option>';
    } catch (error) { target.innerHTML = `<option value="">${esc(error.message)}</option>`; }
  }

  function configureScopeOptions() {
    const select = $('discipline-scope');
    [...select.options].forEach((option) => { option.hidden = !hasWrite(option.value) && !(option.value === 'departments' ? hasSanction('departments') : hasSanction('organization')); });
    const first = [...select.options].find((option) => !option.hidden);
    if (first) select.value = first.value;
  }

  async function openModal() {
    configureScopeOptions();
    $('discipline-form').reset();
    const formError = $('discipline-form-error');
    if (formError) {
      formError.textContent = '';
      formError.hidden = true;
    }
    $('discipline-kind').value = hasWrite('departments') || hasWrite('organization') ? 'warning' : 'sanction';
    $('discipline-currency').value = 'USD';
    $('sanction-fields').hidden = true;
    $('discipline-modal').hidden = false;
    await loadTargets();
  }

  async function load() {
    try {
      const result = await call({ action: 'discipline_list' });
      state.warnings = result.warnings || [];
      state.sanctions = result.sanctions || [];
      state.access = result.access || {};
      document.querySelectorAll('[data-discipline-filter]').forEach((button) => {
        const visible = button.dataset.disciplineFilter === 'warnings'
          ? state.warnings.length > 0 || hasWrite('departments') || hasWrite('organization')
          : state.sanctions.length > 0 || hasSanction('departments') || hasSanction('organization');
        button.hidden = !visible;
      });
      updateCreateButton();
      if (state.filter) render();
    } catch (error) {
      state.access = {};
      document.querySelectorAll('[data-discipline-filter]').forEach((button) => { button.hidden = true; });
      if (state.filter) notice(`Sistemul disciplinar nu este disponibil: ${error.message}`, 'error');
    }
  }

  function showDiscipline(filter) {
    state.filter = filter;
    $('feed').hidden = true;
    $('discipline-panel').hidden = false;
    render();
    load();
  }

  function showCommunity() {
    state.filter = null;
    $('feed').hidden = false;
    $('discipline-panel').hidden = true;
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (!$('discipline-panel')) return;
    document.querySelectorAll('[data-discipline-filter]').forEach((button) => button.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach((tab) => tab.classList.remove('active'));
      button.classList.add('active');
      showDiscipline(button.dataset.disciplineFilter);
    }));
    document.querySelectorAll('[data-filter]').forEach((button) => button.addEventListener('click', () => {
      if (state.filter) showCommunity();
    }));
    $('discipline-create-button')?.addEventListener('click', openModal);
    document.addEventListener('click', (event) => {
      const closeButton = event.target?.closest?.('[data-discipline-close]');
      if (!closeButton) return;
      event.preventDefault();
      event.stopPropagation();
      closeModal();
    }, true);
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !$('discipline-modal')?.hidden) closeModal();
    });
    $('discipline-kind')?.addEventListener('change', () => { if ($('sanction-fields')) $('sanction-fields').hidden = $('discipline-kind').value !== 'sanction'; });
    $('discipline-scope')?.addEventListener('change', loadTargets);
    $('discipline-form')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const kind = $('discipline-kind').value;
      const scope = $('discipline-scope').value;
      const payload = {
        action: kind === 'warning' ? 'discipline_create_warning' : 'discipline_create_sanction',
        target_scope: scope,
        target_discord_id: $('discipline-target').value || null,
        reason: $('discipline-reason').value.trim(),
        notes: $('discipline-notes').value.trim(),
        evidence_url: $('discipline-evidence').value.trim()
      };
      if (kind === 'sanction') Object.assign(payload, { amount: $('discipline-amount').value, currency: $('discipline-currency').value.trim(), due_at: $('discipline-due').value || null });
      try {
        const result = await call(payload);
        $('discipline-modal').hidden = true;
        const discordNotice = result.discord_warning
          ? ` Înregistrarea a fost salvată, dar notificarea Discord nu a putut fi trimisă: ${result.discord_warning}`
          : '';
        notice(`${typeLabel(kind)} a fost salvat(ă) și va fi vizibil(ă) doar audienței permise.${discordNotice}`, result.discord_warning ? 'info' : 'success');
        await load();
        if (state.filter) render();
      } catch (error) {
        const formError = $('discipline-form-error');
        if (formError) {
          formError.textContent = error.message || 'Operația nu a putut fi finalizată.';
          formError.hidden = false;
        }
        if (kind === 'sanction' && error.status === 409) {
          notice(error.message || 'Sancțiunea poate fi emisă după 3 avertismente active pentru aceeași persoană.', 'error');
        } else {
          notice(error.message, 'error');
        }
      }
    });
    load();
  });
})();

