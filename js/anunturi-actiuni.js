(() => {
  'use strict';
  if (!location.pathname.endsWith('anunturi.html')) return;
  const config = window.PANEL_SUPABASE_CONFIG;
  const $ = (id) => document.getElementById(id);
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const state = { actions: [], guilds: [], members: [], access: {}, open: false };
  const call = async (body) => {
    const response = await fetch(`${config.url}/functions/v1/manage-community-posts`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: config.publishableKey, Authorization: `Bearer ${config.publishableKey}`, 'x-panel-session': localStorage.getItem('panel_session_token') || '' }, body: JSON.stringify(body) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || `Operația a eșuat (${response.status}).`);
    return result;
  };
  const notice = (message, error = false) => { const host = $('actions-summary'); if (host) host.innerHTML = `<div class="discipline-notice ${error ? 'error' : 'success'}">${esc(message)}</div>`; };
  const typeLabel = (row) => row.action_label || row.action_type || 'Acțiune';
  function render() {
    const host = $('actions-feed');
    if (!host) return;
    host.innerHTML = state.actions.length ? state.actions.map((row) => `<article class="discipline-card is-active"><div class="discipline-card-head"><div><span class="badge organization">${esc(typeLabel(row))}</span><span class="badge">${esc(row.guild_name || row.guild_id || 'Guild Discord')}</span></div><span class="discipline-status">${new Date(row.created_at).toLocaleDateString('ro-RO')}</span></div><h4>${esc(row.action_label)}</h4>${row.description ? `<p class="discipline-reason">${esc(row.description)}</p>` : ''}<p class="discipline-notes"><b>Participanți:</b> ${row.participants?.length ? row.participants.map((item) => esc(item.name)).join(', ') : 'Nespecificați'}</p>${row.notes ? `<p class="discipline-notes">${esc(row.notes)}</p>` : ''}<div class="meta">Înregistrată de ${esc(row.created_by_name || row.created_by_discord_id)} · ${new Date(row.created_at).toLocaleString('ro-RO')}</div>${state.access.delete ? `<div class="owner-actions"><button class="text-action danger" data-actions-delete="${esc(row.id)}">Șterge</button></div>` : ''}</article>`).join('') : '<div class="empty">Nu există acțiuni înregistrate.</div>';
    host.querySelectorAll('[data-actions-delete]').forEach((button) => button.addEventListener('click', async () => {
      if (!confirm('Ștergi definitiv această acțiune?')) return;
      button.disabled = true;
      try { await call({ action: 'actions_delete', id: button.dataset.actionsDelete }); await load(); notice('Acțiunea a fost ștearsă.'); }
      catch (error) { notice(error.message, true); button.disabled = false; }
    }));
  }
  function fillGuilds() {
    const select = $('actions-guild');
    select.innerHTML = state.guilds.length ? state.guilds.map((guild) => `<option value="${esc(guild.guild_id)}">${esc(guild.guild_name || guild.guild_id)}${guild.kind === 'secondary' ? ' · secundar' : ''}</option>`).join('') : '<option value="">Nu există Guild configurat</option>';
  }
  async function loadMembers() {
    const guildId = $('actions-guild').value;
    const select = $('actions-members');
    select.innerHTML = '<option>Se încarcă membrii…</option>';
    try { const result = await call({ action: 'actions_members', guild_id: guildId }); state.members = result.members || []; select.innerHTML = state.members.length ? state.members.map((member) => `<option value="${esc(member.discord_id)}">${esc(member.name)}${member.username ? ` · @${esc(member.username)}` : ''}</option>`).join('') : '<option value="">Nu există membri disponibili</option>'; }
    catch (error) { select.innerHTML = `<option value="">${esc(error.message)}</option>`; }
  }
  function closeModal() { $('actions-modal').hidden = true; }
  async function openModal() {
    $('actions-form').reset(); $('actions-custom-wrap').hidden = true; $('actions-modal').hidden = false;
    try { const result = await call({ action: 'actions_guilds' }); state.guilds = result.guilds || []; fillGuilds(); if (state.guilds.length) await loadMembers(); }
    catch (error) { closeModal(); notice(error.message, true); }
  }
  async function load() {
    try { const access = await call({ action: 'actions_access' }); state.access = access || {}; if (!state.access.read && !state.access.write && !state.access.delete) throw new Error('Nu ai acces la modulul Acțiuni.'); const result = state.access.read ? await call({ action: 'actions_list' }) : { actions: [] }; state.actions = result.actions || []; state.guilds = result.guilds || []; $('actions-tab')?.removeAttribute('hidden'); $('actions-create-button').hidden = !state.access.write; $('actions-summary').innerHTML = `<div class="discipline-metrics"><span>${state.actions.length} acțiuni salvate</span><span>${state.access.write ? 'Poți adăuga acțiuni' : 'Doar vizualizare'}</span></div>`; if (state.open) render(); }
    catch (error) { state.access = {}; $('actions-tab')?.setAttribute('hidden', ''); $('actions-create-button').hidden = true; if (state.open) notice(`Modulul Acțiuni nu este disponibil: ${error.message}`, true); }
  }
  function show() { state.open = true; $('feed').hidden = true; $('discipline-panel').hidden = true; $('actions-panel').hidden = false; document.querySelectorAll('.tab').forEach((tab) => tab.classList.remove('active')); document.querySelector('[data-actions-filter]')?.classList.add('active'); render(); load(); }
  function hide() { state.open = false; $('actions-panel').hidden = true; $('feed').hidden = false; }
  document.addEventListener('DOMContentLoaded', () => {
    if (!$('actions-panel')) return;
    const tab = document.querySelector('[data-actions-filter]');
    if (tab) { tab.id = 'actions-tab'; tab.addEventListener('click', show); }
    $('actions-create-button')?.addEventListener('click', openModal);
    $('actions-guild')?.addEventListener('change', loadMembers);
    $('actions-type')?.addEventListener('change', () => { $('actions-custom-wrap').hidden = $('actions-type').value !== 'Personalizat'; });
    document.addEventListener('click', (event) => { const target = event.target; if (target instanceof Element && target.closest('[data-actions-close]')) closeModal(); if (target === $('actions-modal')) closeModal(); if (target instanceof Element && target.closest('[data-filter], [data-discipline-filter]')) hide(); });
    $('actions-form')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const selected = [...$('actions-members').selectedOptions].map((option) => option.value).filter(Boolean);
      const type = $('actions-type').value, label = type === 'Personalizat' ? $('actions-custom-label').value.trim() : type;
      if (!label) { notice('Introdu denumirea acțiunii.', true); return; }
      const button = $('actions-form').querySelector('button[type="submit"]'); button.disabled = true;
      try { await call({ action: 'actions_create', action_type: type, action_label: label, guild_id: $('actions-guild').value, participant_ids: selected, description: $('actions-description').value.trim(), notes: $('actions-notes').value.trim() }); closeModal(); show(); notice('Acțiunea a fost salvată.'); }
      catch (error) { notice(error.message, true); }
      finally { button.disabled = false; }
    });
    load();
  });
})();
