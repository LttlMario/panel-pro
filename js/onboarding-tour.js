(() => {
    'use strict';

    if (window.__panelOnboardingLoaded) return;
    window.__panelOnboardingLoaded = true;

  const TOUR_VERSION = '1.1.0';
    const STORAGE_KEY = 'panel_onboarding_version';
    const STEP_KEY = 'panel_onboarding_step';
    const steps = [
        { target: '#panel-shared-sidebar', title: 'Bun venit în Panel', text: 'Aici găsești meniul principal. Vei vedea doar paginile permise pentru rolul tău Discord și organizația activă.' },
        { page: 'pontaj.html', nav: 'a[href$="pontaj.html"]', target: '#btn-start', label: 'Deschide Pontajul', title: 'Pontajul', text: 'Aceasta este pagina de Pontaj. De aici pornești, pui pe pauză și închei turele. Istoricul și totalul orelor se păstrează automat.' },
        { page: 'cereri.html', nav: 'a[href$="cereri.html"]', target: '#absence-form', label: 'Deschide Învoirile', title: 'Învoiri și concedii', text: 'Aici trimiți cereri pentru învoire, concediu sau alte absențe. Pagina afișează și statusul cererilor tale.' },
        { page: 'marketplace.html', nav: 'a[href$="marketplace.html"], a[href$="marketplace-ilegal.html"]', target: '#marketForm', label: 'Deschide Marketplace-ul', title: 'Marketplace și resurse', text: 'Aici găsești anunțurile și resursele organizației. Ce poți vedea sau modifica depinde de rolul tău Discord.' },
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
            .panel-onboarding-overlay { position:fixed; inset:0; z-index:10000; pointer-events:none; }
            .panel-onboarding-shade { position:fixed; background:rgba(2,6,23,.68); pointer-events:auto; }
            .panel-onboarding-card { position:fixed; z-index:3; left:50%; bottom:28px; transform:translateX(-50%); width:min(460px,calc(100vw - 28px)); padding:22px; border:1px solid rgba(52,211,153,.42); border-radius:20px; background:#0b1526; color:#e2e8f0; box-shadow:0 24px 80px rgba(0,0,0,.55); pointer-events:auto; }
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
        localStorage.removeItem(STEP_KEY);
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
        const currentPage = window.location.pathname.split('/').pop() || 'index.html';
        const availableSteps = steps.filter(step => !step.page || currentPage === step.page || document.querySelector(step.nav));
        if (!availableSteps.length) return;
        let index = Math.min(Math.max(Number(localStorage.getItem(STEP_KEY) || 0), 0), availableSteps.length - 1);
        const pendingStep = availableSteps[index];
        if (pendingStep?.page && pendingStep.page !== currentPage) {
            window.location.href = pendingStep.page;
            return;
        }
        const overlay = document.createElement('div');
        overlay.className = 'panel-onboarding-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-label', 'Tutorial Panel');
        overlay.innerHTML = `
            <div class="panel-onboarding-shade" data-onboarding-shade="top"></div>
            <div class="panel-onboarding-shade" data-onboarding-shade="right"></div>
            <div class="panel-onboarding-shade" data-onboarding-shade="bottom"></div>
            <div class="panel-onboarding-shade" data-onboarding-shade="left"></div>
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
        const shades = {
            top: overlay.querySelector('[data-onboarding-shade="top"]'),
            right: overlay.querySelector('[data-onboarding-shade="right"]'),
            bottom: overlay.querySelector('[data-onboarding-shade="bottom"]'),
            left: overlay.querySelector('[data-onboarding-shade="left"]')
        };

        const goToStep = (nextIndex) => {
            const nextStep = availableSteps[nextIndex];
            if (!nextStep) return;
            localStorage.setItem(STEP_KEY, String(nextIndex));
            if (nextStep.page && nextStep.page !== currentPage) {
                window.location.href = nextStep.page;
                return;
            }
            index = nextIndex;
            render();
        };

        const render = () => {
            const step = availableSteps[index];
            title.textContent = step.title;
            text.textContent = step.text;
            progress.style.width = `${((index + 1) / availableSteps.length) * 100}%`;
            back.disabled = index === 0;
            back.style.opacity = index === 0 ? '.45' : '1';
            next.textContent = index === availableSteps.length - 1 ? 'Începe utilizarea' : 'Următorul';
            const following = availableSteps[index + 1];
            if (following?.page && following.page !== currentPage) next.textContent = following.label || 'Deschide pagina';
            const target = step.target ? document.querySelector(step.target) : null;
            if (!target) {
                focus.style.display = 'none';
                shades.top.style.cssText = 'inset:0';
                shades.right.style.display = 'none';
                shades.bottom.style.display = 'none';
                shades.left.style.display = 'none';
                return;
            }
            target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
            const rect = target.getBoundingClientRect();
            focus.style.display = 'block';
            focus.style.top = `${Math.max(6, rect.top - 5)}px`;
            focus.style.left = `${Math.max(6, rect.left - 5)}px`;
            focus.style.width = `${Math.max(10, rect.width + 10)}px`;
            focus.style.height = `${Math.max(10, rect.height + 10)}px`;
            const x = Math.max(0, rect.left - 5), y = Math.max(0, rect.top - 5);
            const w = Math.min(window.innerWidth - x, rect.width + 10), h = Math.min(window.innerHeight - y, rect.height + 10);
            shades.top.style.cssText = `left:0;top:0;right:0;height:${y}px;display:block`;
            shades.right.style.cssText = `left:${x + w}px;top:${y}px;right:0;height:${h}px;display:block`;
            shades.bottom.style.cssText = `left:0;top:${y + h}px;right:0;bottom:0;display:block`;
            shades.left.style.cssText = `left:0;top:${y}px;width:${x}px;height:${h}px;display:block`;
        };

        overlay.querySelector('[data-onboarding-skip]').addEventListener('click', finishTour);
        back.addEventListener('click', () => { if (index > 0) goToStep(index - 1); });
        next.addEventListener('click', () => { if (index >= availableSteps.length - 1) finishTour(); else goToStep(index + 1); });
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
