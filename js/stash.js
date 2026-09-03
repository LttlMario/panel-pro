(() => {
  const cfg = window.PANEL_SUPABASE_CONFIG || {};
  const $ = (id) => document.getElementById(id);
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  let state = { access: {}, items: [], requests: [], donations: [], archives: [] };
  let modalMode = '';
  let editingItem = null;

  const stashCategories = ['Arme', 'Muniție', 'Armuri', 'Semințe de cocaină', 'Semințe de canabis', 'Semințe de tutun', 'Plicuri goale', 'Plicuri de cocaină', 'Plicuri de ciuperci'];
  const statusLabel = { available: 'Disponibil', reserved: 'Rezervat', out: 'Epuizat', archived: 'Arhivat', pending: 'În așteptare', approved: 'Aprobat', rejected: 'Respins', completed: 'Finalizat' };
  const statusClass = (status) => ['available', 'approved', 'completed'].includes(status) ? 'green' : ['pending', 'reserved'].includes(status) ? 'amber' : ['rejected', 'out'].includes(status) ? 'red' : '';
  const showNotice = (message, error = false) => { const node = $('stash-notice'); node.textContent = message || ''; node.hidden = !message; node.style.borderColor = error ? '#991b1b' : '#7c2d12'; node.style.background = error ? '#450a0a' : '#431407'; node.style.color = error ? '#fecaca' : '#fed7aa'; };
  const api = async (action, payload = {}) => {
    const token = localStorage.getItem('panel_session_token') || '';
    const response = await fetch(`${cfg.url}/functions/v1/manage-stash`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: cfg.publishableKey || '', Authorization: `Bearer ${cfg.publishableKey || ''}`, 'x-panel-session': token }, body: JSON.stringify({ action, ...payload }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    return data;
  };

  const itemTitle = (item) => `<div class="stash-item-head"><div><div class="stash-item-title">${esc(item.title)}</div><div class="stash-meta"><span class="stash-pill">${esc(item.category)}</span><span class="stash-pill ${statusClass(item.status)}">${esc(statusLabel[item.status] || item.status)}</span><span class="stash-pill">${esc(item.quantity)} iteme</span></div></div>${state.access.write ? `<div class="stash-actions"><button class="stash-btn" data-withdraw-item="${esc(item.id)}">Retrage</button><button class="stash-btn" data-edit-item="${esc(item.id)}">Editează</button><button class="stash-btn danger" data-archive-item="${esc(item.id)}">Arhivează</button></div>` : ''}</div>`;
  const renderItems = () => {
    const host = $('stash-items');
    if (!state.access.read) { host.innerHTML = '<div class="stash-empty">Nu ai acces la inventarul acestui stash.</div>'; return; }
    if (!state.items.length) { host.innerHTML = '<div class="stash-empty">Nu există încă articole în stash.</div>'; return; }
    host.innerHTML = state.items.map((item) => `<article class="stash-item">${itemTitle(item)}${item.description ? `<div class="stash-desc">${esc(item.description)}</div>` : ''}${item.can_delete ? `<div class="stash-actions"><button class="stash-btn danger" data-delete-item="${esc(item.id)}">Șterge articolul</button></div>` : ''}</article>`).join('');
  };
  const renderRequests = () => {
    const host = $('stash-requests');
    if (!state.requests.length) { host.innerHTML = '<div class="stash-empty">Nu există cereri.</div>'; return; }
    host.innerHTML = state.requests.map((request) => `<div class="stash-row"><div><b class="text-slate-100">${esc(request.item_title)}</b><div class="stash-muted">${esc(request.requested_by_name)} · ${esc(request.quantity)} iteme ${request.note ? `· ${esc(request.note)}` : ''}</div></div><span class="stash-pill ${statusClass(request.status)}">${esc(statusLabel[request.status] || request.status)}</span><div class="stash-actions">${state.access.manage_requests && request.status === 'pending' ? `<button class="stash-btn primary" data-request-status="approved" data-request-id="${esc(request.id)}">Aprobă</button><button class="stash-btn danger" data-request-status="rejected" data-request-id="${esc(request.id)}">Respinge</button>` : ''}${request.can_delete ? `<button class="stash-btn danger" data-delete-request="${esc(request.id)}">Șterge</button>` : ''}</div></div>`).join('');
  };
  const renderDonations = () => {
    const host = $('stash-donations');
    if (!state.donations.length) { host.innerHTML = '<div class="stash-empty">Nu există donații.</div>'; return; }
    host.innerHTML = state.donations.map((donation) => `<div class="stash-row"><div><b class="text-slate-100">${esc(donation.title)}</b><div class="stash-muted">${esc(donation.donated_by_name)} · ${esc(donation.quantity)} iteme${donation.note ? ` · ${esc(donation.note)}` : ''}</div></div><span class="stash-pill ${statusClass(donation.status)}">${esc(statusLabel[donation.status] || donation.status)}</span><div class="stash-actions">${state.access.approve_donation && donation.status === 'pending' ? `<button class="stash-btn primary" data-donation-status="approved" data-donation-id="${esc(donation.id)}">Aprobă și postează</button><button class="stash-btn danger" data-donation-status="rejected" data-donation-id="${esc(donation.id)}">Respinge</button>` : ''}${donation.can_delete ? `<button class="stash-btn danger" data-delete-donation="${esc(donation.id)}">Șterge</button>` : ''}</div></div>`).join('');
  };
  const renderArchives = () => {
    const host = $('stash-archives');
    if (!state.access.log) { host.innerHTML = '<div class="stash-empty">Nu ai acces la jurnalul arhivelor.</div>'; return; }
    if (!state.archives.length) { host.innerHTML = '<div class="stash-empty">Nu există articole arhivate.</div>'; return; }
    host.innerHTML = state.archives.map((item) => `<div class="stash-row"><div><b class="text-slate-100">${esc(item.title)}</b><div class="stash-muted">${esc(item.category)} · ${esc(item.quantity)} iteme · ${esc(item.created_by_name)}</div></div><span class="stash-pill">Arhivat</span><div class="stash-actions"><time class="stash-muted">${esc(item.updated_at ? new Date(item.updated_at).toLocaleString('ro-RO') : '')}</time>${item.can_delete ? `<button class="stash-btn danger" data-delete-item="${esc(item.id)}">Șterge din arhivă</button>` : ''}</div></div>`).join('');
  };
  const renderAccess = () => {
    $('stash-add').hidden = !state.access.write;
    $('stash-request').hidden = !state.access.request;
    $('stash-donate').hidden = !state.access.donate;
    document.querySelector('[data-stash-tab="requests"]').hidden = !state.access.request && !state.access.manage_requests;
    document.querySelector('[data-stash-tab="donations"]').hidden = !state.access.donate && !state.access.approve_donation;
    document.querySelector('[data-stash-tab="archives"]').hidden = !state.access.log;
  };
  const load = async () => {
    showNotice('');
    $('stash-items').innerHTML = '<div class="stash-empty">Se încarcă…</div>';
    try { state = await api('load'); renderAccess(); renderItems(); renderRequests(); renderDonations(); renderArchives(); }
    catch (error) { showNotice(error.message, true); $('stash-items').innerHTML = `<div class="stash-empty">${esc(error.message)}</div>`; }
  };
  const field = (label, input) => `<label>${esc(label)}${input}</label>`;
  const customCategoryOption = 'Altele / Personalizat';
  const categoryField = (value = 'Arme') => {
    const current = String(value || '').trim();
    const selected = stashCategories.includes(current) ? current : customCategoryOption;
    const customValue = selected === customCategoryOption ? current : '';
    const options = [...stashCategories, customCategoryOption];
    return field('Categorie', `<select name="category" data-stash-category required>${options.map((category) => `<option value="${esc(category)}" ${category === selected ? 'selected' : ''}>${esc(category)}</option>`).join('')}</select>`) + `<label data-stash-custom-wrap hidden>Categorie personalizată<input name="custom_category" data-stash-custom-category maxlength="60" value="${esc(customValue)}" placeholder="Ex: Cărți, materiale, telefoane"></label>`;
  };
  const openModal = (mode, item = null) => {
    modalMode = mode; editingItem = item;
    const title = { item: item ? 'Editează articolul' : 'Adaugă în stash', withdraw: 'Retrage din stash', request: 'Trimite cerere din stash', donation: 'Donează către stash' }[mode];
    $('stash-modal-title').textContent = title;
    if (mode === 'item') $('stash-form-fields').innerHTML = field('Articol', `<input name="title" maxlength="140" required value="${esc(item?.title || '')}">`) + categoryField(item?.category || 'Arme') + field('Număr iteme', `<input name="quantity" type="number" min="0" step="0.01" required value="${esc(item?.quantity ?? 1)}">`) + field('Status', `<select name="status"><option value="available" ${item?.status === 'available' ? 'selected' : ''}>Disponibil</option><option value="reserved" ${item?.status === 'reserved' ? 'selected' : ''}>Rezervat</option><option value="out" ${item?.status === 'out' ? 'selected' : ''}>Epuizat</option></select>`) + field('Detalii', `<textarea name="description" maxlength="4000">${esc(item?.description || '')}</textarea>`);
    if (mode === 'request') $('stash-form-fields').innerHTML = field('Alege articolul (opțional)', `<select name="stash_item_id"><option value="">Cerere generală</option>${state.items.filter((entry) => entry.status !== 'archived').map((entry) => `<option value="${esc(entry.id)}">${esc(entry.title)} · ${esc(entry.quantity)} iteme</option>`).join('')}</select>`) + field('Articol solicitat', `<input name="item_title" maxlength="140" placeholder="Completează dacă nu alegi de mai sus">`) + field('Număr iteme', '<input name="quantity" type="number" min="0.01" step="0.01" required value="1">') + field('Notă', '<textarea name="note" maxlength="2000" placeholder="Pentru ce este necesar?"></textarea>');
    if (mode === 'donation') $('stash-form-fields').innerHTML = field('Ce donezi?', '<input name="title" maxlength="140" required>') + categoryField('Arme') + field('Număr iteme', '<input name="quantity" type="number" min="0.01" step="0.01" required value="1">') + field('Notă', '<textarea name="note" maxlength="4000" placeholder="Detalii pentru persoana care aprobă donația"></textarea>');
    if (mode === 'withdraw') $('stash-form-fields').innerHTML = field('Cantitate retrasă', `<input name="quantity" type="number" min="0.01" max="${esc(item?.quantity ?? 0)}" step="0.01" required value="1">`) + field('Persoana care primește', '<input name="recipient_name" maxlength="160" required placeholder="Nume Discord / beneficiar">') + field('ID Discord beneficiar (opțional)', '<input name="recipient_discord_id" inputmode="numeric" maxlength="22" placeholder="ID Discord">') + field('Notă', '<textarea name="note" maxlength="2000" placeholder="Ex: 10 armuri distribuite la patrulă"></textarea>');
    const categorySelect = $('stash-form-fields').querySelector('[data-stash-category]');
    const customCategoryWrap = $('stash-form-fields').querySelector('[data-stash-custom-wrap]');
    const customCategoryInput = $('stash-form-fields').querySelector('[data-stash-custom-category]');
    if (categorySelect && customCategoryWrap && customCategoryInput) {
      const syncCategory = () => {
        const isCustom = categorySelect.value === customCategoryOption;
        customCategoryWrap.hidden = !isCustom;
        customCategoryInput.required = isCustom;
      };
      categorySelect.addEventListener('change', syncCategory);
      syncCategory();
    }
    $('stash-modal').hidden = false;
    $('stash-form').querySelector('input,select,textarea')?.focus();
  };
  const closeModal = () => { $('stash-modal').hidden = true; modalMode = ''; editingItem = null; };
  const submitModal = async (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      if (modalMode === 'item' || modalMode === 'donation') {
        if (values.category === customCategoryOption) {
          values.category = String(values.custom_category || '').trim();
          if (values.category.length < 2) throw new Error('Completează categoria personalizată.');
        }
        delete values.custom_category;
      }
      let result;
      if (modalMode === 'item') result = await api(editingItem ? 'update_item' : 'create_item', editingItem ? { id: editingItem.id, ...values } : values);
      if (modalMode === 'withdraw') result = await api('withdraw_item', { id: editingItem.id, ...values });
      if (modalMode === 'request') result = await api('create_request', values);
      if (modalMode === 'donation') result = await api('create_donation', values);
      const wasDonation = modalMode === 'donation', wasWithdrawal = modalMode === 'withdraw'; closeModal(); showNotice(wasDonation ? 'Donația a fost trimisă pentru aprobare.' : wasWithdrawal ? 'Retragerea a fost salvată, iar embedul a fost actualizat cu stocul rămas.' : 'Modificările au fost salvate.'); await load();
      if (result?.webhook && (!result.webhook.configured || result.webhook.failed > 0)) showNotice('Datele au fost salvate, dar mesajul botului nu a fost livrat. Verifică ruta și canalul Discord selectat în administrarea organizației.', true);
    } catch (error) { showNotice(error.message, true); }
  };
  const setTab = (tab) => { document.querySelectorAll('[data-stash-tab]').forEach((button) => button.classList.toggle('active', button.dataset.stashTab === tab)); $('stash-items-panel').hidden = tab !== 'items'; $('stash-requests-panel').hidden = tab !== 'requests'; $('stash-donations-panel').hidden = tab !== 'donations'; $('stash-archives-panel').hidden = tab !== 'archives'; };
  document.addEventListener('click', async (event) => {
    const target = event.target.closest('button'); if (!target) return;
    if (target.dataset.stashTab) return setTab(target.dataset.stashTab);
    if (target.id === 'stash-refresh') return load();
    if (target.id === 'stash-add') return openModal('item');
    if (target.id === 'stash-request') return openModal('request');
    if (target.id === 'stash-donate') return openModal('donation');
    if (target.id === 'stash-cancel') return closeModal();
    if (target.dataset.editItem) return openModal('item', state.items.find((item) => item.id === target.dataset.editItem));
    if (target.dataset.withdrawItem) return openModal('withdraw', state.items.find((item) => item.id === target.dataset.withdrawItem));
    if (target.dataset.archiveItem && confirm('Arhivezi acest articol din stash?')) { try { await api('archive_item', { id: target.dataset.archiveItem }); showNotice('Articolul a fost arhivat.'); await load(); } catch (error) { showNotice(error.message, true); } return; }
    if (target.dataset.deleteItem && confirm('Ștergi definitiv acest articol din stash?')) { try { await api('delete_item', { id: target.dataset.deleteItem }); showNotice('Articolul a fost șters.'); await load(); } catch (error) { showNotice(error.message, true); } return; }
    if (target.dataset.deleteRequest && confirm('Ștergi definitiv această cerere?')) { try { await api('delete_request', { id: target.dataset.deleteRequest }); showNotice('Cererea a fost ștearsă.'); await load(); } catch (error) { showNotice(error.message, true); } return; }
    if (target.dataset.deleteDonation && confirm('Ștergi definitiv această donație?')) { try { await api('delete_donation', { id: target.dataset.deleteDonation }); showNotice('Donația a fost ștearsă.'); await load(); } catch (error) { showNotice(error.message, true); } return; }
    if (target.dataset.requestStatus) { try { await api('update_request', { id: target.dataset.requestId, status: target.dataset.requestStatus }); showNotice('Statusul cererii a fost actualizat.'); await load(); } catch (error) { showNotice(error.message, true); } return; }
    if (target.dataset.donationStatus) { try { await api('update_donation', { id: target.dataset.donationId, status: target.dataset.donationStatus }); showNotice(target.dataset.donationStatus === 'approved' ? 'Donația a fost aprobată și postată în stash.' : 'Donația a fost respinsă.'); await load(); } catch (error) { showNotice(error.message, true); } }
  });
  $('stash-cancel').onclick = closeModal;
  $('stash-form').onsubmit = submitModal;
  $('stash-modal').addEventListener('click', (event) => { if (event.target === $('stash-modal')) closeModal(); });
  load();
})();
