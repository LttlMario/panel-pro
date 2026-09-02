// Interfața paginii complete Asistent. Motorul comun se află în asistent-core.js.
(() => {
    'use strict';
    let engine = null;
    let responseQueue = Promise.resolve();
    let typingSequence = 0;

    function createMessage(text, sender, result = {}) {
        const chat = document.getElementById('assistant-messages');
        if (!chat) return;
        const wrapper = document.createElement('div');
        wrapper.className = sender === 'user' ? 'flex justify-end' : 'flex justify-start';
        const bubble = document.createElement('div');
        bubble.className = sender === 'user'
            ? 'max-w-[88%] sm:max-w-[75%] rounded-2xl rounded-br-md bg-emerald-600 px-4 py-3 text-sm text-white shadow'
            : 'max-w-[92%] sm:max-w-[78%] rounded-2xl rounded-bl-md border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-200 shadow';
        const paragraph = document.createElement('p');
        paragraph.className = 'whitespace-pre-wrap leading-relaxed';
        paragraph.textContent = engine?.repairText(text || '') || String(text || '');
        bubble.appendChild(paragraph);

        const links = Array.isArray(result.links) && result.links.length
            ? result.links
            : (result.page ? [{ page: result.page, title: result.title }] : []);
        links
            .filter((item) => item?.page && item.page !== 'asistent.html' && engine?.isPageAllowed(item.page))
            .slice(0, 8)
            .forEach((item) => {
                const link = document.createElement('a');
                link.href = item.page;
                link.className = 'mt-2 mr-2 inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/20';
                link.textContent = `Deschide ${engine.repairText(item.title || 'pagina')} →`;
                bubble.appendChild(link);
            });
        if (sender === 'assistant') {
            const actions = document.createElement('div');
            actions.className = 'mt-2 flex flex-wrap gap-2';
            (Array.isArray(result.actions) ? result.actions : [])
                .filter((item) => item?.page && item.page !== 'asistent.html' && engine?.isPageAllowed(item.page))
                .slice(0, 4)
                .forEach((item) => {
                    const link = document.createElement('a');
                    link.href = item.page;
                    link.className = 'inline-flex items-center rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-xs font-semibold text-sky-300 hover:bg-sky-500/20';
                    link.textContent = item.label || 'Deschide';
                    actions.appendChild(link);
                });
            if (result.answer && !/^Salut!|^Cu plăcere!/.test(result.answer)) {
                const feedback = document.createElement('div');
                feedback.className = 'mt-2 flex items-center gap-2 text-[11px] text-slate-500';
                feedback.textContent = 'Te-a ajutat răspunsul?';
                ['Da', 'Nu'].forEach((label, index) => {
                    const button = document.createElement('button');
                    button.type = 'button';
                    button.className = 'rounded-md border border-slate-700 px-2 py-1 text-slate-400 hover:border-emerald-500/50 hover:text-emerald-300';
                    button.textContent = index === 0 ? 'Răspuns util' : 'Nu m-a ajutat';
                    button.addEventListener('click', async () => {
                        button.disabled = true;
                        const sent = await engine.sendFeedback({ question: result.question, answer: result.answer, helpful: index === 0, page: result.page });
                        feedback.textContent = sent ? 'Mulțumesc pentru feedback!' : 'Feedbackul nu a putut fi trimis.';
                    });
                    feedback.appendChild(button);
                });
                actions.appendChild(feedback);
            }
            if (actions.childNodes.length) bubble.appendChild(actions);
        }
        wrapper.appendChild(bubble);
        chat.appendChild(wrapper);
        chat.scrollTop = chat.scrollHeight;
    }

    function showTyping() {
        const chat = document.getElementById('assistant-messages');
        const wrapper = document.createElement('div');
        const id = `assistant-typing-${++typingSequence}`;
        wrapper.id = id;
        wrapper.className = 'flex justify-start';
        wrapper.innerHTML = '<div class="rounded-2xl rounded-bl-md border border-slate-800 bg-slate-900 px-4 py-3 text-xs text-slate-400">Se caută în panel…</div>';
        chat?.appendChild(wrapper);
        if (chat) chat.scrollTop = chat.scrollHeight;
        return id;
    }

    async function submitQuestion(value) {
        const question = String(value || '').trim().slice(0, 500);
        if (!question || !engine) return;
        createMessage(question, 'user');
        const typingId = showTyping();
        await new Promise((resolve) => setTimeout(resolve, 220));
        document.getElementById(typingId)?.remove();
        try {
            const result = await engine.answer(question);
            result.question = question;
            createMessage(result.answer, 'assistant', result);
        } catch (error) {
            console.warn('Asistent: întrebarea nu a putut fi procesată.', error);
            createMessage('Nu am putut căuta informația chiar acum. Încearcă din nou sau deschide pagina sugerată din meniu.', 'assistant');
        }
    }

    function queueQuestion(value) {
        responseQueue = responseQueue.then(() => submitQuestion(value));
        return responseQueue;
    }

    function quickQuestions() {
        return [
            ['Cum pornesc pontajul?', 'pontaj.html'],
            ['Unde găsesc Runflat?', 'calculator.html'],
            ['Cum trimit o învoire?', 'cereri.html'],
            ['Ce găsesc la locații ilegale?', 'locatiiilegale.html'],
            ['Cum văd pontajele active?', 'rapoarte.html'],
            ['Cum schimb ora de închidere?', 'admin.html']
        ].filter(([, page]) => engine?.isPageAllowed(page)).map(([question]) => question);
    }

    function escapeHtml(value) {
        return String(value || '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
    }

    function renderAdminFeedback(payload) {
        const panel = document.getElementById('assistant-feedback-admin');
        const list = document.getElementById('assistant-feedback-list');
        const summary = document.getElementById('assistant-feedback-summary');
        const rows = Array.isArray(payload?.feedback) ? payload.feedback : [];
        if (!panel || !list || !summary) return;
        panel.hidden = false;
        const useful = rows.filter((item) => item.helpful).length;
        summary.textContent = `${rows.length} răspunsuri · ${useful} utile · ${rows.length - useful} neconvingătoare`;
        list.innerHTML = rows.length ? rows.map((item) => `<article class="rounded-xl border border-slate-800 bg-slate-950/60 p-3"><div class="flex flex-wrap items-center justify-between gap-2"><span class="text-xs font-semibold text-slate-200">${escapeHtml(item.author)}</span><span class="text-[10px] ${item.helpful ? 'text-emerald-400' : 'text-rose-300'}">${item.helpful ? 'Răspuns util' : 'Nu a ajutat'}</span></div><p class="mt-2 text-xs text-slate-300"><span class="text-slate-500">Întrebare:</span> ${escapeHtml(item.question)}</p><p class="mt-1 whitespace-pre-wrap text-xs text-slate-400"><span class="text-slate-500">Răspuns:</span> ${escapeHtml(item.answer)}</p><p class="mt-2 text-[10px] text-slate-600">${escapeHtml(item.page || 'fără pagină')} · ${item.created_at ? new Date(item.created_at).toLocaleString('ro-RO') : ''}</p></article>`).join('') : '<p class="text-xs text-slate-500">Nu există feedback încă.</p>';
    }

    async function loadAdminFeedback() {
        const payload = await engine?.loadFeedback();
        if (payload) renderAdminFeedback(payload);
    }

    function initialize() {
        const form = document.getElementById('assistant-form');
        if (!form || !window.PanelAssistantCore) return;
        const status = document.getElementById('assistant-index-status');
        engine = window.PanelAssistantCore.create({
            onIndexUpdate: (count) => {
                if (status) status.textContent = `${count} informații locale disponibile · acces după paginile selectate`;
            }
        });
        if (!engine) return;
        window.__panelAssistantEngine = engine;

        if (status) status.textContent = `${engine.getEntryCount()} informații locale disponibile · acces după paginile selectate`;
        engine.indexLocalPages().catch((error) => console.warn('Asistent: indexarea locală nu a fost finalizată.', error));

        const user = engine.user;
        const displayName = user.display_name || user.username || 'coleg';
        const displayNameElement = document.getElementById('user-display-name');
        const roleElement = document.getElementById('user-role');
        const avatarElement = document.getElementById('user-avatar');
        if (displayNameElement) displayNameElement.textContent = displayName;
        if (roleElement) roleElement.textContent = engine.roleName;
        if (avatarElement && user.avatar) avatarElement.src = user.avatar;
        createMessage(`Salut, ${displayName}! Sunt asistentul intern. Îți răspund doar din informațiile panelului și nu trimit întrebările către un API AI.`, 'assistant');

        const suggestions = document.getElementById('assistant-suggestions');
        quickQuestions().forEach((question) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-300 hover:border-emerald-500/50 hover:text-emerald-400 transition';
            button.textContent = question;
            button.addEventListener('click', () => queueQuestion(question));
            suggestions?.appendChild(button);
        });

        form.addEventListener('submit', (event) => {
            event.preventDefault();
            const input = document.getElementById('assistant-input');
            const value = input?.value || '';
            if (input) input.value = '';
            queueQuestion(value);
        });

        loadAdminFeedback();
        document.getElementById('assistant-feedback-refresh')?.addEventListener('click', loadAdminFeedback);

        document.getElementById('assistant-clear')?.addEventListener('click', () => {
            const messages = document.getElementById('assistant-messages');
            if (messages) messages.innerHTML = '';
            createMessage('Conversația a fost curățată. Cu ce te pot ajuta?', 'assistant');
        });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize);
    else initialize();
})();
