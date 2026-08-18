// Navigare comună pentru panel: meniu mobil și sidebar pliabil pe desktop.
if (document.head && !document.head.querySelector('meta[http-equiv="Content-Security-Policy"]')) {
    const panelCsp = document.createElement('meta');
    panelCsp.httpEquiv = 'Content-Security-Policy';
    panelCsp.content = "default-src 'self'; base-uri 'self'; object-src 'none'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; img-src 'self' https: data: blob:; connect-src 'self' https://vkvsabbbawyiurnaiugo.supabase.co https://discord.com; font-src 'self' https: data:; form-action 'self';";
    document.head.prepend(panelCsp);
}
window.panelEscapeHtml = window.panelEscapeHtml || function panelEscapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (character) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[character]));
};
window.panelSafeAssetUrl = window.panelSafeAssetUrl || function panelSafeAssetUrl(value, fallback = 'img/logo-192.png') {
    const candidate = String(value || '').trim();
    if (!candidate) return fallback;
    try {
        const parsed = new URL(candidate, location.href);
        if (parsed.protocol === 'https:' || (parsed.origin === location.origin && ['http:', ''].includes(parsed.protocol))) return candidate;
    } catch (_) {}
    return fallback;
};
if (!window.__panelOnboardingLoader && !window.location.pathname.endsWith('login.html')) { window.__panelOnboardingLoader = true; const onboardingScript = document.createElement('script'); onboardingScript.src = 'js/panel-onboarding.js?v=1'; document.head.appendChild(onboardingScript); }
if (location.pathname.endsWith('organizatii.html') && !window.__organizationFetchFixed) { window.__organizationFetchFixed = true; const _fetch = window.fetch; window.fetch = (url, options = {}) => { if (String(url).includes('/functions/v1/manage-organizations')) options.headers = { ...(options.headers || {}), 'x-panel-session': localStorage.getItem('panel_session_token') || '' }; return _fetch(url, options); }; }
(() => {
    // RuleazÄƒ funcÈ›iile auxiliare dupÄƒ primul afiÈ™aj, astfel Ã®ncÃ¢t
    // navigarea È™i conÈ›inutul principal sÄƒ nu concureze cu scripturile
    // care nu sunt necesare pentru prima interacÈ›iune.
    function runWhenIdle(callback, timeout = 1200) {
        const run = () => {
            try {
                Promise.resolve(callback()).catch(error => {
                    console.warn('O funcÈ›ie auxiliarÄƒ a panoului nu a putut fi Ã®ncÄƒrcatÄƒ.', error);
                });
            } catch (error) {
                console.warn('O funcÈ›ie auxiliarÄƒ a panoului nu a putut fi pornitÄƒ.', error);
            }
        };

        if (typeof window.requestIdleCallback === 'function') {
            window.requestIdleCallback(run, { timeout });
        } else {
            window.setTimeout(run, Math.min(timeout, 250));
        }
    }

    if (window.location.pathname.endsWith('vouchere.html')) {
        const script = document.createElement('script'); script.src = 'js/voucher-admin-controls.js?v=3.8.1'; document.head.appendChild(script);
        const listScript = document.createElement('script'); listScript.src = 'js/voucher-list-controls.js?v=3.8.1'; document.head.appendChild(listScript);
        const enhancementScript = document.createElement('script'); enhancementScript.src = 'js/voucher-enhancements.js?v=3.8.1'; document.head.appendChild(enhancementScript);
    }
    if (window.location.pathname.endsWith('organizatii.html')) { const requestScript=document.createElement('script');requestScript.src='js/organization-request-fix.js';document.head.appendChild(requestScript); const script=document.createElement('script');script.src='js/package-limits.js';document.head.appendChild(script); }
    if (window.location.pathname.endsWith('admin.html')) { const script=document.createElement('script');script.src='js/admin-organization-center.js';document.head.appendChild(script); }
    if (window.location.pathname.endsWith('anunturi.html')) { const script=document.createElement('script');script.src='js/anunturi-permissions.js';document.head.appendChild(script); }
    const COLLAPSE_KEY = 'panel_sidebar_collapsed';
    let globalSearchTimer = null;
    let globalSearchRequest = 0;

    function addStyles() {
        if (document.getElementById('panel-layout-styles')) return;
        const style = document.createElement('style');
        style.id = 'panel-layout-styles';
        style.textContent = `
            .panel-responsive-sidebar { transition: width .2s ease; position:sticky; top:0; height:100vh; align-self:flex-start; }
            #panel-shared-sidebar, #panel-shared-sidebar *, #panel-mobile-menu, #panel-mobile-menu * { box-sizing:border-box; }
            #panel-shared-sidebar { display:flex !important; flex-direction:column !important; justify-content:space-between !important; overflow:visible; border-right:1px solid #1e293b !important; background:#0f172a !important; color:#e2e8f0 !important; font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif !important; text-align:left !important; }
            #panel-shared-sidebar > div:first-child { flex:1 1 auto; min-height:0; padding:24px !important; overflow-y:auto !important; }
            #panel-shared-sidebar > div:first-child > img { display:none !important; }
            #panel-shared-sidebar > div:last-child { display:none !important; }
            #panel-shared-sidebar h1 { display:flex !important; align-items:center !important; justify-content:flex-start !important; gap:10px !important; margin:0 !important; padding:0 !important; text-align:left !important; }
            #panel-shared-sidebar h1 > span { display:block; min-width:0; }
            #panel-shared-sidebar h1 > span > span { display:block !important; margin-top:3px; color:#94a3b8 !important; font-size:12px !important; font-weight:400 !important; line-height:1.3 !important; }
             #panel-shared-sidebar nav { display:flex !important; flex-direction:column !important; gap:6px !important; margin:24px 0 0 !important; padding:0 !important; }
             #panel-shared-sidebar .panel-nav-section { display:flex; flex-direction:column; gap:6px; }
             #panel-shared-sidebar .panel-nav-section + .panel-nav-section { margin-top:14px; }
             #panel-shared-sidebar .panel-nav-section-label { margin:2px 4px 2px; color:#64748b; font-size:10px; font-weight:800; letter-spacing:.12em; text-transform:uppercase; }
             #panel-shared-sidebar .panel-nav-section-links { display:flex; flex-direction:column; gap:6px; }
             #panel-shared-sidebar .panel-nav-section.is-empty { display:none; }
            #panel-shared-sidebar .nav-link { width:100% !important; min-height:42px; margin:0 !important; padding:10px 14px !important; display:flex; align-items:center !important; gap:12px !important; border-radius:12px !important; color:#cbd5e1 !important; font-size:14px !important; font-weight:500 !important; line-height:1.25 !important; text-align:left !important; text-decoration:none !important; white-space:normal !important; }
            #panel-shared-sidebar .nav-link > span:first-child { width:20px; flex:0 0 20px; text-align:center; }
            #panel-shared-sidebar .nav-link > span:last-child { min-width:0; overflow-wrap:anywhere; }
            #panel-shared-sidebar .nav-link.bg-emerald-500\/10 { color:#6ee7b7 !important; }
            #panel-shared-sidebar #panel-user-avatar { width:36px !important; height:36px !important; flex:0 0 36px; margin:0 !important; padding:0 !important; border:1px solid #334155 !important; border-radius:999px !important; object-fit:cover; }
            #panel-shared-sidebar #panel-user-display-name, #panel-shared-sidebar #panel-user-role { margin:0 !important; padding:0 !important; line-height:1.3 !important; }
            #panel-shared-sidebar #panel-user-display-name { color:#f8fafc !important; font-size:13px !important; font-weight:600 !important; }
            #panel-shared-sidebar #panel-user-role { margin-top:3px !important; color:#34d399 !important; font-size:11px !important; }
             #panel-shared-sidebar button { font-family:inherit !important; }
             #panel-shared-sidebar.is-collapsed { width:84px !important; flex-basis:84px !important; }
             #panel-shared-sidebar.is-collapsed > div:first-child { padding:18px 10px !important; }
             #panel-shared-sidebar.is-collapsed .panel-nav-section-label,
             #panel-shared-sidebar.is-collapsed .panel-org-name,
             #panel-shared-sidebar.is-collapsed .panel-sidebar-profile { display:none !important; }
             #panel-shared-sidebar.is-collapsed h1 { justify-content:center !important; }
             #panel-shared-sidebar.is-collapsed .panel-brand-logo { width:44px; height:44px; border-radius:13px; }
             #panel-shared-sidebar.is-collapsed nav { margin-top:18px !important; }
             #panel-shared-sidebar.is-collapsed .panel-nav-section + .panel-nav-section { margin-top:8px; }
             #panel-shared-sidebar.is-collapsed .nav-link { justify-content:center !important; gap:0 !important; padding:10px 8px !important; }
             #panel-shared-sidebar.is-collapsed .nav-link > span:last-child { display:none !important; }
             #panel-shared-sidebar.is-collapsed .panel-sidebar-bottom-actions { flex-direction:column; align-items:center; }
            #panel-shared-sidebar [data-shared-logout] { min-width:auto !important; margin:0 !important; padding:7px 9px !important; border:1px solid rgba(244,63,94,.25) !important; border-radius:9px !important; background:rgba(244,63,94,.08) !important; color:#fb7185 !important; font-size:11px !important; line-height:1 !important; cursor:pointer; }
            #panel-mobile-menu .panel-mobile-nav { display:flex !important; flex-direction:column !important; gap:6px !important; }
            #panel-mobile-menu .nav-link { min-height:44px; margin:0 !important; padding:11px 14px !important; display:flex; align-items:center !important; gap:12px !important; border-radius:12px !important; color:#cbd5e1 !important; font-size:14px !important; line-height:1.25 !important; text-decoration:none !important; }
            .panel-brand-logo { width:64px; height:64px; flex:none; border-radius:18px; object-fit:cover; border:1px solid #334155; box-shadow:0 8px 24px rgba(0,0,0,.32); }
            .panel-brand-heading { display:flex; align-items:center; justify-content:center; }
            .panel-org-name { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:#f8fafc; font-size:14px; font-weight:700; }
            .panel-sidebar-profile { display:grid; grid-template-columns:34px minmax(0,1fr); align-items:start; column-gap:9px; row-gap:7px; margin:14px 0 4px; padding:10px; border:1px solid #263952; border-radius:12px; background:#111d31; position:relative; }
            .panel-sidebar-profile > img { grid-column:1; grid-row:1; width:34px; height:34px; border-radius:999px; object-fit:cover; border:1px solid #334155; }
            .panel-sidebar-profile > div { grid-column:2; grid-row:1; min-width:0; }
            .panel-profile-main { min-width:0; }
            .panel-profile-menu { min-width:0; position:relative; }
            .panel-profile-menu > summary { display:grid; grid-template-columns:minmax(0,1fr) 30px; grid-template-rows:auto auto; align-items:center; column-gap:7px; list-style:none; cursor:pointer; border-radius:10px; padding:2px 3px; outline:none; }
            .panel-profile-menu > summary::-webkit-details-marker { display:none; }
            .panel-profile-menu > summary::after { display:none; }
            .panel-profile-menu > summary > strong, .panel-profile-menu > summary > small { grid-column:1; }
            .panel-profile-menu > summary > .panel-profile-gear { grid-column:2; grid-row:1 / span 2; }
            .panel-profile-menu[open] > summary { background:rgba(51,65,85,.28); }
            .panel-profile-gear { width:28px; height:28px; display:grid; place-items:center; border:1px solid #334155; border-radius:9px; background:#17233a; color:#94a3b8; font-size:15px; line-height:1; cursor:pointer; transition:all .18s ease; }
            .panel-profile-gear:hover, .panel-profile-gear:focus-visible { border-color:#34d399; background:#12352f; color:#6ee7b7; outline:none; transform:rotate(18deg); }
            .panel-profile-menu strong,.panel-profile-menu small { display:block; max-width:125px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
            .panel-account-settings-link { display:flex; align-items:center; gap:7px; padding:7px 8px; color:#d1fae5; font-size:11px; font-weight:700; line-height:1.2; text-decoration:none; }
            .panel-account-settings-link:hover { background:#10273a; color:#6ee7b7; }
            .panel-profile-dropdown { position:absolute; z-index:90; top:calc(100% + 7px); left:0; min-width:185px; overflow:hidden; border:1px solid #334155; border-radius:12px; background:#0b1628; box-shadow:0 16px 32px rgba(0,0,0,.38); }
            .panel-profile-dropdown [data-sidebar-logout], .panel-profile-dropdown [data-shared-logout] { width:100%; margin:0; padding:7px 8px; border:0; border-top:1px solid rgba(51,65,85,.7); border-radius:0; background:transparent; color:#fb7185; font-size:11px; text-align:left; cursor:pointer; }
            .panel-profile-dropdown [data-sidebar-logout]:hover, .panel-profile-dropdown [data-shared-logout]:hover { background:rgba(244,63,94,.1); }
            .panel-sidebar-profile strong,.panel-sidebar-profile small { display:block; max-width:125px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
            .panel-sidebar-profile strong { color:#f8fafc; font-size:12px; }
            .panel-sidebar-profile small { color:#34d399; font-size:10px; margin-top:2px; }
            .panel-sidebar-profile button { margin:0; padding:6px 8px; border:1px solid rgba(244,63,94,.3); border-radius:7px; color:#fb7185; background:rgba(244,63,94,.08); font-size:10px; cursor:pointer; }
            body.panel-shared-sidebar-page { padding-left:245px; }
            body.panel-global-shell { display:flex !important; flex-direction:column !important; min-height:100vh !important; }
            body.panel-global-shell > div:has(main) { flex:1 0 auto; min-height:calc(100vh - var(--panel-footer-height, 0px)) !important; height:auto !important; overflow:visible !important; }
            body.panel-global-shell > div:has(main) main { min-height:0 !important; }
            body.panel-global-shell > main { flex:1 0 auto; min-height:calc(100vh - var(--panel-footer-height, 0px)) !important; height:auto !important; overflow:visible !important; }
            body.panel-global-shell > #panel-global-footer { flex:0 0 auto; width:auto !important; margin-left:0 !important; margin-right:0 !important; }
            body.panel-global-shell > main { width:100% !important; }
            body.panel-global-shell > #panel-global-footer { width:100% !important; margin-left:0 !important; }
            body.panel-shared-sidebar-page > #panel-shared-sidebar { position:fixed; inset:0 auto 0 0; z-index:60; width:245px; }
            .panel-responsive-sidebar.fixed { position:fixed; }
            #panel-theme-toggle { width:38px; height:38px; flex:none; display:grid; place-items:center; border:1px solid #334155; border-radius:11px; background:#0b1220; color:#cbd5e1; cursor:pointer; box-shadow:0 5px 16px rgba(0,0,0,.18); }
            #panel-theme-toggle:hover { border-color:#10b981; color:#6ee7b7; }
            .panel-responsive-sidebar .nav-link, .panel-mobile-nav .nav-link, #mobile-menu .nav-link { border:1px solid #2d4058; background:linear-gradient(135deg,rgba(30,45,65,.9),rgba(19,31,49,.92)); box-shadow:0 3px 10px rgba(2,6,23,.2); }
            .panel-responsive-sidebar .nav-link:hover, .panel-mobile-nav .nav-link:hover, #mobile-menu .nav-link:hover { border-color:#48617d; background:linear-gradient(135deg,#293e58,#1d3048); transform:translateX(2px); }
            .panel-responsive-sidebar .nav-link.bg-emerald-500\\/10, .panel-mobile-nav .nav-link.bg-emerald-500\\/10, #mobile-menu .nav-link.bg-emerald-500\\/10 { border-color:rgba(52,211,153,.45); background:linear-gradient(135deg,rgba(5,150,105,.34),rgba(6,95,70,.3)); }
            html,body { max-width:100%; overflow-x:hidden; }
            body,main,#app { min-width:0; }
            #panel-header-host { grid-column:1 / -1 !important; width:100% !important; min-width:0 !important; }
            .main-content, #app-content { width:100% !important; min-width:0 !important; min-height:0 !important; align-items:stretch !important; }
            .main-content > *, #app-content > * { max-width:none; }
            img,svg,video,canvas { max-width:100%; }
            .panel-global-header { position:relative; min-height:76px !important; height:auto !important; padding-top:12px !important; padding-bottom:12px !important; gap:12px; }
            .panel-global-header > div:not(.panel-header-tools) { min-width:0; }
            .panel-global-header h1,.panel-global-header h2 { font-size:clamp(1.05rem,2vw,1.35rem) !important; line-height:1.25 !important; white-space:normal !important; overflow-wrap:anywhere; }
            .panel-global-header p { white-space:normal; line-height:1.35; }
            .panel-global-header { width:100% !important; max-width:none !important; min-height:76px !important; margin:0 !important; padding:12px 32px !important; display:flex !important; align-items:center !important; flex-wrap:wrap; gap:12px; flex:none; position:sticky !important; top:0; z-index:20; border-bottom:1px solid #1e293b; background:rgba(15,23,42,.72); backdrop-filter:blur(10px); text-align:left !important; }
            .panel-global-header .panel-global-title { display:flex; flex-direction:column; justify-content:center; min-width:0; flex:none; }
            .panel-global-header h1,.panel-global-header h2 { margin:0 !important; color:#f1f5f9; font-size:1.125rem !important; font-weight:700; }
            .panel-global-header p { margin:3px 0 0 !important; color:#94a3b8; font-size:11px; }
            .community-toolbar { justify-content:flex-end !important; margin-bottom:18px !important; }
            .panel-global-header:has(.panel-header-tools) { padding-right:72px !important; }
            .panel-header-tools { position:absolute; inset:0 18px; z-index:25; display:flex; align-items:center; pointer-events:none; }
            .panel-header-tools .panel-search-host { position:absolute; left:50%; transform:translateX(-50%); width:min(620px,45vw); min-width:0; pointer-events:auto; }
            .panel-header-tools .panel-search-host > div, .panel-header-tools .panel-search-host .relative, .panel-header-tools .search-container { width:100% !important; max-width:none !important; }
            .panel-global-search { width:100%; height:40px; padding:0 15px; border:1px solid #334155; border-radius:12px; outline:none; background:#07101f; color:#e2e8f0; font-size:13px; box-shadow:inset 0 1px 0 rgba(255,255,255,.025); transition:border-color .18s,box-shadow .18s; }
            .panel-global-search::placeholder { color:#64748b; }
            .panel-global-search:focus { border-color:#10b981; box-shadow:0 0 0 3px rgba(16,185,129,.12); }
            .panel-global-search-match { outline:2px solid rgba(16,185,129,.7) !important; outline-offset:2px; }
            .panel-global-search-results { position:absolute; top:calc(100% + 8px); left:0; right:0; z-index:2000; max-height:340px; overflow:auto; padding:6px; border:1px solid #334155; border-radius:14px; background:#0b1526; box-shadow:0 18px 40px rgba(0,0,0,.42); }
            .panel-global-search-result { display:block; padding:10px 11px; border-radius:10px; color:#dbeafe; text-decoration:none; }
            .panel-global-search-result:hover { background:#17243a; }
            .panel-global-search-result-title { display:block; font-size:12px; font-weight:800; color:#6ee7b7; }
            .panel-global-search-result-hits { display:block; margin-top:3px; color:#94a3b8; font-size:10px; line-height:1.35; }
            .panel-global-search-empty { padding:11px; color:#94a3b8; font-size:11px; }
            .panel-header-tools #panel-theme-toggle { margin-left:auto; pointer-events:auto; }
            .panel-global-header #panel-theme-toggle { margin-left:auto; pointer-events:auto; }

            @media (min-width:768px) {
                .panel-global-header:has(.panel-header-tools) { min-height:132px !important; padding-top:16px !important; padding-bottom:66px !important; }
                .panel-global-header .panel-header-tools { align-items:flex-start; padding-top:17px; }
                .panel-global-header .panel-header-tools .panel-search-host { top:72px; }
            }

            /* Tema Panel nu primește suprascrieri: păstrează exact designul original al paginilor. */
            html[data-panel-theme="dark"] { color-scheme:dark; --bg-main:#030712; --bg-panel:#080f1d; --bg-panel-hover:#111c2e; --card:#0a1220; --border:#223047; --text-main:#e5edf8; --text-muted:#91a0b6; }
            html[data-panel-theme="dark"] body, html[data-panel-theme="dark"] main, html[data-panel-theme="dark"] #app { background:#030712 !important; color:#e5edf8 !important; }
            html[data-panel-theme="dark"] aside, html[data-panel-theme="dark"] .panel-global-header, html[data-panel-theme="dark"] footer, html[data-panel-theme="dark"] .bg-slate-900, html[data-panel-theme="dark"] .post, html[data-panel-theme="dark"] .dialog, html[data-panel-theme="dark"] .panel, html[data-panel-theme="dark"] .card { background-color:#080f1d !important; }
            html[data-panel-theme="dark"] .bg-slate-950, html[data-panel-theme="dark"] input, html[data-panel-theme="dark"] textarea, html[data-panel-theme="dark"] select, html[data-panel-theme="dark"] .poll-option, html[data-panel-theme="dark"] .tab, html[data-panel-theme="dark"] .reaction { background-color:#030712 !important; color:#e5edf8 !important; }
            html[data-panel-theme="dark"] .bg-slate-800 { background-color:#111c2e !important; }
            html[data-panel-theme="dark"] .border-slate-800, html[data-panel-theme="dark"] .border-slate-700, html[data-panel-theme="dark"] .post, html[data-panel-theme="dark"] .dialog { border-color:#223047 !important; }

            .panel-sidebar-toggle { position:absolute; top:18px; right:-14px; z-index:70; width:28px; height:28px; display:flex; align-items:center; justify-content:center; border:1px solid #334155; border-radius:999px; background:#0f172a; color:#cbd5e1; cursor:pointer; box-shadow:0 6px 18px rgba(0,0,0,.3); }
            .panel-sidebar-toggle:hover { background:#1e293b; color:#fff; }
            #panel-mobile-backdrop { display:none; position:fixed; inset:0; z-index:4000; background:rgba(2,6,23,.78); backdrop-filter:blur(3px); }
            #panel-mobile-menu { position:fixed; inset:0 auto 0 0; z-index:4001; width:min(288px,86vw); background:#0f172a; border-right:1px solid #1e293b; transform:translateX(-102%); transition:transform .2s ease; box-shadow:16px 0 40px rgba(0,0,0,.45); overflow:auto; }
            #panel-mobile-menu.is-open { transform:translateX(0); }
            #panel-mobile-menu .panel-mobile-top { height:64px; padding:0 18px; border-bottom:1px solid #1e293b; display:flex; align-items:center; justify-content:space-between; }
            #panel-mobile-menu .panel-mobile-nav { padding:16px; }
            .panel-mobile-toggle { display:none; position:relative; z-index:40; width:40px; height:40px; flex:none; align-items:center; justify-content:center; border:1px solid #334155; border-radius:12px; background:#020617; color:#e2e8f0; font-size:18px; cursor:pointer; }
            .panel-action-bar { display:flex; align-items:center; justify-content:flex-end; gap:12px; flex-wrap:wrap; padding:12px max(16px, calc((100vw - 1280px) / 2)); border-bottom:1px solid #1e293b; background:rgba(15,23,42,.72); }
            .panel-action-bar > div { display:flex; align-items:center; gap:12px; flex-wrap:wrap; }
            .panel-bottom-save-bar { position:sticky; bottom:0; z-index:30; display:flex; justify-content:flex-end; padding:14px 16px; border-top:1px solid #1e293b; background:rgba(15,23,42,.96); backdrop-filter:blur(10px); }
            #panel-save-reminder { position:fixed; right:16px; bottom:94px; z-index:100; max-width:min(360px, calc(100vw - 32px)); padding:12px 14px; border:1px solid rgba(251,191,36,.4); border-radius:14px; background:#3b2f09; color:#fef3c7; font-size:12px; box-shadow:0 14px 35px rgba(0,0,0,.35); }
            main table { max-width:100%; }
            main :is(input,select,textarea,button,a) { touch-action:manipulation; }
            main :is(input,select,textarea) { max-width:100%; }
            main :is(.modal,.dialog,[role="dialog"]) { max-width:100vw; }
            @media (max-width:767px) {
                body { min-height:100dvh; }
                body.panel-shared-sidebar-page { padding-left:0; }
                .panel-responsive-sidebar { display:none !important; }
                .panel-sidebar-toggle { display:none !important; }
                .panel-mobile-toggle { display:flex; }
                .panel-global-header { min-height:88px !important; padding:12px 14px !important; display:flex !important; flex-wrap:wrap !important; align-content:center; }
                .panel-global-header > div:not(.panel-header-tools) { flex:1; min-width:calc(100% - 58px); }
                .panel-global-header h1,.panel-global-header h2 { font-size:1.08rem !important; }
                .panel-global-header { min-height:76px !important; padding:12px 14px !important; }
                .panel-header-tools { position:static; order:20; width:100%; gap:10px; pointer-events:auto; inset:auto; }
                .panel-header-tools .panel-search-host { position:static; transform:none; width:calc(100% - 48px); }
                .panel-global-header:has(.panel-header-tools) { padding-right:14px !important; }
                #app { grid-template-columns:1fr !important; grid-template-rows:auto 1fr !important; width:100% !important; }
                #app:has(#map-container-wrapper) { grid-template-rows:auto minmax(0,1fr) !important; }
                #app > header, #app > #map-container-wrapper { grid-column:1 !important; }
                .panel-action-bar { justify-content:stretch; padding:12px 16px; }
                .panel-action-bar > div, .panel-action-bar button { width:100%; }
                main { width:100% !important; max-width:100vw !important; margin-left:0 !important; overflow-x:hidden; }
                main > :is(.p-8,.p-6,.p-5) { padding:14px !important; }
                main :is(.grid-cols-2,.grid-cols-3,.grid-cols-4,.grid-cols-5,.grid-cols-6) { grid-template-columns:minmax(0,1fr) !important; }
                main :is(.md\\:grid-cols-2,.md\\:grid-cols-3,.lg\\:grid-cols-2,.lg\\:grid-cols-3,.lg\\:grid-cols-4) { grid-template-columns:minmax(0,1fr) !important; }
                main :is(.flex) { min-width:0; }
                main :is(input,select,textarea) { width:100%; font-size:16px !important; }
                main button,main a[class*="px-"] { min-height:42px; }
                main table { display:block; width:100%; overflow-x:auto; overscroll-behavior-x:contain; -webkit-overflow-scrolling:touch; }
                main th,main td { white-space:nowrap; }
                main :is(.rounded-2xl,.rounded-xl,.card,.panel,.post) { max-width:100%; }
                main :is(.modal,.fixed.inset-0) { padding:10px !important; }
                main :is(.dialog,[role="dialog"],.modal-content) { width:100% !important; max-height:calc(100dvh - 20px) !important; overflow:auto; border-radius:16px !important; }
                footer { padding-left:12px !important; padding-right:12px !important; padding-bottom:max(18px,env(safe-area-inset-bottom)) !important; }
                #panel-save-reminder { right:10px; bottom:82px; max-width:calc(100vw - 20px); }
            }
            /* Păstrăm meniul standard pe toate dimensiunile; meniul mobil nu mai schimbă layout-ul. */
            @media (max-width:767px) {
                body.panel-global-shell { min-width:1024px !important; overflow-x:auto !important; }
                body.panel-shared-sidebar-page { padding-left:245px !important; }
                body.panel-shared-sidebar-page > #panel-shared-sidebar { display:flex !important; position:fixed !important; inset:0 auto 0 0 !important; width:245px !important; z-index:60 !important; }
                #panel-mobile-menu, #panel-mobile-backdrop, .panel-mobile-toggle, #global-header-mobile-btn, #mobile-menu-toggle { display:none !important; }
                body.panel-global-shell main { max-width:none !important; }
            }
            /* Sidebar-ul este același și pe paginile calculatorului, care au stiluri proprii. */
            #panel-shared-sidebar .nav-link,
            #panel-shared-sidebar .nav-link:link,
            #panel-shared-sidebar .nav-link:visited {
                min-height:38px !important;
                margin:0 !important;
                padding:10px 11px !important;
                gap:10px !important;
                font-family:Manrope,Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif !important;
                font-size:12px !important;
                font-weight:600 !important;
                line-height:1.25 !important;
                color:#91a0b6 !important;
                text-decoration:none !important;
            }
            #panel-shared-sidebar .nav-link > span:first-child { width:19px !important; flex:0 0 19px !important; }
            #panel-shared-sidebar .nav-link.bg-emerald-500\/10,
            #panel-shared-sidebar .nav-link.bg-emerald-500\/10:link,
            #panel-shared-sidebar .nav-link.bg-emerald-500\/10:visited { color:#e5edf8 !important; }
            /* Pagini istorice: păstrăm conținutul lor, dar folosim aceeași scară globală. */
            body[data-panel-page="calculator.html"] .main-content,
            body[data-panel-page="calculatorilegal.html"] .main-content { align-items:stretch !important; background:#030712 !important; }
            body[data-panel-page="calculator.html"] .calculator-container,
            body[data-panel-page="calculatorilegal.html"] .calculator-container {
                width:100% !important;
                max-width:1200px !important;
                margin:0 auto !important;
                padding:24px 32px 32px !important;
                gap:24px !important;
            }
            body[data-panel-page="locatiiilegale.html"] { width:auto !important; height:auto !important; min-height:100vh !important; overflow-x:auto !important; overflow-y:auto !important; background:#030712 !important; }
            body[data-panel-page="locatiiilegale.html"] > #app { width:100% !important; height:auto !important; min-height:100vh !important; overflow:visible !important; flex:1 0 auto !important; }
            body[data-panel-page="locatiiilegale.html"] #map-container-wrapper { min-height:calc(100vh - 90px) !important; flex:1 0 auto !important; overflow:hidden !important; }
            body[data-panel-page="locatiiilegale.html"] #locations-footer-host { display:block !important; min-height:0 !important; }
            body[data-panel-page="developer.html"] > main { width:100% !important; max-width:1200px !important; margin:0 auto !important; padding:24px 32px 40px !important; }
            body[data-panel-page="developer.html"] #admin-content > header { display:none !important; }
            body[data-panel-page="developer.html"] .card { border-radius:16px !important; padding:20px !important; margin-bottom:16px !important; }
            body[data-panel-page="developer.html"] h1 { font-size:clamp(1.35rem,2vw,1.75rem) !important; line-height:1.25 !important; }
            body[data-panel-page="developer.html"] h2 { font-size:1rem !important; line-height:1.35 !important; }
            body[data-panel-page="developer.html"] p,
            body[data-panel-page="developer.html"] li { font-size:13px !important; line-height:1.55 !important; }
            @media (min-width:768px) and (max-width:1100px) { .panel-header-tools .panel-search-host { width:min(460px,42vw); } }
        `;
        document.head.appendChild(style);
    }

    function setup() {
        const currentPage = window.location.pathname.split('/').pop() || 'index.html';
        document.body.classList.add('panel-global-shell');
        document.body.dataset.panelPage = currentPage;
        addStyles();
        ensurePanelVisualTheme();
        ensureTextNormalizer();
        ensureBrandAssets();
        ensureGlobalHeader();
        runWhenIdle(() => setupAssistantWidget(currentPage), 1400);
        const shared = ensureSharedSidebar();
        const navigation = shared.navigation;
        const sidebar = navigation?.closest('aside');
        if (!navigation || !sidebar) return;
        ensureBrandLogo(sidebar);
        refreshActualRoleLabel();
        sidebar.querySelector(':scope > div:last-child')?.remove();

        ensureCommunityLink(navigation, currentPage);
        normalizeNavigation(navigation, currentPage);
        if (typeof applyRoleBasedVisibility === 'function') {
            applyRoleBasedVisibility();
        }
        ensureSidebarLogout(sidebar);
        ensureThemeToggle(sidebar);

        normalizePageHeader(currentPage);
        sidebar.classList.add('panel-responsive-sidebar');
        relocateHeaderActions(currentPage);
        setupAdminSaveArea();
        const main = document.querySelector('main');
        if (main) {
            main.style.minHeight = '100vh';
            // Paginile istorice aveau un offset propriu pentru sidebar.
            // Sidebarul comun este poziționat de body.panel-shared-sidebar-page.
            main.style.marginLeft = '0';
        }
        const originalMainMargin = main?.style.marginLeft || '';
        const originalSidebarWidth = sidebar.style.width || '';

        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'panel-sidebar-toggle';
        toggle.setAttribute('aria-label', 'Micșorează meniul');
        sidebar.appendChild(toggle);

         const applyCollapsedState = (collapsed) => {
             const sidebarWidth = collapsed ? '5.25rem' : (originalSidebarWidth || '245px');
             sidebar.style.width = sidebarWidth;
             sidebar.style.flexBasis = sidebarWidth;
             sidebar.classList.toggle('is-collapsed', collapsed);
            if (main?.classList.contains('ml-72')) main.style.marginLeft = collapsed ? '5.25rem' : originalMainMargin;
            if (document.body.classList.contains('panel-shared-sidebar-page')) {
                document.body.style.paddingLeft = collapsed ? '5.25rem' : '245px';
            }
            const mapApp = document.getElementById('app');
            if (mapApp && document.getElementById('map-container-wrapper')) {
                mapApp.style.gridTemplateColumns = collapsed ? '5.25rem 1fr' : '245px 1fr';
            }

            navigation.querySelectorAll('a').forEach((link) => {
                const label = link.querySelector('span:nth-child(2)');
                if (label) label.classList.toggle('hidden', collapsed);
                link.classList.toggle('justify-center', collapsed);
                link.classList.toggle('px-3', collapsed);
                link.classList.toggle('space-x-3', !collapsed);
                link.title = collapsed ? (label?.textContent || '').trim() : '';
            });
            const title = sidebar.querySelector('h1');
            if (title) title.classList.toggle('hidden', collapsed);
            sidebar.querySelectorAll('#panel-user-display-name, #panel-user-role').forEach((element) => element.classList.toggle('hidden', collapsed));
            toggle.textContent = collapsed ? '›' : '‹';
        toggle.setAttribute('aria-label', collapsed ? 'Extinde meniul' : 'Micșorează meniul');
        };

        const savedState = localStorage.getItem(COLLAPSE_KEY) === 'true';
        applyCollapsedState(savedState);
        toggle.addEventListener('click', () => {
            const nextState = !sidebar.querySelector('.nav-link span:nth-child(2)')?.classList.contains('hidden');
            localStorage.setItem(COLLAPSE_KEY, String(nextState));
            applyCollapsedState(nextState);
        });

        // Dashboard are deja propriul meniu mobil, păstrat pentru compatibilitate.
        if (document.getElementById('mobile-menu')) {
            resolveOrganizationAdminVisibility(navigation);
            return;
        }

        const backdrop = document.createElement('div');
        backdrop.id = 'panel-mobile-backdrop';
        const mobileMenu = document.createElement('aside');
        mobileMenu.id = 'panel-mobile-menu';
        mobileMenu.innerHTML = `<div class="panel-mobile-top"><img src="img/logo-192.png" alt="Logo Panel" class="panel-brand-logo"><button type="button" class="w-9 h-9 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-lg" aria-label="Închide meniul">×</button></div><nav class="panel-mobile-nav space-y-1.5"></nav>`;
        document.body.append(backdrop, mobileMenu);

        const mobileNav = mobileMenu.querySelector('.panel-mobile-nav');
        mobileNav.innerHTML = navigation.innerHTML;
        if (typeof applyRoleBasedVisibility === 'function') applyRoleBasedVisibility();
        refreshNavigationSections(mobileNav);
        resolveOrganizationAdminVisibility(navigation);

        const closeMobileMenu = () => {
            mobileMenu.classList.remove('is-open');
            backdrop.style.display = 'none';
            const legacyMenu = document.getElementById('mobile-menu');
            const legacyBackdrop = document.getElementById('mobile-menu-backdrop');
            legacyMenu?.classList.add('-translate-x-full');
            legacyBackdrop?.classList.add('hidden');
            document.body.classList.remove('panel-mobile-menu-open');
            document.body.style.overflow = '';
        };
        const openMobileMenu = () => {
            document.dispatchEvent(new CustomEvent('panel:mobile-menu-open'));
            mobileMenu.classList.add('is-open');
            backdrop.style.display = 'block';
            document.body.classList.add('panel-mobile-menu-open');
            document.body.style.overflow = 'hidden';
        };
        const toggleMobileMenu = () => {
            if (mobileMenu.classList.contains('is-open')) closeMobileMenu();
            else openMobileMenu();
        };
        window.__panelMobileToggle = toggleMobileMenu;
        window.__panelMobileClose = closeMobileMenu;
        document.addEventListener('panel:mobile-menu-close', closeMobileMenu);
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && mobileMenu.classList.contains('is-open')) closeMobileMenu();
        });
        mobileMenu.querySelector('button').addEventListener('click', closeMobileMenu);
        backdrop.addEventListener('click', closeMobileMenu);
        mobileNav.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMobileMenu));

        const header = document.querySelector('header');
        if (header) {
            const mobileToggle = document.createElement('button');
            mobileToggle.type = 'button';
            mobileToggle.className = 'panel-mobile-toggle';
            mobileToggle.textContent = '☰';
            mobileToggle.setAttribute('aria-label', 'Deschide meniul');
            mobileToggle.addEventListener('click', openMobileMenu);
            header.insertBefore(mobileToggle, header.firstChild);
        }
    }

    function ensureGlobalHeader() {
        let main = document.querySelector('main');
        if (!main) return;
        let host = document.getElementById('panel-header-host');
        if (!host) {
            host = document.createElement('div');
            host.id = 'panel-header-host';
            main.prepend(host);
        }
        if (!document.querySelector('script[src^="js/global-header.js"]')) {
            const script = document.createElement('script');
            script.src = 'js/global-header.js?v=4.2.0';
            script.defer = true;
            document.head.appendChild(script);
        }
    }

    function ensurePanelVisualTheme() {
        if (document.querySelector('link[data-panel-visual-theme]')) return;
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'css/panel-demo-theme.css?v=1.0.0';
        link.dataset.panelVisualTheme = 'true';
        document.head.appendChild(link);
    }

    function ensureTextNormalizer() {
        if (document.querySelector('script[data-panel-text-normalizer]')) return;
        const script = document.createElement('script');
        script.src = 'js/text-normalizer.js?v=1.0.0';
        script.dataset.panelTextNormalizer = 'true';
        document.head.appendChild(script);
    }

    function ensureBrandAssets() {
        if (!document.querySelector('link[rel~="icon"]')) { const icon=document.createElement('link');icon.rel='icon';icon.href='img/favicon.ico';document.head.appendChild(icon); }
        if (!document.querySelector('link[rel="apple-touch-icon"]')) { const touch=document.createElement('link');touch.rel='apple-touch-icon';touch.href='img/logo-180.png';document.head.appendChild(touch); }
    }

    function discordRoleLabel(user) {
        const active = typeof getActiveOrganization === 'function' ? getActiveOrganization() : null;
        const candidates = [user?.discord_role_name, user?.discord_role, user?.role_name, user?.panel_role, user?.organization?.panel_role, user?.active_organization?.panel_role, active?.discord_role_name, active?.panel_role, user?.role, user?.default_role];
        const value = candidates.map(item => String(item || '').trim()).find(item => item && !/^\d+$/.test(item) && !/^(?:level|nivel)\b/i.test(item));
        return value || 'Rol Discord';
    }

    function refreshSidebarUserRole() {
        if (typeof getUser !== 'function') return;
        const user = getUser();
        const roleElement = document.getElementById('panel-user-role');
        const nameElement = document.getElementById('panel-user-display-name');
        const avatarElement = document.getElementById('panel-user-avatar');
        if (roleElement) roleElement.textContent = discordRoleLabel(user);
        if (nameElement) nameElement.textContent = user?.display_name || user?.username || 'Utilizator';
        if (avatarElement) avatarElement.src = window.panelSafeAssetUrl(user?.avatar || user?.avatar_url || '');
    }

    async function refreshRoleFromUsersTable() {
        const currentUser = typeof getUser === 'function' ? getUser() : null;
        const discordId = String(currentUser?.discord_id || currentUser?.id || '').trim();
        const config = window.PANEL_SUPABASE_CONFIG;
        if (!discordId || !config?.url || !config?.publishableKey) return '';

        try {
            let data = null;
            if (typeof window.createPanelSupabaseClient === 'function' && window.supabase?.createClient) {
                try {
                    const client = window.createPanelSupabaseClient();
                    const result = await client
                        .from('users')
                        .select('*')
                        .eq('discord_id', discordId)
                        .maybeSingle();
                    data = result.data || null;
                } catch (_) {}
            }
            if (!data) {
                const response = await fetch(
                    `${config.url}/rest/v1/users?select=*&discord_id=eq.${encodeURIComponent(discordId)}&limit=1`,
                    {
                        headers: {
                            apikey: config.publishableKey,
                            Authorization: `Bearer ${config.publishableKey}`,
                            ...(localStorage.getItem('panel_session_token')
                                ? { 'X-Panel-Session': localStorage.getItem('panel_session_token') }
                                : {})
                        }
                    }
                );
                if (!response.ok) return '';
                const rows = await response.json();
                data = Array.isArray(rows) ? rows[0] : null;
            }
            if (!data) return '';

            const role = String(data.role || data.default_role || '').trim();
            if (!role) return '';
            const mergedUser = {
                ...currentUser,
                ...data,
                discord_id: currentUser.discord_id || discordId,
                role,
                default_role: data.default_role || role
            };
            localStorage.setItem('discord_user', JSON.stringify(mergedUser));
            localStorage.setItem('user_role', role);
            window.dispatchEvent(new CustomEvent('panel-user-updated'));
            return role;
        } catch (_) {
            return '';
        }
    }

    async function refreshActualRoleLabel() {
        await refreshRoleFromUsersTable();
    }

    window.addEventListener('panel-user-updated', refreshSidebarUserRole);

    function ensureBrandLogo(sidebar) {
        const heading=sidebar.querySelector('h1');
        if(!heading)return;
        heading.classList.add('panel-brand-heading');
        heading.replaceChildren();
        const organization=typeof getActiveOrganization==='function'?getActiveOrganization():null;
        const organizationName=window.panelEscapeHtml(organization?.name||'Organizație');const organizationLogo=window.panelSafeAssetUrl(organization?.logo_url||'');
        heading.innerHTML=`<img class="panel-brand-logo" src="${organizationLogo}" alt="${organizationName}" onerror="this.src='img/logo-192.png'"><span class="panel-org-name">${organizationName}</span>`;
        let profile=sidebar.querySelector('.panel-sidebar-profile');
        if(!profile){const user=typeof getUser==='function'?getUser():null;const displayName=window.panelEscapeHtml(user?.display_name||user?.username||'Utilizator');const role=window.panelEscapeHtml(discordRoleLabel(user));const avatar=window.panelSafeAssetUrl(user?.avatar||user?.avatar_url||'');profile=document.createElement('div');profile.className='panel-sidebar-profile';profile.innerHTML=`<img id="panel-user-avatar" src="${avatar}" alt=""><div class="panel-profile-main"><details class="panel-profile-menu"><summary><strong id="panel-user-display-name">${displayName}</strong><small id="panel-user-role">${role}</small></summary><div class="panel-profile-dropdown"><a class="panel-account-settings-link" href="setari-cont.html">⚙️ Setările contului</a><button type="button" id="panel-logout-btn" data-sidebar-logout>Deconectare</button></div></details></div>`;heading.after(profile);}
        const profileMenu=profile?.querySelector('.panel-profile-menu');
        if(profileMenu&&!profileMenu.querySelector('.panel-profile-gear')){
            const summary=profileMenu.querySelector('summary');
            const gear=document.createElement('button');
            gear.type='button'; gear.className='panel-profile-gear'; gear.textContent='⚙'; gear.title='Setări profil'; gear.setAttribute('aria-label','Deschide setările profilului');
            gear.addEventListener('click',(event)=>{event.preventDefault();event.stopPropagation();profileMenu.open=!profileMenu.open;});
            gear.addEventListener('keydown',(event)=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();profileMenu.open=!profileMenu.open;}});
            summary?.appendChild(gear);
        }
    }

    function ensureSharedSidebar() {
        let existing = document.getElementById('panel-shared-sidebar');
        if (existing) return {navigation: existing.querySelector('nav')};

        // Elimină sidebarul copiat din pagină. Meniul mobil legacy (dacă există)
        // rămâne intact pentru compatibilitatea dashboardului.
        const legacyNavigation = document.getElementById('sidebar-nav') || [...document.querySelectorAll('aside nav')]
            .find(nav => !nav.closest('#panel-mobile-menu'));
        const legacySidebar = legacyNavigation?.closest('aside') || null;
        const user=typeof getUser==='function'?getUser():null,organization=typeof getActiveOrganization==='function'?getActiveOrganization():null;const organizationName=window.panelEscapeHtml(organization?.name||'Logo Panel');const organizationLogo=window.panelSafeAssetUrl(organization?.logo_url||'');const displayName=window.panelEscapeHtml(user?.display_name||user?.username||'Utilizator');const role=window.panelEscapeHtml(discordRoleLabel(user));const avatar=window.panelSafeAssetUrl(user?.avatar||user?.avatar_url||'');const sidebar=document.createElement('aside');sidebar.id='panel-shared-sidebar';sidebar.className='panel-responsive-sidebar bg-slate-900 border-r border-slate-800 flex flex-col justify-between';sidebar.style.width='245px';sidebar.style.flex='0 0 245px';sidebar.innerHTML=`<div class="p-6 overflow-y-auto"><h1 class="text-xl font-bold"><img src="${organizationLogo}" alt="${organizationName}" class="panel-brand-logo" onerror="this.src='img/logo-192.png'"></h1><nav id="sidebar-nav" class="mt-6 space-y-1.5"></nav></div><div class="p-4 border-t border-slate-800 flex items-center justify-between gap-2"><div class="flex items-center gap-3 min-w-0"><img id="panel-user-avatar" class="w-9 h-9 rounded-full border border-slate-700 object-cover" src="${avatar}" alt=""><details class="panel-profile-menu min-w-0"><summary><p id="panel-user-display-name" class="font-semibold truncate">${displayName}</p><p id="panel-user-role" class="text-xs text-emerald-400 truncate">${role}</p></summary><div class="panel-profile-dropdown"><a class="panel-account-settings-link" href="setari-cont.html">⚙️ Setările contului</a><button type="button" data-shared-logout>Deconectare</button></div></details></div></div>`;
        if (legacySidebar) {
            legacySidebar.replaceWith(sidebar);
        } else if (document.getElementById('panel-sidebar-host')) {
            document.getElementById('panel-sidebar-host').replaceChildren(sidebar);
        } else {
            document.body.prepend(sidebar);
            document.body.classList.add('panel-shared-sidebar-page');
        }
        navigation=sidebar.querySelector('nav');return {navigation};
    }

    function normalizePageHeader(currentPage) {
        const main = document.querySelector('main');
        if (!main) return;
        let header = [...main.children].find(element => element.matches('header')) ||
            [...document.body.children].find(element => element.matches('header'));

        // Hostul global este singura sursă pentru header. Mutăm acțiunile utile
        // într-o bară secundară și eliminăm markupul vechi al paginii.
        if (header && !header.closest('#panel-header-host')) {
            const titleBlock=[...header.children].find(child=>child.querySelector?.('h1,h2')||child.matches?.('h1,h2'));
            const extras=[...header.children].filter(child=>child!==titleBlock);
            if(extras.length){
                let bar=main.querySelector(':scope > .panel-page-details');
                if(!bar){bar=document.createElement('section');bar.className='panel-page-details panel-action-bar';main.querySelector('#panel-header-host')?.after(bar);}
                extras.forEach(extra=>bar.appendChild(extra));
            }
            header.remove();
            header = null;
        }

        if (!header && currentPage !== 'anunturi.html') return;

        if (currentPage === 'anunturi.html') {
            const hero = main.querySelector('.community-hero');
            hero?.querySelector(':scope > div')?.remove();
            hero?.classList.add('community-toolbar');
            return;
        }

        if (currentPage === 'anunturi.html') {
            if (!header) {
                header = document.createElement('header');
                header.innerHTML = '<div class="panel-global-title"><h2>📣 Anunțuri & Sondaje</h2><p>Comunicare pentru Familie și Mecanici.</p></div>';
                main.prepend(header);
            }
            header.className = 'panel-global-header';
            const hero = main.querySelector('.community-hero');
            hero?.querySelector(':scope > div')?.remove();
            hero?.classList.add('community-toolbar');
            return;
        }

        if (currentPage === 'calculatorilegal.html') {
            if (!header) return;
            header.className = 'panel-global-header';
            const search = header.querySelector('.search-container');
            header.innerHTML = '<div class="panel-global-title"><h2>🧮 Calculator Ilegal</h2><p>Calcul pentru arme, muniție și plicuri.</p></div>';
            if (search) header.appendChild(search);
            return;
        }

        if (currentPage === 'craftmecanics.html') {
            if (!header) return;
            header.className = 'panel-global-header';
            header.innerHTML = '<div class="panel-global-title"><h2>🔨 Craft Mechanics</h2><p>Galerie capturi, rețete și echipamente.</p></div>';
            return;
        }
        if (currentPage === 'bucatarie.html') {
            if (!header) return;
            header.className = 'panel-global-header';
            header.innerHTML = `
                <div class="panel-global-title">
                    <h2>🍳 Bucătărie</h2>
                    <p>Galerie capturi, rețete și echipamente pentru bucătărie.</p>
                </div>
            `;
            return;
        }

        if (header) {
            header.classList.add('panel-global-header');
            const titleBlock=[...header.children].find(child=>child.querySelector?.('h1,h2')||child.matches?.('h1,h2'));
            const extras=[...header.children].filter(child=>child!==titleBlock&&!child.classList.contains('panel-header-tools')&&!child.querySelector?.('input[type="search"]'));
            if(extras.length){let bar=main.querySelector(':scope > .panel-page-details');if(!bar){bar=document.createElement('section');bar.className='panel-page-details panel-action-bar';if(header.parentElement===main)header.after(bar);else main.prepend(bar)}extras.forEach(extra=>bar.appendChild(extra));}
        }
    }

    function loadAssistantScript(id, source, ready) {
        if (ready()) return Promise.resolve();
        const existing = document.getElementById(id);
        if (existing) {
            return new Promise((resolve, reject) => {
                existing.addEventListener('load', resolve, { once: true });
                existing.addEventListener('error', reject, { once: true });
            });
        }
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.id = id;
            script.src = source;
            script.onload = resolve;
            script.onerror = () => {
                script.remove();
                reject(new Error(`Nu s-a putut încărca ${source}`));
            };
            document.head.appendChild(script);
        });
    }

    function ensureCommunityLink(navigation, currentPage) {
        if (navigation.querySelector('a[href="anunturi.html"]')) return;
        const link = document.createElement('a');
        link.href = 'anunturi.html';
        link.className = 'nav-link flex items-center space-x-3 px-4 py-3 rounded-xl transition text-sm';
        link.classList.add(...(currentPage === 'anunturi.html'
            ? ['bg-emerald-500/10', 'text-emerald-400', 'font-medium']
            : ['text-slate-300', 'hover:bg-slate-800']));
        link.innerHTML = '<span>📣</span><span>Anunțuri & Sondaje</span>';
        const marketplace = navigation.querySelector('a[href="marketplace.html"]');
        navigation.insertBefore(link, marketplace || null);
    }

    function refreshNavigationSections(navigation) {
        if (!navigation) return;
        navigation.querySelectorAll('[data-nav-section]').forEach((section) => {
            const hasVisibleLink = [...section.querySelectorAll('a.nav-link[href]')]
                .some((link) => !link.hidden && getComputedStyle(link).display !== 'none');
            section.hidden = !hasVisibleLink;
            section.classList.toggle('is-empty', !hasVisibleLink);
        });
    }

    async function resolveOrganizationAdminVisibility(navigation) {
        const link = navigation?.querySelector('a[href="administrare-organizatie.html"]');
        if (!link) return;

        if (typeof isPlatformAdmin === 'function' && isPlatformAdmin()) {
            link.hidden = false;
            link.style.display = '';
            refreshNavigationSections(navigation);
            return;
        }

        // Proprietatea organizației este verificată server-side; până la răspuns
        // linkul rămâne ascuns, ca să nu apară o opțiune pe care utilizatorul nu o poate folosi.
        link.hidden = true;
        link.style.display = 'none';

        const token = localStorage.getItem('discord_access_token');
        const config = window.PANEL_SUPABASE_CONFIG;
        if (!token || !config?.url || !config?.publishableKey) {
            link.remove();
            refreshNavigationSections(navigation);
            return;
        }

        try {
            const response = await fetch(`${config.url}/functions/v1/manage-owned-organization`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    apikey: config.publishableKey,
                    Authorization: `Bearer ${config.publishableKey}`
                },
                body: JSON.stringify({
                    action: 'owner_get',
                    access_token: token,
                    organization_id: window.getActiveOrganizationId?.() || ''
                })
            });

            if (!response.ok) {
                link.remove();
            } else {
                link.hidden = false;
                link.style.display = '';
            }
        } catch (_) {
            link.remove();
        }

        refreshNavigationSections(navigation);
        const mobileNavigation = document.querySelector('#panel-mobile-menu nav');
        if (mobileNavigation) {
            mobileNavigation.innerHTML = navigation.innerHTML;
            if (typeof applyRoleBasedVisibility === 'function') applyRoleBasedVisibility();
            refreshNavigationSections(mobileNavigation);
        }
    }

    function normalizeNavigation(navigation, currentPage) {
        const sections = [
            ['management', 'Operațiuni', [
                ['index.html', '📊', 'Dashboard'],
                ['anunturi.html', '📣', 'Anunțuri & Sondaje'],
                ['pontaj.html', '⏱️', 'Pontaj'],
                ['cereri.html', '📋', 'Cereri / Absențe'],
                ['contracte.html', '📜', 'Contracte'],
                ['rapoarte.html', '📈', 'Rapoarte']
            ]],
            ['resurse', 'Resurse', [
                ['marketplace.html', '🛒', 'Marketplace'],
                ['calculator.html', '🧮', 'Calculator'],
                ['bucatarie.html', '🍳', 'Bucătărie'],
                ['craftmecanics.html', '🔨', 'Craft Mecanics']
            ]],
            ['ilegal', 'Resurse ilegale', [
                ['calculatorilegal.html', '🧮', 'Calculator Ilegal'],
                ['locatiiilegale.html', '🗺️', 'Locații Ilegale'],
                ['marketplace-ilegal.html', '🚨', 'Black Market']
            ]],
            ['administratie', 'Administrație', [
                ['logs.html', '🧾', 'Loguri'],
                ['diagnostic.html', '🩺', 'Verificare sistem'],
                ['discord-configurare.html', '⚙️', 'Configurare Discord'],
                ['administrare-organizatii-platforma.html', '🗂️', 'Administrare organizații'],
                ['organizatii.html', '🏢', 'Organizații platformă'],
                ['developer.html', '🛠️', 'Developer'],
                ['admin.html', '👑', 'Panou Admin']
            ]]
        ];
        const renderLink = ([href, icon, label]) => {
            const active = currentPage === href;
            const stateClasses = active
                ? 'bg-emerald-500/10 text-emerald-400 font-medium'
                : 'text-slate-300 hover:bg-slate-800';
            return `<a href="${href}" class="nav-link flex items-center space-x-3 px-4 py-3 rounded-xl transition text-sm ${stateClasses}"><span>${icon}</span><span>${label}</span></a>`;
        };
        navigation.innerHTML = sections.map(([key, label, links]) =>
            `<section class="panel-nav-section" data-nav-section="${key}"><p class="panel-nav-section-label">${label}</p><div class="panel-nav-section-links">${links.map(renderLink).join('')}</div></section>`
        ).join('');

        if (typeof isPlatformAdmin === 'function' && isPlatformAdmin() && !navigation.querySelector('a[href="vouchere.html"]')) {
            const voucher = document.createElement('a'); voucher.href='vouchere.html'; voucher.className='nav-link flex items-center space-x-3 px-4 py-3 rounded-xl transition text-sm text-slate-300 hover:bg-slate-800'; voucher.innerHTML='<span>🎟️</span><span>Vouchere</span>'; (navigation.querySelector('[data-nav-section="administratie"] .panel-nav-section-links') || navigation).appendChild(voucher);
        }
        if (!navigation.querySelector('a[href="administrare-organizatie.html"]')) {
            const organizationAdmin = document.createElement('a');
            organizationAdmin.href = 'administrare-organizatie.html';
            organizationAdmin.className = 'nav-link flex items-center space-x-3 px-4 py-3 rounded-xl transition text-sm ' + (
                currentPage === 'administrare-organizatie.html'
                    ? 'bg-emerald-500/10 text-emerald-400 font-medium'
                    : 'text-slate-300 hover:bg-slate-800'
            );
            organizationAdmin.innerHTML = '<span>🏢</span><span>Administrare organizație</span>';
            const adminSection = navigation.querySelector('[data-nav-section="administratie"] .panel-nav-section-links');
            if (adminSection) adminSection.appendChild(organizationAdmin);
            else navigation.appendChild(organizationAdmin);
        }
        if (typeof isPlatformAdmin === 'function' && isPlatformAdmin()) {
            navigation.querySelectorAll('a.nav-link').forEach((link) => { link.style.display = ''; });
        }

        refreshNavigationSections(navigation);

        const existingMobileNavigation = document.querySelector('#mobile-menu nav');
        if (existingMobileNavigation) existingMobileNavigation.innerHTML = navigation.innerHTML;
    }

    function ensureSidebarLogout(sidebar) {
        const existingLogout = [...sidebar.querySelectorAll('button')].find((button) => {
            const action = `${button.id} ${button.getAttribute('onclick') || ''} ${button.textContent || ''}`.toLocaleLowerCase('ro-RO');
            return action.includes('logout') || action.includes('ieșire') || action.includes('iesire');
        });
        if (existingLogout) {
            const cleanButton = existingLogout.cloneNode(true);
            cleanButton.removeAttribute('onclick');
            const label = cleanButton.querySelector('span:last-child');
            if (label) label.textContent = 'Logout'; else cleanButton.textContent = 'Logout';
            cleanButton.addEventListener('click', (event) => { event.preventDefault(); event.stopImmediatePropagation(); if (typeof logout === 'function') logout(); else { localStorage.clear(); sessionStorage.clear(); location.replace('login.html'); } });
            existingLogout.replaceWith(cleanButton);
            return;
        }

        const avatar = sidebar.querySelector('#panel-user-avatar');
        if (!avatar) return;
        let footer = avatar.parentElement;
        while (footer?.parentElement && footer.parentElement !== sidebar) footer = footer.parentElement;
        if (!footer) return;

        footer.classList.add('flex', 'items-center', 'justify-between', 'gap-3');
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = 'Logout';
        button.className = 'flex-shrink-0 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl transition cursor-pointer text-xs font-medium';
        button.addEventListener('click', () => {
            if (typeof logout === 'function') logout();
            else if (typeof handleLogout === 'function') handleLogout();
            else {
                localStorage.clear();
                location.href = 'login.html';
            }
        });
        footer.appendChild(button);
    }

    function ensureThemeToggle(sidebar) {
        let footer = sidebar.querySelector('.panel-sidebar-bottom-actions');
        if (!footer) {
            footer = document.createElement('div');
            footer.className = 'panel-sidebar-bottom-actions';
            sidebar.appendChild(footer);
        }

        const modes = ['panel', 'dark'];
        const icons = { panel: '🎨', dark: '🌙' };
        const labels = { panel: 'Tema normală a panelului', dark: 'Tema întunecată' };
        const apply = (mode) => {
            document.documentElement.dataset.panelTheme = mode;
            document.documentElement.dataset.theme = 'dark';
            document.documentElement.classList.add('dark');
            document.documentElement.classList.toggle('panel-theme-dark', mode === 'dark');
            document.body.classList.toggle('panel-theme-dark', mode === 'dark');
            const button = document.getElementById('panel-theme-toggle');
            if (button) {
                button.textContent = icons[mode];
                button.title = labels[mode];
                button.setAttribute('aria-label', `${labels[mode]}. Apasă pentru tema următoare.`);
            }
        };

        let mode = localStorage.getItem('panel_theme') || 'panel';
        if (mode === 'system' || mode === 'light' || !modes.includes(mode)) {
            mode = 'panel';
            localStorage.setItem('panel_theme', mode);
        }
        const legacyButton = document.getElementById('theme-toggle-btn');
        const button = legacyButton || document.createElement('button');
        if (legacyButton) legacyButton.removeAttribute('onclick');
        button.id = 'panel-theme-toggle';
        button.type = 'button';
        button.setAttribute('aria-label', 'Schimbă tema');
        button.addEventListener('click', () => {
            mode = modes[(modes.indexOf(mode) + 1) % modes.length];
            localStorage.setItem('panel_theme', mode);
            apply(mode);
        });
        if (button.parentElement !== footer) footer.appendChild(button);
        apply(mode);
    }

    async function setupAssistantWidget(currentPage) {
        // Asistentul este disponibil în tot panelul; conținutul răspunsului
        // este filtrat separat de motor după rol și paginile organizației.
        if (currentPage === 'asistent.html' || document.getElementById('panel-assistant-widget')) return;
        try {
            await loadAssistantScript('panel-assistant-data-script', 'js/asistent-data.js?v=4.8.0', () => Array.isArray(window.PANEL_ASSISTANT_KNOWLEDGE));
            await loadAssistantScript('panel-assistant-core-script', 'js/asistent-core.js?v=4.8.0', () => Boolean(window.PanelAssistantCore));
            await loadAssistantScript('panel-assistant-widget-script', 'js/asistent-widget.js?v=4.8.0', () => Boolean(window.__panelAssistantWidgetLoaded));
        } catch (error) {
            console.warn('Asistentul plutitor nu a putut fi inițializat.', error);
        }
    }

    function createGlobalPageSearch(header, currentPage) {
        const wrapper = document.createElement('div');
        wrapper.className = 'search-container';
        wrapper.style.position = 'relative';
        const input = document.createElement('input');
        input.type = 'search';
        input.id = 'global-search';
        input.className = 'panel-global-search';
        const title = header.querySelector('h1,h2')?.textContent?.trim() || 'pagină';
        input.placeholder = `Caută în ${title}...`;
        input.setAttribute('aria-label', `Caută în ${title}`);
        input.addEventListener('input', () => runGlobalPageSearch(input.value));
        input.addEventListener('keydown', event => {
            if (event.key === 'Escape') {
                input.value = '';
                runGlobalPageSearch('');
                input.blur();
            }
        });
        input.dataset.globalSearchBound = 'true';
        wrapper.appendChild(input);
        header.appendChild(wrapper);
        return input;
    }

    function globalSearchEngine() {
        if (window.__panelAssistantEngine?.findPageMatches) return window.__panelAssistantEngine;
        if (window.PanelAssistantCore && typeof getUser === 'function' && getUser()) {
            window.__panelAssistantEngine = window.PanelAssistantCore.create({ onIndexUpdate: () => undefined });
            return window.__panelAssistantEngine;
        }
        return null;
    }

    function globalSearchResultsHost(input) {
        const host = input.closest('.search-container, .relative') || input.parentElement;
        if (!host) return null;
        host.style.position = 'relative';
        let results = host.querySelector('.panel-global-search-results');
        if (!results) {
            results = document.createElement('div');
            results.className = 'panel-global-search-results';
            results.hidden = true;
            host.appendChild(results);
        }
        return results;
    }

    function renderGlobalSearchLocations(input, query, matches) {
        const results = globalSearchResultsHost(input);
        if (!results) return;
        results.replaceChildren();
        if (!query) {
            results.hidden = true;
            return;
        }
        results.hidden = false;
        if (!matches.length) {
            const empty = document.createElement('div');
            empty.className = 'panel-global-search-empty';
            empty.textContent = 'Nu am găsit această informație în paginile permise rolului tău.';
            results.appendChild(empty);
            return;
        }
        matches.slice(0, 8).forEach((match) => {
            const link = document.createElement('a');
            link.className = 'panel-global-search-result';
            link.href = match.page;
            const title = document.createElement('span');
            title.className = 'panel-global-search-result-title';
            title.textContent = `Deschide ${match.title}`;
            link.appendChild(title);
            if (Array.isArray(match.matches) && match.matches.length) {
                const hits = document.createElement('span');
                hits.className = 'panel-global-search-result-hits';
                hits.textContent = `Potriviri: ${match.matches.join(' · ')}`;
                link.appendChild(hits);
            }
            results.appendChild(link);
        });
    }

    function filterCurrentPageSearch(query) {
        const main = document.querySelector('main');
        if (!main) return;
        const selectorGroups = [
            '.gallery-card',
            'tbody tr',
            '.community-post, .announcement-card, .post',
            '.marketplace-card, .listing-card',
            '[data-searchable]'
        ];
        let items = [];
        for (const selector of selectorGroups) {
            items = Array.from(main.querySelectorAll(selector)).filter(item => !item.closest('header,footer,[role="dialog"]'));
            if (items.length) break;
        }
        if (items.length) {
            items.forEach(item => {
                const visible = !query || item.textContent.toLocaleLowerCase('ro').includes(query);
                item.style.display = visible ? '' : 'none';
            });
            return;
        }
        main.querySelectorAll('.panel-global-search-match').forEach(item => item.classList.remove('panel-global-search-match'));
        if (!query) return;
        const match = Array.from(main.querySelectorAll('h1,h2,h3,h4,a,button,label'))
            .find(item => item.textContent.toLocaleLowerCase('ro').includes(query));
        if (match) {
            match.classList.add('panel-global-search-match');
            match.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    function runGlobalPageSearch(value) {
        const query = String(value || '').trim().toLocaleLowerCase('ro');
        const request = ++globalSearchRequest;
        filterCurrentPageSearch(query);
        if (globalSearchTimer) window.clearTimeout(globalSearchTimer);
        const input = document.getElementById('global-search');
        if (!query || query.length < 2) {
            if (input) renderGlobalSearchLocations(input, '', []);
            return;
        }
        globalSearchTimer = window.setTimeout(async () => {
            const engine = globalSearchEngine();
            if (!engine?.findPageMatches) {
                if (typeof getUser === 'function' && getUser() && request === globalSearchRequest) {
                    globalSearchTimer = window.setTimeout(() => runGlobalPageSearch(query), 420);
                }
                return;
            }
            try {
                const matches = await engine.findPageMatches(query);
                if (request !== globalSearchRequest || !input) return;
                renderGlobalSearchLocations(input, query, matches);
            } catch (error) {
                console.warn('Căutarea globală nu a putut indexa paginile permise.', error);
            }
        }, 260);
    }

    function relocateHeaderActions(currentPage) {
        const header = document.querySelector('header');
        const themeButton = document.getElementById('panel-theme-toggle');
        const sidebar = document.getElementById('panel-shared-sidebar');
        const sidebarFooter = sidebar?.querySelector('.panel-sidebar-bottom-actions');
        if (themeButton && sidebarFooter && themeButton.parentElement !== sidebarFooter) {
            sidebarFooter.appendChild(themeButton);
        }
        if (!header || document.querySelector('.panel-header-tools')) return;

        // Headerul global are deja propriul câmp de căutare. Nu-l mai mutăm
        // într-o bară absolută, deoarece paginile vechi îl așezau pe două rânduri.
        if (header.classList.contains('panel-global-header')) {
            return;
        }

        const tools = document.createElement('div');
        tools.className = 'panel-header-tools';
        const search = document.getElementById('global-search')
            || header.querySelector('.search-container input, input[type="search"], input[placeholder*="Caută"], input[placeholder*="caută"]')
            || createGlobalPageSearch(header, currentPage);
        if (search) {
            search.id = 'global-search';
            search.classList.add('panel-global-search');
            if (search.dataset.globalSearchBound !== 'true') {
                search.addEventListener('input', () => runGlobalPageSearch(search.value));
                search.addEventListener('keydown', event => {
                    if (event.key === 'Escape') {
                        search.value = '';
                        runGlobalPageSearch('');
                        search.blur();
                    }
                });
                search.dataset.globalSearchBound = 'true';
            }
            const originalWrapper = search.closest('.search-container, .relative') || search.parentElement;
            if (originalWrapper) {
                const searchHost = document.createElement('div');
                searchHost.className = 'panel-search-host';
                searchHost.appendChild(originalWrapper);
                tools.appendChild(searchHost);
            }
        }
        header.appendChild(tools);
    }

    function setupAdminSaveArea() {
        const saveButton = document.querySelector('button[onclick="saveAllAdminSettings()"]');
        const main = document.querySelector('main');
        if (!saveButton || !main || document.getElementById('panel-admin-save-area')) return;

        const saveArea = document.createElement('div');
        saveArea.id = 'panel-admin-save-area';
        saveArea.className = 'panel-bottom-save-bar';
        main.appendChild(saveArea);
        saveArea.appendChild(saveButton);
        document.getElementById('panel-page-actions')?.remove();

        let dirty = false;
        const showReminder = () => {
            if (dirty) return;
            dirty = true;
            const reminder = document.createElement('div');
            reminder.id = 'panel-save-reminder';
            reminder.textContent = 'Ai modificări nesalvate. Apasă „Salvează Toate Setările” din partea de jos a paginii.';
            document.body.appendChild(reminder);
        };
        const clearReminder = () => {
            dirty = false;
            document.getElementById('panel-save-reminder')?.remove();
        };

        main.addEventListener('change', (event) => {
            const element = event.target;
            if (!(element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement)) return;
            if (element.id.startsWith('search-') || element.id.startsWith('filter-') || element.id.startsWith('role-select-')) return;
            showReminder();
        });

        const originalSave = window.saveAllAdminSettings;
        if (typeof originalSave === 'function') {
            window.saveAllAdminSettings = async (...args) => {
                const result = await originalSave(...args);
                clearReminder();
                return result;
            };
        }
    }

    function loadOperationsCenter() {
        if (document.getElementById('panel-operations-script')) return;
        const script = document.createElement('script');
        script.id = 'panel-operations-script';
        script.src = 'js/panel-operations.js';
        script.defer = true;
        document.head.appendChild(script);
    }

    // Centrul de operaÈ›iuni este folosit doar pentru funcÈ›ii secundare;
    // Ã®ncÄƒrcarea lui nu trebuie sÄƒ concureze cu pagina curentÄƒ.
    runWhenIdle(loadOperationsCenter, 1600);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup);
    else setup();
})();

// În pagina Anunțuri, toate citirile comunității sunt limitate la organizația activă.
if (window.location.pathname.endsWith('anunturi.html') && window.createPanelSupabaseClient) {
    const createClient = window.createPanelSupabaseClient;
    window.createPanelSupabaseClient = function scopedPanelSupabaseClient() {
        const client = createClient();
        const originalFrom = client.from.bind(client);
        const scopedTables = new Set(['community_posts', 'community_poll_options', 'community_reactions', 'community_poll_votes']);
        client.from = (table) => {
            const query = originalFrom(table);
            if (!scopedTables.has(table)) return query;
            const organizationId = window.getActiveOrganizationId?.() || '00000000-0000-0000-0000-000000000000';
            const originalSelect = query.select.bind(query);
            query.select = (...args) => originalSelect(...args).eq('organization_id', organizationId);
            return query;
        };
        return client;
    };
}

// Compatibilitate pentru pagini mai vechi care apelează explicit această funcție.
window.initializePanelLayout = window.initializePanelLayout || (() => undefined);

// Selector multi-organizație. Este afișat numai după o autentificare validă.
document.addEventListener('DOMContentLoaded', () => {
    let organizations = [];
    try { organizations = JSON.parse(localStorage.getItem('panel_organizations') || '[]'); } catch (_) {}
    const active = window.getActiveOrganization?.();
    const header = document.querySelector('header');
    if (!active || !header || header.querySelector('[data-organization-switcher]')) return;
    document.title = `${document.title.split(' · ')[0]} · ${active.name}`;
    const wrapper = document.createElement('div');
    wrapper.dataset.organizationSwitcher = 'true';
    wrapper.style.cssText = 'margin-left:auto;display:flex;align-items:center;gap:8px;padding-left:12px';
    if (organizations.length > 1) {
        const select = document.createElement('select');
        select.setAttribute('aria-label', 'Organizația activă');
        select.style.cssText = 'max-width:220px;background:#0f172a;color:#e2e8f0;border:1px solid #334155;border-radius:10px;padding:8px 10px;font-size:12px;font-weight:700';
        organizations.forEach((organization) => {
            const option = document.createElement('option');
            option.value = organization.id;
            option.textContent = `${organization.name} · ${organization.panel_role}`;
            option.selected = organization.id === active.id;
            select.appendChild(option);
        });
        select.addEventListener('change', async () => {
            select.disabled = true;
            try {
                const config = window.PANEL_SUPABASE_CONFIG;
                const response = await fetch(`${config.url}/functions/v1/sync-discord-role`, {
                    method:'POST', headers:{'Content-Type':'application/json',apikey:config.publishableKey,Authorization:`Bearer ${config.publishableKey}`},
                    body:JSON.stringify({access_token:localStorage.getItem('discord_access_token'),organization_id:select.value})
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.error || 'Organizația nu poate fi activată.');
                localStorage.setItem('discord_user', JSON.stringify(result.user));
                localStorage.setItem('user_role', result.user.role);
                localStorage.setItem('panel_session_token', result.session_token);
                localStorage.setItem('panel_session_expires_at', result.expires_at);
                localStorage.setItem('panel_active_organization', JSON.stringify(result.active_organization));
                localStorage.setItem('panel_organizations', JSON.stringify(result.organizations || []));
                localStorage.setItem('panel_role_synced_at', String(Date.now()));
                location.reload();
            } catch (error) {
                alert(error instanceof Error ? error.message : 'Schimbarea organizației a eșuat.');
                select.disabled = false; select.value = active.id;
            }
        });
        wrapper.appendChild(select);
    } else {
        const badge = document.createElement('span');
        badge.textContent = active.name;
        badge.style.cssText = 'color:#a7f3d0;border:1px solid #065f46;background:#064e3b55;border-radius:999px;padding:6px 10px;font-size:11px;font-weight:800';
        wrapper.appendChild(badge);
    }
    header.appendChild(wrapper);
});
