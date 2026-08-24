(() => {
  const kind = document.body.dataset.feedbackKind === 'rating' ? 'rating' : 'suggestion';
  const config = window.PANEL_SUPABASE_CONFIG;
  const user = window.getUser?.() || {};
  const currentId = String(user.discord_id || user.id || '');
  const $ = (selector) => document.querySelector(selector);
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[character]);
  const reactions = ['👍', '❤️', '✅', '🤔', '❌'];
  let posts = [];
  let editing = null;
  let loading = false;

  const titleForKind = kind === 'rating' ? 'Recenzii Panel' : 'Sugestii';
  const emptyText = kind === 'rating' ? 'Nu există încă evaluări. Fii primul care evaluează panelul.' : 'Nu există încă sugestii. Fii primul care propune o îmbunătățire.';

  async function invoke(body) {
    const session = localStorage.getItem('panel_session_token') || '';
    if (!session) {
      sessionStorage.setItem('panel_return_after_login', location.href);
      location.href = 'login.html';
      throw new Error('Sesiunea panelului lipsește.');
    }
    const response = await fetch(`${config.url}/functions/v1/manage-public-feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: config.publishableKey,
        Authorization: `Bearer ${config.publishableKey}`,
        'x-panel-session': session,
      },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Operația a eșuat (${response.status}).`);
    return payload;
  }

  function formatDate(value) {
    try { return new Date(value).toLocaleString('ro-RO'); } catch (_) { return ''; }
  }

  function ratingStars(value) {
    const rating = Number(value || 0);
    return rating ? `<span class="feedback-stars" aria-label="${rating} din 5">${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}</span>` : '';
  }

  function card(post) {
    const mine = new Set((post.reactions || []).filter((item) => String(item.user_discord_id) === currentId).map((item) => item.reaction));
    const totals = Object.fromEntries(reactions.map((reaction) => [reaction, (post.reactions || []).filter((item) => item.reaction === reaction).length]));
    const manage = post.can_edit || post.can_delete;
    return `<article class="feedback-card" id="feedback-${esc(post.id)}">
      <div class="feedback-card-top"><div><span class="feedback-badge">${kind === 'rating' ? '⭐ Evaluare' : '💡 Sugestie'}</span><span class="feedback-badge muted">${esc(post.author_organization_name || 'Organizație')}</span></div><time>${esc(formatDate(post.created_at))}</time></div>
      <h3>${esc(post.title || (kind === 'rating' ? 'Evaluare Panel Pro' : 'Sugestie'))}</h3>
      ${kind === 'rating' ? `<div class="feedback-rating">${ratingStars(post.rating)} <span>${Number(post.rating || 0)}/5</span></div>` : ''}
      <p class="feedback-content">${esc(post.content).replace(/\n/g, '<br>')}</p>
      <div class="feedback-meta">${esc(post.author_name)}${post.updated_at && post.updated_at !== post.created_at ? ' · editat' : ''}</div>
      <div class="feedback-actions"><div class="feedback-reactions">${reactions.map((reaction) => `<button type="button" class="feedback-reaction ${mine.has(reaction) ? 'selected' : ''}" data-react="${esc(reaction)}" data-id="${esc(post.id)}">${reaction} <span>${totals[reaction]}</span></button>`).join('')}</div>${manage ? `<div class="feedback-manage">${post.can_edit ? `<button type="button" class="feedback-action" data-edit="${esc(post.id)}">Editează</button>` : ''}${post.can_delete ? `<button type="button" class="feedback-action danger" data-delete="${esc(post.id)}">Șterge</button>` : ''}</div>` : ''}</div>
    </article>`;
  }

  function render() {
    const feed = $('#feedback-feed');
    feed.innerHTML = posts.length ? posts.map(card).join('') : `<div class="feedback-empty">${emptyText}</div>`;
    feed.querySelectorAll('[data-react]').forEach((button) => button.addEventListener('click', async () => {
      button.disabled = true;
      try { await invoke({ action: 'react', post_id: button.dataset.id, reaction: button.dataset.react }); await load(); }
      catch (error) { alert(error.message); button.disabled = false; }
    }));
    feed.querySelectorAll('[data-edit]').forEach((button) => button.addEventListener('click', () => openEditor(button.dataset.edit)));
    feed.querySelectorAll('[data-delete]').forEach((button) => button.addEventListener('click', async () => {
      if (!confirm('Ștergi definitiv această postare?')) return;
      button.disabled = true;
      try { await invoke({ action: 'delete', post_id: button.dataset.delete }); await load(); }
      catch (error) { alert(error.message); button.disabled = false; }
    }));
    const wanted = new URLSearchParams(location.search).get('post');
    if (wanted) setTimeout(() => { const target = document.getElementById(`feedback-${wanted}`); if (target) { target.classList.add('highlight'); target.scrollIntoView({ behavior: 'smooth', block: 'center' }); } }, 120);
  }

  async function load() {
    if (loading) return;
    loading = true;
    $('#feedback-feed').innerHTML = '<div class="feedback-empty">Se încarcă postările…</div>';
    try { const result = await invoke({ action: 'list' }); posts = (result.posts || []).filter((post) => post.kind === kind); render(); }
    catch (error) { $('#feedback-feed').innerHTML = `<div class="feedback-empty error">${esc(error.message)}</div>`; }
    finally { loading = false; }
  }

  function openEditor(id = '') {
    editing = posts.find((post) => String(post.id) === String(id)) || null;
    $('#feedback-modal-title').textContent = editing ? 'Editează postarea' : `Creează ${kind === 'rating' ? 'o evaluare' : 'o sugestie'}`;
    $('#feedback-title').value = editing?.title || (kind === 'rating' ? 'Evaluare Panel Pro' : '');
    $('#feedback-content').value = editing?.content || '';
    $('#feedback-rating').value = String(editing?.rating || 5);
    $('#feedback-modal').hidden = false;
    $('#feedback-content').focus();
  }

  function closeEditor() { $('#feedback-modal').hidden = true; editing = null; }

  document.addEventListener('DOMContentLoaded', async () => {
    $('#feedback-create').addEventListener('click', () => openEditor());
    $('#feedback-cancel').addEventListener('click', closeEditor);
    $('#feedback-modal').addEventListener('click', (event) => { if (event.target === $('#feedback-modal')) closeEditor(); });
    $('#feedback-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const submit = $('#feedback-submit');
      submit.disabled = true;
      try {
        const body = { kind, title: $('#feedback-title').value.trim(), content: $('#feedback-content').value.trim() };
        if (kind === 'rating') body.rating = Number($('#feedback-rating').value);
        if (editing) { body.action = 'update'; body.post_id = editing.id; }
        else body.action = 'create';
        await invoke(body); closeEditor(); await load();
      } catch (error) { alert(error.message); }
      finally { submit.disabled = false; }
    });
    $('#feedback-rating-wrap').hidden = kind !== 'rating';
    $('#feedback-page-title').textContent = titleForKind;
    $('#feedback-page-description').textContent = kind === 'rating'
      ? 'Lasă o notă și un feedback pentru Panel Pro. Toate evaluările sunt vizibile tuturor organizațiilor.'
      : 'Propune idei pentru Panel Pro. Sugestiile sunt vizibile tuturor organizațiilor.';
    await load();
    window.setInterval(load, 30000);
  });
})();
