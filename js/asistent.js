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

        if (result.page && result.page !== 'asistent.html' && engine?.isPageAllowed(result.page)) {
            const link = document.createElement('a');
            link.href = result.page;
            link.className = 'mt-3 inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/20';
            link.textContent = `Deschide ${engine.repairText(result.title || 'pagina')} →`;
            bubble.appendChild(link);
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
        const result = engine.answer(question);
        createMessage(result.answer, 'assistant', result);
    }

    function queueQuestion(value) {
        responseQueue = responseQueue.then(() => submitQuestion(value));
        return responseQueue;
    }

    function quickQuestions() {
        const questions = ['Cum pornesc pontajul?', 'Unde găsesc Runflat?', 'Cum trimit o învoire?'];
        if (engine.role >= 3) questions.push('Ce găsesc la locații ilegale?');
        if (engine.role >= 4) questions.push('Cum văd pontajele active?');
        if (engine.role >= 7) questions.push('Cum schimb ora de închidere?');
        return questions;
    }

    function initialize() {
        const form = document.getElementById('assistant-form');
        if (!form || !window.PanelAssistantCore) return;
        const status = document.getElementById('assistant-index-status');
        engine = window.PanelAssistantCore.create({
            onIndexUpdate: (count) => {
                if (status) status.textContent = `${count} informații locale disponibile · acces nivel ${engine?.role || 0}`;
            }
        });
        if (!engine) return;

        if (status) status.textContent = `${engine.getEntryCount()} informații locale disponibile · acces nivel ${engine.role}`;
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

        document.getElementById('assistant-clear')?.addEventListener('click', () => {
            const messages = document.getElementById('assistant-messages');
            if (messages) messages.innerHTML = '';
            createMessage('Conversația a fost curățată. Cu ce te pot ajuta?', 'assistant');
        });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize);
    else initialize();
})();
