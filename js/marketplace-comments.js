(function () {
    'use strict';

    const state = {
        table: '',
        itemId: '',
        title: ''
    };

    const escapeHtml = (value) => String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

    const getConfig = () => window.PANEL_SUPABASE_CONFIG || {};

    async function call(action, payload = {}) {
        const config = getConfig();
        const session = localStorage.getItem('panel_session_token') || '';
        if (!session) throw new Error('Sesiunea panelului lipsește. Autentifică-te din nou.');
        const response = await fetch(`${config.url}/functions/v1/manage-community-posts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                apikey: config.publishableKey,
                Authorization: `Bearer ${config.publishableKey}`,
                'x-panel-session': session
            },
            body: JSON.stringify({
                action,
                ...payload,
                access_token: window.getPanelDiscordAccessToken?.()
            })
        });
        let result = {};
        try { result = await response.json(); } catch (_) {}
        if (!response.ok) throw new Error(result.error || 'Acțiunea pentru comentarii a eșuat.');
        return result;
    }

    function ensureModal() {
        let modal = document.getElementById('marketplace-comments-modal');
        if (modal) return modal;
        modal = document.createElement('div');
        modal.id = 'marketplace-comments-modal';
        modal.hidden = true;
        modal.innerHTML = `
            <div class="marketplace-comments-backdrop" data-comments-close></div>
            <section class="marketplace-comments-dialog" role="dialog" aria-modal="true" aria-labelledby="marketplace-comments-title">
                <header class="marketplace-comments-header">
                    <div>
                        <span class="marketplace-comments-eyebrow">DISCUȚIE ANUNȚ</span>
                        <h2 id="marketplace-comments-title">Comentarii</h2>
                    </div>
                    <button type="button" class="marketplace-comments-close" data-comments-close aria-label="Închide">×</button>
                </header>
                <div class="marketplace-comments-list" data-comments-list>
                    <p class="marketplace-comments-state">Se încarcă comentariile…</p>
                </div>
                <form class="marketplace-comments-form" data-comments-form>
                    <textarea name="content" maxlength="2000" rows="3" placeholder="Scrie un comentariu…" required></textarea>
                    <div class="marketplace-comments-emoji-bar" role="toolbar" aria-label="Alege un emoticon">
                        <span>Emoticoane:</span>
                        <button type="button" data-comments-emoji="👍" aria-label="Like">👍</button>
                        <button type="button" data-comments-emoji="❤️" aria-label="Inimă">❤️</button>
                        <button type="button" data-comments-emoji="😂" aria-label="Râs">😂</button>
                        <button type="button" data-comments-emoji="😮" aria-label="Uimire">😮</button>
                        <button type="button" data-comments-emoji="😢" aria-label="Tristețe">😢</button>
                        <button type="button" data-comments-emoji="🔥" aria-label="Foc">🔥</button>
                        <button type="button" data-comments-emoji="✅" aria-label="Confirmare">✅</button>
                        <button type="button" data-comments-emoji="❌" aria-label="Respins">❌</button>
                        <button type="button" data-comments-emoji="👀" aria-label="Privesc">👀</button>
                    </div>
                    <div class="marketplace-comments-form-footer">
                        <small>Comentariul va fi vizibil doar utilizatorilor care au acces la această pagină.</small>
                        <button type="submit">Publică</button>
                    </div>
                </form>
            </section>`;
        document.body.appendChild(modal);

        modal.addEventListener('click', async (event) => {
            const close = event.target.closest('[data-comments-close]');
            if (close) return closeModal();
            const emojiButton = event.target.closest('[data-comments-emoji]');
            if (emojiButton) {
                const textarea = modal.querySelector('textarea[name="content"]');
                const emoji = emojiButton.dataset.commentsEmoji || '';
                const start = textarea.selectionStart ?? textarea.value.length;
                const end = textarea.selectionEnd ?? start;
                textarea.value = `${textarea.value.slice(0, start)}${emoji}${textarea.value.slice(end)}`;
                textarea.focus();
                const cursor = start + emoji.length;
                textarea.setSelectionRange(cursor, cursor);
                return;
            }
            const deleteButton = event.target.closest('[data-comments-delete]');
            if (!deleteButton) return;
            if (!window.confirm('Ștergi acest comentariu?')) return;
            deleteButton.disabled = true;
            try {
                await call('marketplace_comment_delete', {
                    table: state.table,
                    item_id: state.itemId,
                    comment_id: deleteButton.dataset.commentsDelete
                });
                await loadComments();
            } catch (error) {
                window.alert(error.message || 'Comentariul nu a putut fi șters.');
                deleteButton.disabled = false;
            }
        });

        modal.querySelector('[data-comments-form]').addEventListener('submit', async (event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const textarea = form.elements.content;
            const content = String(textarea.value || '').trim();
            if (!content) return;
            const button = form.querySelector('button[type="submit"]');
            button.disabled = true;
            try {
                await call('marketplace_comment_add', {
                    table: state.table,
                    item_id: state.itemId,
                    content
                });
                textarea.value = '';
                await loadComments();
            } catch (error) {
                window.alert(error.message || 'Comentariul nu a putut fi publicat.');
            } finally {
                button.disabled = false;
            }
        });

        return modal;
    }

    function closeModal() {
        const modal = document.getElementById('marketplace-comments-modal');
        if (modal) modal.hidden = true;
    }

    function renderComments(result) {
        const modal = ensureModal();
        const list = modal.querySelector('[data-comments-list]');
        const comments = Array.isArray(result.comments) ? result.comments : [];
        if (!comments.length) {
            list.innerHTML = '<p class="marketplace-comments-state">Nu există comentarii. Fii primul care scrie.</p>';
            return;
        }
        list.innerHTML = comments.map((comment) => {
            const date = comment.created_at ? new Date(comment.created_at).toLocaleString('ro-RO') : '';
            return `<article class="marketplace-comment">
                <div class="marketplace-comment-top">
                    <strong>${escapeHtml(comment.author_name || 'Utilizator')}</strong>
                    <time>${escapeHtml(date)}</time>
                </div>
                <p>${escapeHtml(comment.content)}</p>
                ${comment.can_delete ? `<button type="button" class="marketplace-comment-delete" data-comments-delete="${escapeHtml(comment.id)}">Șterge</button>` : ''}
            </article>`;
        }).join('');
    }

    async function loadComments() {
        const modal = ensureModal();
        const list = modal.querySelector('[data-comments-list]');
        list.innerHTML = '<p class="marketplace-comments-state">Se încarcă comentariile…</p>';
        try {
            const result = await call('marketplace_comments_list', {
                table: state.table,
                item_id: state.itemId
            });
            renderComments(result);
        } catch (error) {
            list.innerHTML = `<p class="marketplace-comments-state marketplace-comments-error">${escapeHtml(error.message || 'Comentariile nu sunt disponibile.')}</p>`;
        }
    }

    function openComments(button) {
        state.table = button.dataset.marketplaceTable || '';
        state.itemId = button.dataset.marketplaceId || '';
        state.title = button.dataset.marketplaceTitle || 'Anunț';
        const modal = ensureModal();
        modal.querySelector('#marketplace-comments-title').textContent = `Comentarii · ${state.title}`;
        modal.hidden = false;
        loadComments();
    }

    document.addEventListener('click', (event) => {
        const button = event.target.closest('[data-marketplace-comments-open]');
        if (button) openComments(button);
    });

    const style = document.createElement('style');
    style.textContent = `
        #marketplace-comments-modal[hidden] { display: none; }
        #marketplace-comments-modal { position: fixed; inset: 0; z-index: 5000; display: flex; align-items: center; justify-content: center; padding: 18px; }
        .marketplace-comments-backdrop { position: absolute; inset: 0; background: rgba(2, 6, 23, .78); backdrop-filter: blur(8px); }
        .marketplace-comments-dialog { position: relative; z-index: 1; width: min(680px, 100%); max-height: min(760px, 90vh); display: flex; flex-direction: column; overflow: hidden; border: 1px solid #334155; border-radius: 24px; background: #0f172a; color: #e2e8f0; box-shadow: 0 28px 90px rgba(2, 6, 23, .7); }
        .marketplace-comments-header { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 20px 22px; border-bottom: 1px solid #1e293b; background: linear-gradient(135deg, rgba(16, 185, 129, .14), rgba(15, 23, 42, .4)); }
        .marketplace-comments-header h2 { margin: 5px 0 0; font-size: 18px; line-height: 1.3; }
        .marketplace-comments-eyebrow { color: #6ee7b7; font-size: 10px; font-weight: 800; letter-spacing: .14em; }
        .marketplace-comments-close { width: 36px; height: 36px; border: 1px solid #334155; border-radius: 12px; color: #cbd5e1; font-size: 24px; line-height: 1; cursor: pointer; background: #111827; }
        .marketplace-comments-close:hover { color: #fff; background: #334155; }
        .marketplace-comments-list { min-height: 180px; overflow-y: auto; padding: 10px 18px; }
        .marketplace-comments-state { padding: 38px 12px; color: #94a3b8; text-align: center; font-size: 13px; }
        .marketplace-comments-error { color: #fda4af; }
        .marketplace-comment { position: relative; padding: 15px 4px 16px; border-bottom: 1px solid #1e293b; }
        .marketplace-comment-top { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
        .marketplace-comment-top strong { color: #f8fafc; font-size: 13px; }
        .marketplace-comment-top time { color: #64748b; font-size: 10px; white-space: nowrap; }
        .marketplace-comment p { margin: 8px 0 0; color: #cbd5e1; font-size: 13px; line-height: 1.55; white-space: pre-wrap; overflow-wrap: anywhere; }
        .marketplace-comment-delete { margin-top: 9px; border: 0; color: #fb7185; background: transparent; font-size: 11px; cursor: pointer; }
        .marketplace-comment-delete:hover { color: #fecdd3; }
        .marketplace-comments-form { padding: 15px 18px 18px; border-top: 1px solid #1e293b; background: #0b1220; }
        .marketplace-comments-form textarea { width: 100%; resize: vertical; min-height: 76px; padding: 11px 12px; border: 1px solid #334155; border-radius: 14px; outline: none; color: #e2e8f0; background: #020617; font: inherit; font-size: 13px; }
        .marketplace-comments-form textarea:focus { border-color: #10b981; box-shadow: 0 0 0 3px rgba(16, 185, 129, .12); }
        .marketplace-comments-emoji-bar { display: flex; align-items: center; flex-wrap: wrap; gap: 5px; margin-top: 8px; }
        .marketplace-comments-emoji-bar span { margin-right: 2px; color: #64748b; font-size: 10px; }
        .marketplace-comments-emoji-bar button { min-width: 28px; height: 28px; padding: 0 5px; border: 1px solid #334155; border-radius: 8px; color: #e2e8f0; background: #111827; font-size: 15px; line-height: 1; cursor: pointer; }
        .marketplace-comments-emoji-bar button:hover { border-color: #10b981; background: #064e3b; }
        .marketplace-comments-form-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 10px; }
        .marketplace-comments-form-footer small { color: #64748b; font-size: 10px; line-height: 1.4; }
        .marketplace-comments-form-footer button { padding: 9px 15px; border: 1px solid rgba(52, 211, 153, .35); border-radius: 11px; color: #d1fae5; background: rgba(16, 185, 129, .15); font-size: 12px; font-weight: 800; cursor: pointer; }
        .marketplace-comments-form-footer button:hover { background: rgba(16, 185, 129, .25); }
        .marketplace-comments-form-footer button:disabled { opacity: .55; cursor: wait; }
        @media (max-width: 520px) { .marketplace-comments-dialog { max-height: 94vh; border-radius: 20px; } .marketplace-comments-form-footer { align-items: flex-end; } .marketplace-comments-form-footer small { max-width: 65%; } }
    `;
    document.head.appendChild(style);
})();
