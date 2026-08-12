(() => {
    'use strict';

    if (window.__panelOnboardingLoaded) return;
    window.__panelOnboardingLoaded = true;

    const TOUR_VERSION = '1.0.0';
    const STORAGE_KEY = 'panel_onboarding_version';
    const steps = [
        { target: '#panel-shared-sidebar', title: 'Bun venit în Panel', text: 'Aici găsești meniul principal. Vei vedea doar paginile permise pentru rolul tău Discord și organizația activă.' },
        { target: 'a[href$="pontaj.html"]', title: 'Pontajul', text: 'Din Pontaj pornești, pui pe pauză și închei turele. Istoricul și totalul orelor se păstrează automat.' },
        { target: 'a[href$="cereri.html"]', title: 'Învoiri și concedii', text: 'De aici trimiți cereri pentru învoire, concediu sau alte absențe, iar statusul lor poate fi urmărit.' },
        { target: 'a[href$="marketplace.html"], a[href$="marketplace-ilegal.html"]', title: 'Marketplace și resurse', text: 'Marketplace-ul și resursele organizației sunt disponibile în funcție de rolurile configurate de administratori.' },
        { target: '#panel-sidebar-profile, #panel-user-role', title: 'Rolul tău', text: 'Rolul este citit din Discord. Nu îl alegi manual, iar accesul se actualizează când rolurile Discord se schimbă.' }
    ];

    const readUser = () => {
        try { return JSON.parse(localStorage.getItem('discord_user') || 'null'); }
        catch (_) { return null; }
    };

    const shouldShow = () => {
        const page = window.location.pathname.split('/').pop() || 'index.html';
        if (['login.html', '403.html', 'guest.html'].includes(page)) return false;
        if (!readUser() || !localStorage.getItem('discord_access_token')) return false;
        return localStorage.getItem(STORAGE_KEY) !== TOUR_VERSION;
    };

    function addStyles() {
        if (document.getElementById('panel-onboarding-styles')) return;
        const style = document.createElement('style');
        style.id = 'panel-onboarding-styles';
        style.textContent = `
            .panel-onboarding-overlay { position:fixed; inset:0; z-index:10000; background:rgba(2,6,23,.72); backdrop-filter:blur(2px); }
            .panel-onboarding-card { position:fixed; left:50%; bottom:28px; transform:translateX(-50%); width:min(460px,calc(100vw - 28px)); padding:22px; border:1px solid rgba(52,211,153,.42); border-radius:20px; background:#0b1526; color:#e2e8f0; box-shadow:0 24px 80px rgba(0,0,0,.55); }
            .panel-onboarding-card h2 { margin:5px 0 8px; color:#f8fafc; font-size:20px; font-weight:800; }
            .panel-onboarding-card p { margin:0; color:#a8b5c7; font-size:13px; line-height:1.6; }
            .panel-onboarding-eyebrow { color:#6ee7b7; font-size:10px; font-weight:900; letter-spacing:.16em; text-transform:uppercase; }
            .panel-onboarding-progress { height:4px; margin:18px 0 16px; overflow:hidden; border-radius:99px; background:#1e293b; }
            .panel-onboarding-progress span { display:block; height:100%; border-radius:inherit; background:linear-gradient(90deg,#10b981,#38bdf8); transition:width .2s ease; }
            .panel-onboarding-actions { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-top:18px; }
            .panel-onboarding-actions button { border:1px solid #334155; border-radius:10px; padding:9px 13px; color:#cbd5e1; background:#111c2e; font-size:12px; font-weight:800; cursor:pointer; }
            .panel-onboarding-actions button:hover { border-color:#10b981; }
            .panel-onboarding-actions button[data-onboarding-next] { border-color:#059669; background:#047857; color:#ecfdf5; }
            .panel-onboarding-focus { position:fixed; z-index:10001; pointer-events:none; border:2px solid #6ee7b7; border-radius:12px; box-shadow:0 0 0 5px rgba(16,185,129,.2),0 0 34px rgba(16,185,129,.42); transition:all .2s ease; }
            @media (max-width:640px) { .panel-onboarding-card { bottom:14px; padding:18px; } .panel-onboarding-card h2 { font-size:18px; } }
        `;
        document.head.appendChild(style);
    }

    function finishTour() {
        localStorage.setItem(STORAGE_KEY, TOUR_VERSION);
        document.querySelector('.panel-onboarding-overlay')?.remove();
        document.querySelector('.panel-onboarding-focus')?.remove();
        if (typeof window.refreshLegacyPlatformAdmin === 'function' && localStorage.getItem('discord_access_token')) {
            Promise.resolve(window.refreshLegacyPlatformAdmin(true))
                .then(() => {
                    window.dispatchEvent(new CustomEvent('panel-user-updated'));
                    if (typeof window.applyRoleBasedVisibility === 'function') window.applyRoleBasedVisibility();
                })
                .catch(() => undefined);
        }
    }

    function createTour() {
        const availableSteps = steps.filter(step => !step.target || document.querySelector(step.target));
        if (!availableSteps.length) return;
        let index = 0;
        const overlay = document.createElement('div');
        overlay.className = 'panel-onboarding-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-label', 'Tutorial Panel');
        overlay.innerHTML = `
            <div class="panel-onboarding-card">
                <div class="panel-onboarding-eyebrow">Tutorial de început · Panel Pro</div>
                <h2 data-onboarding-title></h2>
                <p data-onboarding-text></p>
                <div class="panel-onboarding-progress"><span data-onboarding-progress></span></div>
                <div class="panel-onboarding-actions">
                    <button type="button" data-onboarding-skip>Omite tutorialul</button>
                    <div style="display:flex;gap:8px"><button type="button" data-onboarding-back>Înapoi</button><button type="button" data-onboarding-next>Următorul</button></div>
                </div>
            </div>`;
        document.body.appendChild(overlay);

        const focus = document.createElement('div');
        focus.className = 'panel-onboarding-focus';
        focus.setAttribute('aria-hidden', 'true');
        document.body.appendChild(focus);
        const title = overlay.querySelector('[data-onboarding-title]');
        const text = overlay.querySelector('[data-onboarding-text]');
        const progress = overlay.querySelector('[data-onboarding-progress]');
        const back = overlay.querySelector('[data-onboarding-back]');
        const next = overlay.querySelector('[data-onboarding-next]');

        const render = () => {
            const step = availableSteps[index];
            title.textContent = step.title;
            text.textContent = step.text;
            progress.style.width = `${((index + 1) / availableSteps.length) * 100}%`;
            back.disabled = index === 0;
            back.style.opacity = index === 0 ? '.45' : '1';
            next.textContent = index === availableSteps.length - 1 ? 'Începe utilizarea' : 'Următorul';
            const target = step.target ? document.querySelector(step.target) : null;
            if (!target) { focus.style.display = 'none'; return; }
            target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
            const rect = target.getBoundingClientRect();
            focus.style.display = 'block';
            focus.style.top = `${Math.max(6, rect.top - 5)}px`;
            focus.style.left = `${Math.max(6, rect.left - 5)}px`;
            focus.style.width = `${Math.max(10, rect.width + 10)}px`;
            focus.style.height = `${Math.max(10, rect.height + 10)}px`;
        };

        overlay.querySelector('[data-onboarding-skip]').addEventListener('click', finishTour);
        back.addEventListener('click', () => { if (index > 0) { index -= 1; render(); } });
        next.addEventListener('click', () => { if (index >= availableSteps.length - 1) finishTour(); else { index += 1; render(); } });
        window.addEventListener('resize', render);
        render();
    }

    window.replayPanelOnboarding = () => { localStorage.removeItem(STORAGE_KEY); window.location.reload(); };

    function init() {
        if (!shouldShow()) return;
        addStyles();
        window.setTimeout(createTour, 450);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
    else init();
})();
