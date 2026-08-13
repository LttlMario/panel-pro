Exit code: 0
Wall time: 1.1 seconds
Output:
(() => {
    'use strict';

    if (window.__panelOnboardingLoaded) return;
    window.__panelOnboardingLoaded = true;

    const page = window.location.pathname.split('/').pop() || 'index.html';
    if (['login.html', '403.html', 'guest.html', 'organizatie-noua.html', 'creare-organizatie-voucher.html'].includes(page)) return;

    const COMPLETE_KEY = 'panel_tutorial_completed_v2';
    const STATE_KEY = 'panel_tutorial_state_v2';
    const user = (() => {
        try { return JSON.parse(localStorage.getItem('discord_user') || 'null'); } catch (_) { return null; }
    })();

    if (!user || localStorage.getItem(COMPLETE_KEY) === '1') return;

    const steps = [
        { page: 'index.html', selector: '#dashboard-pontaj-button, main', title: 'Dashboard-ul tÄƒu', text: 'Aici vezi rapid starea turei, urmÄƒtoarea Ã®nvoire È™i scurtÄƒturile cÄƒtre funcÈ›iile importante ale organizaÈ›iei.' },
        { page: 'pontaj.html', selector: '#btn-start, main', title: 'Pontaj', text: 'Din Pontaj alegi tura de zi sau de noapte, apoi porneÈ™ti, pui pauzÄƒ È™i Ã®nchizi pontajul. Tura rÄƒmÃ¢ne salvatÄƒ È™i dupÄƒ refresh.' },
        { page: 'cereri.html', selector: '#absence-form, main', title: 'ÃŽnvoiri È™i concedii', text: 'Aici trimiÈ›i cereri pentru Ã®nvoire, concediu sau absenÈ›Äƒ medicalÄƒ. Completezi perioada È™i motivul, iar administraÈ›ia poate procesa cererea.' },
        { page: 'bucatarie.html', selector: '#galleryGrid, main', title: 'Resursele organizaÈ›iei', text: 'ÃŽn funcÈ›ie de rolul tÄƒu, aici gÄƒseÈ™ti resursele È™i informaÈ›iile configurate de organizaÈ›ie, cum ar fi bucÄƒtÄƒria, calculatorul sau alte module.' },
        { page: 'rapoarte.html', selector: '#personal-shift-panel, main', title: 'Rapoarte È™i istoricul', text: 'ÃŽn Rapoarte poÈ›i vedea istoricul pontajelor È™i, dacÄƒ rolul tÄƒu permite, informaÈ›iile generale ale organizaÈ›iei.' }
    ];

    function isPlatformAdmin() {
        return String(user.discord_id || '') === '247012210021236738' || user.platform_admin === true || user.is_platform_admin === true;
    }

    function canUsePage(targetPage) {
        if (isPlatformAdmin()) return true;
        if (targetPage === 'index.html' || targetPage === 'pontaj.html') return true;
        return Array.isArray(user.allowed_pages) && user.allowed_pages.map(String).includes(targetPage);
    }

    const availableSteps = steps.filter(step => canUsePage(step.page));
    if (!availableSteps.length) return;

    function readState() {
        try {
            const state = JSON.parse(localStorage.getItem(STATE_KEY) || 'null');
            return state && Number.isInteger(state.index) ? state : { index: 0 };
        } catch (_) { return { index: 0 }; }
    }

    function writeState(index) { localStorage.setItem(STATE_KEY, JSON.stringify({ index })); }

    function finishTutorial() {
        localStorage.setItem(COMPLETE_KEY, '1');
        localStorage.removeItem(STATE_KEY);
        document.getElementById('panel-onboarding-root')?.remove();
    }

    function addStyles() {
        if (document.getElementById('panel-onboarding-styles')) return;
        const style = document.createElement('style');
        style.id = 'panel-onboarding-styles';
        style.textContent = `
            #panel-onboarding-root { position:fixed; inset:0; z-index:2147483000; pointer-events:none; font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif; }
            #panel-onboarding-root .panel-tour-dim { position:fixed; background:rgba(2,6,23,.78); pointer-events:auto; }
            #panel-onboarding-root .panel-tour-highlight { position:fixed; border:2px solid rgba(52,211,153,.95); border-radius:16px; box-shadow:0 0 0 5px rgba(52,211,153,.16),0 0 28px rgba(16,185,129,.28); pointer-events:none; transition:all .2s ease; }
            #panel-onboarding-root .panel-tour-card { position:fixed; left:50%; width:min(440px,calc(100vw - 32px)); transform:translateX(-50%); padding:20px; border:1px solid rgba(71,85,105,.9); border-radius:20px; background:#0f172a; color:#e2e8f0; box-shadow:0 22px 70px rgba(0,0,0,.5); pointer-events:auto; }
            #panel-onboarding-root .panel-tour-eyebrow { color:#6ee7b7; font-size:10px; font-weight:800; letter-spacing:.14em; text-transform:uppercase; }
            #panel-onboarding-root .panel-tour-title { margin:7px 0 0; color:#f8fafc; font-size:20px; font-weight:800; }
            #panel-onboarding-root .panel-tour-text { margin:9px 0 0; color:#cbd5e1; font-size:13px; line-height:1.65; }
            #panel-onboarding-root .panel-tour-actions { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-top:18px; }
            #panel-onboarding-root button { border:0; border-radius:10px; cursor:pointer; font:inherit; }
            #panel-onboarding-root .panel-tour-skip { padding:9px 0; color:#94a3b8; background:transparent; font-size:12px; }
            #panel-onboarding-root .panel-tour-prev { padding:9px 12px; color:#cbd5e1; background:#1e293b; font-size:12px; }
            #panel-onboarding-root .panel-tour-next { padding:10px 15px; color:#052e16; background:#34d399; font-size:12px; font-weight:800; }
            #panel-onboarding-root .panel-tour-next:hover { background:#6ee7b7; }
            @media (max-width:520px) { #panel-onboarding-root .panel-tour-card { bottom:12px !important; padding:17px; } #panel-onboarding-root .panel-tour-title { font-size:18px; } }
        `;
        document.head.appendChild(style);
    }

    function createRoot() {
        const root = document.createElement('div');
        root.id = 'panel-onboarding-root';
        root.innerHTML = `
            <div class="panel-tour-dim" data-dim="top"></div><div class="panel-tour-dim" data-dim="left"></div>
            <div class="panel-tour-dim" data-dim="right"></div><div class="panel-tour-dim" data-dim="bottom"></div>
            <div class="panel-tour-highlight"></div>
            <section class="panel-tour-card" role="dialog" aria-modal="true" aria-labelledby="panel-tour-title">
                <div class="panel-tour-eyebrow"></div><h2 id="panel-tour-title" class="panel-tour-title"></h2><p class="panel-tour-text"></p>
                <div class="panel-tour-actions"><button type="button" class="panel-tour-skip">Omite tutorialul</button><div class="flex items-center gap-2"><button type="button" class="panel-tour-prev">ÃŽnapoi</button><button type="button" class="panel-tour-next">UrmÄƒtorul pas</button></div></div>
            </section>`;
        document.body.appendChild(root);
        return root;
    }

    function setDimmer(root, rect) {
        const width = window.innerWidth, height = window.innerHeight, padding = 7;
        const x = Math.max(0, rect.left - padding), y = Math.max(0, rect.top - padding);
        const rightX = Math.min(width, rect.right + padding), bottomY = Math.min(height, rect.bottom + padding);
        Object.assign(root.querySelector('[data-dim="top"]').style, { left:'0', top:'0', width:'100%', height:`${y}px` });
        Object.assign(root.querySelector('[data-dim="left"]').style, { left:'0', top:`${y}px`, width:`${x}px`, height:`${Math.max(0, bottomY - y)}px` });
        Object.assign(root.querySelector('[data-dim="right"]').style, { left:`${rightX}px`, top:`${y}px`, width:`${Math.max(0, width - rightX)}px`, height:`${Math.max(0, bottomY - y)}px` });
        Object.assign(root.querySelector('[data-dim="bottom"]').style, { left:'0', top:`${bottomY}px`, width:'100%', height:`${Math.max(0, height - bottomY)}px` });
    }

    function showStep(root, index) {
        const step = availableSteps[index];
        if (!step) return finishTutorial();
        writeState(index);
        if (step.page !== page) { window.location.href = step.page; return; }
        const target = document.querySelector(step.selector) || document.querySelector('main') || document.body;
        target.scrollIntoView?.({ behavior:'smooth', block:'center' });
        window.setTimeout(() => {
            const rect = target.getBoundingClientRect();
            Object.assign(root.querySelector('.panel-tour-highlight').style, { left:`${Math.max(4, rect.left - 7)}px`, top:`${Math.max(4, rect.top - 7)}px`, width:`${Math.min(window.innerWidth - 8, rect.width + 14)}px`, height:`${Math.min(window.innerHeight - 8, rect.height + 14)}px` });
            setDimmer(root, rect);
            root.querySelector('.panel-tour-eyebrow').textContent = `Ghid rapid Â· ${index + 1}/${availableSteps.length}`;
            root.querySelector('.panel-tour-title').textContent = step.title;
            root.querySelector('.panel-tour-text').textContent = step.text;
            root.querySelector('.panel-tour-prev').style.visibility = index > 0 ? 'visible' : 'hidden';
            root.querySelector('.panel-tour-next').textContent = index === availableSteps.length - 1 ? 'ÃŽncheie' : 'UrmÄƒtorul pas';
            const card = root.querySelector('.panel-tour-card'), cardHeight = card.offsetHeight || 220;
            card.style.top = rect.top > window.innerHeight * .55 ? '20px' : `calc(100vh - ${cardHeight + 20}px)`;
        }, 160);
    }

    function start() {
        addStyles();
        const root = createRoot();
        let state = readState();
        const currentIndex = availableSteps.findIndex(step => step.page === page);
        if (currentIndex >= 0 && !localStorage.getItem(STATE_KEY)) state.index = currentIndex;
        root.querySelector('.panel-tour-skip').addEventListener('click', finishTutorial);
        root.querySelector('.panel-tour-next').addEventListener('click', () => { if (state.index >= availableSteps.length - 1) return finishTutorial(); state.index += 1; showStep(root, state.index); });
        root.querySelector('.panel-tour-prev').addEventListener('click', () => { if (state.index <= 0) return; state.index -= 1; showStep(root, state.index); });
        window.addEventListener('resize', () => showStep(root, state.index));
        showStep(root, state.index);
    }

    window.resetPanelTutorial = () => { localStorage.removeItem(COMPLETE_KEY); localStorage.removeItem(STATE_KEY); window.location.reload(); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true }); else start();
})();

