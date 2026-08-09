// Chat plutitor pentru toate paginile autentificate ale panelului.
(() => {
    'use strict';
    if (window.__panelAssistantWidgetLoaded || !window.PanelAssistantCore) return;

    const engine = window.PanelAssistantCore.create({ onIndexUpdate: updateStatus });
    if (!engine) return;
    window.__panelAssistantWidgetLoaded = true;

    const MAX_HISTORY = 40;
    const userId = String(engine.user.discord_id || engine.user.id || 'user').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80);
    const historyKey = `panel_assistant_history_v2_${userId}_role_${engine.role}`;
    const state = {
        open: false,
        teaserDismissed: false,
        messages: loadHistory(),
        queue: Promise.resolve(),
        typingSequence: 0
    };

    injectStyles();
    const elements = createWidget();
    renderHistory();
    renderSuggestions();
    bindEvents();
    updateStatus(engine.getEntryCount());
    engine.indexLocalPages().catch((error) => console.warn('Asistent: indexarea locală nu a fost finalizată.', error));
    watchMapSidebar();
    window.setTimeout(() => {
        state.teaserDismissed = true;
        elements.teaser.classList.add('is-hiding');
        window.setTimeout(() => { elements.teaser.hidden = true; }, 220);
    }, 3000);

    function injectStyles() {
        if (document.getElementById('panel-assistant-widget-styles')) return;
        const style = document.createElement('style');
        style.id = 'panel-assistant-widget-styles';
        style.textContent = `
            #panel-assistant-widget, #panel-assistant-widget * { box-sizing:border-box; }
            #panel-assistant-widget { position:fixed; right:max(18px, env(safe-area-inset-right)); bottom:max(18px, env(safe-area-inset-bottom)); z-index:75; width:64px; height:64px; color:#e2e8f0; color-scheme:dark; font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif; pointer-events:none; transition:bottom .2s ease; }
            body.panel-footer-visible #panel-assistant-widget { bottom:calc(var(--panel-footer-visible-height, 0px) + max(18px, env(safe-area-inset-bottom))); }
            #panel-assistant-widget.paw-map-page { z-index:1200; }
            #panel-assistant-widget.paw-map-details { right:420px; }
            #panel-assistant-widget button, #panel-assistant-widget textarea, #panel-assistant-widget a { font:inherit; }
            .paw-launcher { position:absolute; right:0; bottom:0; width:64px; height:64px; padding:0; border:2px solid rgba(167,243,208,.8); border-radius:50%; background:linear-gradient(145deg,#0f172a,#020617); cursor:pointer; pointer-events:auto; box-shadow:0 14px 34px rgba(2,6,23,.55),0 0 0 5px rgba(16,185,129,.12); transition:transform .18s ease,box-shadow .18s ease; }
            .paw-launcher:hover { transform:translateY(-3px) scale(1.03); box-shadow:0 18px 38px rgba(2,6,23,.62),0 0 0 7px rgba(16,185,129,.15); }
            .paw-launcher:focus-visible,.paw-icon-button:focus-visible,.paw-send:focus-visible,.paw-chip:focus-visible,.paw-teaser:focus-visible { outline:3px solid rgba(52,211,153,.42); outline-offset:3px; }
            .paw-launcher img { width:100%; height:100%; display:block; border-radius:50%; }
            .paw-online { position:absolute; right:1px; bottom:3px; width:15px; height:15px; border:3px solid #020617; border-radius:50%; background:#34d399; box-shadow:0 0 10px rgba(52,211,153,.75); }
            .paw-teaser { position:absolute; right:76px; bottom:7px; width:228px; padding:11px 14px; border:1px solid #334155; border-radius:16px 16px 4px 16px; background:#0f172a; color:#f8fafc; text-align:left; cursor:pointer; pointer-events:auto; box-shadow:0 14px 34px rgba(2,6,23,.52); animation:paw-arrive .3s ease-out; transition:opacity .2s ease,transform .2s ease; }
            .paw-teaser.is-hiding { opacity:0; transform:translateY(6px) scale(.97); pointer-events:none; }
            .paw-teaser strong { display:block; font-size:13px; line-height:1.35; }
            .paw-teaser span { display:block; margin-top:3px; color:#94a3b8; font-size:10px; line-height:1.3; }
            .paw-panel { position:absolute; right:0; bottom:78px; width:390px; height:min(560px,calc(100dvh - 112px)); min-height:390px; display:flex; flex-direction:column; overflow:hidden; border:1px solid #334155; border-radius:22px; background:#0b1220; pointer-events:auto; box-shadow:0 24px 70px rgba(2,6,23,.72); transform-origin:bottom right; animation:paw-open .18s ease-out; }
            .paw-panel[hidden],.paw-teaser[hidden] { display:none !important; }
            .paw-header { min-height:70px; display:flex; align-items:center; gap:11px; padding:12px 13px; border-bottom:1px solid #1e293b; background:linear-gradient(135deg,rgba(16,185,129,.14),rgba(8,145,178,.08)),#0f172a; }
            .paw-header-avatar { width:44px; height:44px; flex:none; border:1px solid rgba(167,243,208,.55); border-radius:50%; background:#020617; }
            .paw-header-copy { flex:1; min-width:0; }
            .paw-title { margin:0; color:#f8fafc; font-size:14px; font-weight:800; line-height:1.25; }
            .paw-status { margin:4px 0 0; color:#94a3b8; font-size:10px; line-height:1.2; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
            .paw-status::before { content:""; display:inline-block; width:7px; height:7px; margin-right:5px; border-radius:50%; background:#34d399; box-shadow:0 0 7px rgba(52,211,153,.65); }
            .paw-header-actions { display:flex; gap:6px; }
            .paw-icon-button { width:34px; height:34px; display:grid; place-items:center; flex:none; padding:0; border:1px solid #334155; border-radius:11px; background:#020617; color:#94a3b8; cursor:pointer; }
            .paw-icon-button:hover { border-color:#475569; color:#f8fafc; background:#172033; }
            .paw-messages { flex:1; min-height:0; overflow-y:auto; overscroll-behavior:contain; padding:16px 13px; scrollbar-width:thin; scrollbar-color:#334155 transparent; }
            .paw-message-row { display:flex; margin-bottom:12px; }
            .paw-message-row[data-sender="user"] { justify-content:flex-end; }
            .paw-message-row[data-sender="assistant"] { justify-content:flex-start; }
            .paw-bubble { max-width:88%; padding:10px 12px; border-radius:16px; font-size:12px; line-height:1.55; white-space:pre-wrap; word-break:break-word; }
            .paw-message-row[data-sender="user"] .paw-bubble { border-radius:16px 16px 4px 16px; background:#059669; color:#fff; }
            .paw-message-row[data-sender="assistant"] .paw-bubble { border:1px solid #253247; border-radius:16px 16px 16px 4px; background:#111c2e; color:#dbeafe; }
            .paw-source-link { display:inline-flex; align-items:center; gap:6px; margin-top:9px; padding:7px 9px; border:1px solid rgba(52,211,153,.3); border-radius:10px; background:rgba(16,185,129,.1); color:#6ee7b7; font-size:10px; font-weight:700; text-decoration:none; }
            .paw-source-link:hover { background:rgba(16,185,129,.18); }
            .paw-typing { display:inline-flex; align-items:center; gap:4px; min-width:48px; }
            .paw-typing i { width:5px; height:5px; border-radius:50%; background:#94a3b8; animation:paw-dot 1s infinite ease-in-out; }
            .paw-typing i:nth-child(2) { animation-delay:.15s; }.paw-typing i:nth-child(3) { animation-delay:.3s; }
            .paw-suggestions { display:flex; gap:7px; padding:10px 12px 5px; overflow-x:auto; scrollbar-width:none; border-top:1px solid #1e293b; background:#0f172a; }
            .paw-suggestions::-webkit-scrollbar { display:none; }
            .paw-chip { flex:none; padding:7px 9px; border:1px solid #334155; border-radius:999px; background:#111c2e; color:#cbd5e1; cursor:pointer; font-size:10px; white-space:nowrap; }
            .paw-chip:hover { border-color:rgba(52,211,153,.55); color:#6ee7b7; }
            .paw-form { display:flex; align-items:flex-end; gap:8px; padding:9px 11px 10px; background:#0f172a; }
            .paw-input { flex:1; min-width:0; max-height:86px; resize:none; overflow-y:auto; padding:10px 11px; border:1px solid #334155; border-radius:13px; outline:none; background:#020617; color:#f8fafc; font-size:12px; line-height:1.4; }
            .paw-input::placeholder { color:#64748b; }.paw-input:focus { border-color:#10b981; box-shadow:0 0 0 3px rgba(16,185,129,.1); }
            .paw-send { width:42px; height:42px; display:grid; place-items:center; flex:none; padding:0; border:0; border-radius:13px; background:#059669; color:#fff; cursor:pointer; }
            .paw-send:hover { background:#10b981; }.paw-send:disabled { opacity:.55; cursor:not-allowed; }
            .paw-footnote { margin:0; padding:0 12px 10px; background:#0f172a; color:#526176; font-size:9px; text-align:center; }
            @keyframes paw-arrive { from { opacity:0; transform:translateY(8px) scale(.96); } to { opacity:1; transform:none; } }
            @keyframes paw-open { from { opacity:0; transform:translateY(12px) scale(.96); } to { opacity:1; transform:none; } }
            @keyframes paw-dot { 0%,60%,100% { transform:translateY(0); opacity:.45; } 30% { transform:translateY(-3px); opacity:1; } }
            @media (max-width:520px) {
                #panel-assistant-widget { right:max(10px,env(safe-area-inset-right)); bottom:max(10px,env(safe-area-inset-bottom)); }
                #panel-assistant-widget.paw-map-details { right:max(10px,env(safe-area-inset-right)); visibility:hidden; }
                .paw-launcher { width:58px; height:58px; }
                .paw-teaser { right:68px; bottom:5px; width:min(220px,calc(100vw - 90px)); }
                .paw-panel { right:0; bottom:70px; width:calc(100vw - 20px); height:min(560px,calc(100dvh - 150px)); min-height:320px; border-radius:18px; }
                .paw-header { min-height:64px; padding:10px 11px; }
                .paw-header-avatar { width:40px; height:40px; }
                .paw-messages { padding:13px 11px; }
            }
            @media (prefers-reduced-motion:reduce) { .paw-launcher,.paw-panel,.paw-teaser,.paw-typing i { animation:none !important; transition:none !important; } }
        `;
        document.head.appendChild(style);
    }

    function createWidget() {
        const root = document.createElement('section');
        root.id = 'panel-assistant-widget';
        root.setAttribute('aria-label', 'Asistentul panelului');
        if (document.getElementById('map-container-wrapper')) root.classList.add('paw-map-page');
        root.innerHTML = `
            <button type="button" class="paw-teaser" aria-label="Deschide asistentul">
                <strong>Cu ce te pot ajuta astăzi?</strong>
                <span>Întreabă-mă orice despre panel.</span>
            </button>
            <div class="paw-panel" id="panel-assistant-chat" role="dialog" aria-label="Chat cu asistentul" hidden>
                <div class="paw-header">
                    <img class="paw-header-avatar" src="css/robot-assistant.svg" alt="Avatar asistent robot">
                    <div class="paw-header-copy"><p class="paw-title">Asistent Panel</p><p class="paw-status">Local · rol Discord: ${engine.roleName || 'rolul tău'}</p></div>
                    <div class="paw-header-actions">
                        <button type="button" class="paw-icon-button paw-clear" aria-label="Curăță conversația" title="Curăță conversația">⌫</button>
                        <button type="button" class="paw-icon-button paw-minimize" aria-label="Minimizează chatul" title="Minimizează">—</button>
                    </div>
                </div>
                <div class="paw-messages" aria-live="polite"></div>
                <div class="paw-suggestions" aria-label="Întrebări rapide"></div>
                <form class="paw-form">
                    <textarea class="paw-input" rows="1" maxlength="500" aria-label="Scrie întrebarea" placeholder="Scrie o întrebare…"></textarea>
                    <button type="submit" class="paw-send" aria-label="Trimite întrebarea" title="Trimite">
                        <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true"><path fill="currentColor" d="m3.4 20.4 17.45-7.48a1 1 0 0 0 0-1.84L3.4 3.6a.95.95 0 0 0-1.3 1.06l1.25 5.47 9.1 1.87-9.1 1.87-1.25 5.47a.95.95 0 0 0 1.3 1.06Z"/></svg>
                    </button>
                </form>
                <p class="paw-footnote">Răspunsuri locale · fără API AI și fără cost lunar</p>
            </div>
            <button type="button" class="paw-launcher" aria-label="Deschide asistentul" aria-controls="panel-assistant-chat" aria-expanded="false">
                <img src="css/robot-assistant.svg" alt="Avatar asistent robot"><span class="paw-online" aria-hidden="true"></span>
            </button>
        `;
        document.body.appendChild(root);
        return {
            root,
            teaser: root.querySelector('.paw-teaser'),
            panel: root.querySelector('.paw-panel'),
            launcher: root.querySelector('.paw-launcher'),
            minimize: root.querySelector('.paw-minimize'),
            clear: root.querySelector('.paw-clear'),
            messages: root.querySelector('.paw-messages'),
            suggestions: root.querySelector('.paw-suggestions'),
            form: root.querySelector('.paw-form'),
            input: root.querySelector('.paw-input'),
            send: root.querySelector('.paw-send'),
            status: root.querySelector('.paw-status')
        };
    }

    function updateStatus(count) {
        const status = document.querySelector('#panel-assistant-widget .paw-status');
        const roleLabel = String(engine?.roleName || '').trim() || 'Rol Discord indisponibil';
        if (status) status.textContent = `Local · ${count} informații · rol Discord: ${roleLabel}`;
    }

    function loadHistory() {
        try {
            const stored = JSON.parse(sessionStorage.getItem(historyKey) || '[]');
            if (!Array.isArray(stored)) return [];
            return stored
                .filter((message) => ['user', 'assistant'].includes(message?.sender) && typeof message.text === 'string')
                .slice(-MAX_HISTORY)
                .map((message) => ({
                    sender: message.sender,
                    text: engine.repairText(message.text).slice(0, 1200),
                    page: engine.isPageAllowed(message.page) && message.page !== 'asistent.html' ? message.page : '',
                    title: engine.repairText(message.title || '').slice(0, 120)
                }));
        } catch (_error) {
            return [];
        }
    }

    function saveHistory() {
        try {
            sessionStorage.setItem(historyKey, JSON.stringify(state.messages.slice(-MAX_HISTORY)));
        } catch (_error) {
            // Chatul rămâne funcțional chiar dacă stocarea este blocată.
        }
    }

    function welcomeMessage() {
        const name = engine.user.display_name || engine.user.username || 'coleg';
        return `Salut, ${name}! Cu ce te pot ajuta astăzi? Îți răspund numai din informațiile panelului disponibile rolului tău.`;
    }

    function renderHistory() {
        if (!state.messages.length) state.messages.push({ sender: 'assistant', text: welcomeMessage(), page: '', title: '' });
        elements.messages.innerHTML = '';
        state.messages.forEach((message) => renderMessage(message));
        saveHistory();
        scrollMessages();
    }

    function renderMessage(message) {
        const row = document.createElement('div');
        row.className = 'paw-message-row';
        row.dataset.sender = message.sender;
        const bubble = document.createElement('div');
        bubble.className = 'paw-bubble';
        const text = document.createElement('span');
        text.textContent = engine.repairText(message.text);
        bubble.appendChild(text);

        if (message.page && message.page !== 'asistent.html' && engine.isPageAllowed(message.page)) {
            const link = document.createElement('a');
            link.className = 'paw-source-link';
            link.href = message.page;
            link.textContent = `Deschide ${engine.repairText(message.title || 'pagina')} →`;
            bubble.appendChild(document.createElement('br'));
            bubble.appendChild(link);
        }
        row.appendChild(bubble);
        elements.messages.appendChild(row);
    }

    function addMessage(message, persist = true) {
        const safeMessage = {
            sender: message.sender === 'user' ? 'user' : 'assistant',
            text: String(message.text || '').slice(0, 1200),
            page: engine.isPageAllowed(message.page) && message.page !== 'asistent.html' ? message.page : '',
            title: String(message.title || '').slice(0, 120)
        };
        state.messages.push(safeMessage);
        state.messages = state.messages.slice(-MAX_HISTORY);
        renderMessage(safeMessage);
        if (persist) saveHistory();
        scrollMessages();
    }

    function showTyping() {
        const row = document.createElement('div');
        const id = `paw-typing-${++state.typingSequence}`;
        row.id = id;
        row.className = 'paw-message-row';
        row.dataset.sender = 'assistant';
        row.innerHTML = '<div class="paw-bubble"><span class="paw-typing" aria-label="Asistentul caută"><i></i><i></i><i></i></span></div>';
        elements.messages.appendChild(row);
        scrollMessages();
        return id;
    }

    function scrollMessages() {
        elements.messages.scrollTop = elements.messages.scrollHeight;
    }

    function setOpen(open) {
        state.open = Boolean(open);
        elements.panel.hidden = !state.open;
        elements.teaser.hidden = state.open || state.teaserDismissed;
        elements.launcher.setAttribute('aria-expanded', String(state.open));
        elements.launcher.setAttribute('aria-label', state.open ? 'Chatul este deschis' : 'Deschide asistentul');
        if (state.open) {
            requestAnimationFrame(() => {
                scrollMessages();
                elements.input.focus({ preventScroll: true });
            });
        }
    }

    async function answerQuestion(value) {
        const question = String(value || '').trim().slice(0, 500);
        if (!question) return;
        addMessage({ sender: 'user', text: question });
        const typingId = showTyping();
        await new Promise((resolve) => setTimeout(resolve, 220));
        document.getElementById(typingId)?.remove();
        const result = engine.answer(question);
        addMessage({ sender: 'assistant', text: result.answer, page: result.page, title: result.title });
    }

    function queueQuestion(value) {
        state.queue = state.queue.then(() => answerQuestion(value));
        return state.queue;
    }

    function suggestionsForRole() {
        const questions = ['Cum pornesc pontajul?', 'Unde găsesc Runflat?', 'Cum trimit o învoire?'];
        if (engine.role >= 3) questions.push('Unde se procesează cocaina?');
        if (engine.role >= 4) questions.push('Cine este pontat acum?');
        if (engine.role >= 7) questions.push('Cum schimb ora de închidere?');
        return questions;
    }

    function renderSuggestions() {
        suggestionsForRole().forEach((question) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'paw-chip';
            button.textContent = question;
            button.addEventListener('click', () => queueQuestion(question));
            elements.suggestions.appendChild(button);
        });
    }

    function bindEvents() {
        elements.launcher.addEventListener('click', () => setOpen(!state.open));
        elements.teaser.addEventListener('click', () => setOpen(true));
        elements.minimize.addEventListener('click', () => setOpen(false));
        elements.clear.addEventListener('click', () => {
            state.messages = [{ sender: 'assistant', text: welcomeMessage(), page: '', title: '' }];
            renderHistory();
        });
        elements.form.addEventListener('submit', (event) => {
            event.preventDefault();
            const value = elements.input.value;
            elements.input.value = '';
            elements.input.style.height = '';
            queueQuestion(value);
        });
        elements.input.addEventListener('input', () => {
            elements.input.style.height = 'auto';
            elements.input.style.height = `${Math.min(elements.input.scrollHeight, 86)}px`;
        });
        elements.input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                elements.form.requestSubmit();
            }
        });
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && state.open) setOpen(false);
        });
        document.addEventListener('click', (event) => {
            if (event.target.closest?.('[aria-label="Deschide meniul"]')) setOpen(false);
        }, true);
        document.addEventListener('panel:mobile-menu-open', () => setOpen(false));
    }

    function watchMapSidebar() {
        const mapSidebar = document.getElementById('sidebar');
        if (!mapSidebar || !elements.root.classList.contains('paw-map-page')) return;
        const sync = () => elements.root.classList.toggle('paw-map-details', mapSidebar.classList.contains('open'));
        sync();
        new MutationObserver(sync).observe(mapSidebar, { attributes: true, attributeFilter: ['class'] });
    }
})();
