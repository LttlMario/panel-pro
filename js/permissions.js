// ============================================================
// PERMISSIONS.JS
// Sistem de acces bazat pe rolurile Discord + allowed_pages.
// ============================================================

const Roles = {
    GUEST: 0
};

const STORAGE_KEY = 'discord_user';

const AdministrativePages = new Set([
    'admin.html',
    'logs.html',
    'diagnostic.html',
    'discord-configurare.html',
    'organizatii.html',
    'administrare-organizatii-platforma.html',
    'vouchere.html',
    'developer.html',
    'secrete-platforma.html'
]);

// Aceste două pagini sunt publice la nivelul platformei: orice membru cu o
// sesiune validă le poate vedea, indiferent de organizația activă și de rolul
// configurat pentru paginile organizației.
const GlobalPublicPages = new Set([
    'suggestii.html',
    'rate-panel.html'
]);


// ============================================================
// UTILIZATOR
// ============================================================

function getUser() {
    try {
        const userData = localStorage.getItem(STORAGE_KEY);

        return userData
            ? JSON.parse(userData)
            : null;

    } catch (error) {
        console.error(
            'Eroare la citirea utilizatorului:',
            error
        );

        return null;
    }
}


function isLogged() {
    const user = getUser();
    if (!user) return false;

    // A cached profile alone must never open a protected page. The opaque
    // server session is the actual proof that the access was issued and has
    // not expired or been revoked locally.
    const sessionToken = localStorage.getItem('panel_session_token') || '';
    const expiresValue = localStorage.getItem('panel_session_expires_at') || '';
    const expiresAt = Number(expiresValue) || Date.parse(expiresValue) || 0;
    return Boolean(sessionToken && expiresAt > Date.now());
}


// ============================================================
// PLATFORM ADMIN
// ============================================================

function isPlatformAdmin() {
    const user = getUser();

    if (!user) {
        return false;
    }

    // Administratorul platformei este un cont fix, nu un rol Discord.
    return user.platform_admin === true || user.is_platform_admin === true;
}

function getStoredActiveOrganization() {
    try {
        if (typeof getActiveOrganization === 'function') return getActiveOrganization();
        return JSON.parse(localStorage.getItem('panel_active_organization') || 'null');
    } catch (_) {
        return null;
    }
}

function getEffectiveRoleLabel(user = getUser()) {
    const active = getStoredActiveOrganization();
    let storedRole = '';
    let organizations = [];
    try {
        storedRole = localStorage.getItem('user_role') || '';
        organizations = JSON.parse(localStorage.getItem('panel_organizations') || '[]');
        if (!Array.isArray(organizations)) organizations = [];
    } catch (_) {}
    const selectedOrganization = organizations.find((organization) =>
        String(organization?.id || organization?.organization_id || '') === String(active?.id || user?.organization_id || '')
    ) || organizations[0];
    const discordRoleNames = [
        ...(Array.isArray(user?.discord_roles) ? user.discord_roles : []),
        ...(Array.isArray(user?.roles) ? user.roles : [])
    ].map((role) => role?.name || role?.label || role?.panel_role || role?.role || role);
    const candidates = [
        user?.discord_role_name,
        user?.discord_role,
        user?.role_name,
        user?.panel_role,
        user?.role_label,
        user?.organization_role,
        user?.role,
        user?.default_role,
        user?.organization?.panel_role,
        user?.organization?.role,
        user?.active_organization?.panel_role,
        user?.active_organization?.role,
        active?.panel_role,
        active?.discord_role_name,
        active?.role,
        selectedOrganization?.panel_role,
        selectedOrganization?.discord_role_name,
        storedRole,
        ...discordRoleNames
    ];
    return candidates
        .map(value => String(value || '').trim())
        .find(value => value && /[\p{L}]/u.test(value) && !/^\d+$/.test(value) && !/^(?:level|nivel|rolul tău|rol discord|necunoscut|rol)$/i.test(value)) || '';
}


// ============================================================
// PAGINI PERMISE
// ============================================================

function getAllowedPages() {
    const user = getUser();

    if (!user) {
        return [];
    }

    if (!Array.isArray(user.allowed_pages)) {
        return [];
    }

    return user.allowed_pages
        .map(page => String(page || '').trim())
        .filter(Boolean);
}


function hasSelectedPages() {
    return getAllowedPages().length > 0;
}


// ============================================================
// VERIFICARE ACCES PAGINĂ
// ============================================================

function canAccessPage(page) {

    if (!page) {
        return false;
    }

    /*
     * Administratorul platformei are acces peste tot.
     */
    if (isPlatformAdmin()) {
        return true;
    }

    // Pagina este lăsată să se încarce pentru verificarea proprietarului;
    // accesul efectiv este decis server-side de manage-owned-organization.
    if (page === 'administrare-organizatie.html') {
        return isLogged();
    }

    // Orice membru autentificat poate deschide pagina de prelungire;
    // funcția Supabase verifică apartenența la organizație și voucherul.
    if (page === 'prelungire-voucher.html') {
        return isLogged();
    }

    if (GlobalPublicPages.has(page)) {
        return isLogged();
    }

    /*
     * Paginile administrative NU pot fi acordate
     * prin rolurile unei organizații.
     */
    if (AdministrativePages.has(page)) {
        return false;
    }

    /*
     * Pentru utilizatorii organizațiilor nu mai există
     * nivel numeric.
     *
     * Accesul este determinat exclusiv de allowed_pages,
     * calculat după rolurile Discord configurate pentru
     * organizația respectivă.
     */
    const allowedPages = getAllowedPages();
    return allowedPages.includes(page);
}


// ============================================================
// LOGOUT
// ============================================================

function logout() {
    // Drafturile locale ale formularelor trebuie să supraviețuiască logoutului.
    // Păstrăm doar cheile create explicit pentru această funcție și eliminăm sesiunea.
    const localDrafts = Object.entries(localStorage)
        .filter(([key]) => key.startsWith('panel_local_'));
    localStorage.clear();
    localDrafts.forEach(([key, value]) => localStorage.setItem(key, value));
    sessionStorage.clear();

    window.location.replace('login.html');
}


// ============================================================
// RESINCRONIZARE DISCORD
// ============================================================

async function refreshLegacyPlatformAdmin(force = false) {

    const token =
        window.getPanelDiscordAccessToken?.() || '';

    const config =
        window.PANEL_SUPABASE_CONFIG;

    if (!token || !config) {
        return false;
    }

    const cachedAt = Number(
        localStorage.getItem('panel_role_synced_at') || 0
    );

    /*
     * Dacă sesiunea este recentă, nu facem request inutil.
     */
    if (
        !force &&
        Date.now() - cachedAt < 5 * 60 * 1000 &&
        getUser()
    ) {
        return isPlatformAdmin();
    }

    try {

        const response = await fetch(
            `${config.url}/functions/v1/sync-discord-role`,
            {
                method: 'POST',

                headers: {
                    'Content-Type': 'application/json',
                    apikey: config.publishableKey,
                    Authorization:
                        `Bearer ${config.publishableKey}`
                },

                body: JSON.stringify({
                    access_token: token,
                    organization_id:
                        window.getActiveOrganizationId?.()
                })
            }
        );

        const result = await response.json();

        if (!response.ok) {
            if (response.status === 403 && ['NO_ORGANIZATION', 'NO_ROLE', 'ROLE_NOT_CONFIGURED'].includes(String(result.code || ''))) {
                logout();
                return false;
            }
            throw new Error(
                result.error ||
                'Resincronizarea a eșuat.'
            );
        }

        if (result.user) {
            const previousUser = getUser();
            const platformAdminFlag =
                result.user.platform_admin ??
                result.user.is_platform_admin ??
                result.platform_admin ??
                result.is_platform_admin ??
                previousUser?.platform_admin ??
                previousUser?.is_platform_admin;
            if (platformAdminFlag !== undefined) {
                result.user.platform_admin =
                    platformAdminFlag === true ||
                    String(platformAdminFlag).toLowerCase() === 'true';
            }
            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify(result.user)
            );
        }

        /*
         * Păstrăm aceste valori pentru compatibilitate
         * cu restul panelului.
         */
        if (result.user?.role !== undefined) {
            localStorage.setItem(
                'user_role',
                result.user.role
            );
        }

        if (result.session_token) {
            localStorage.setItem(
                'panel_session_token',
                result.session_token
            );
        }

        if (result.expires_at) {
            localStorage.setItem(
                'panel_session_expires_at',
                result.expires_at
            );
        }

        if (result.active_organization) {
            localStorage.setItem(
                'panel_active_organization',
                JSON.stringify(
                    result.active_organization
                )
            );
        }

        localStorage.setItem(
            'panel_organizations',
            JSON.stringify(
                result.organizations || []
            )
        );

        localStorage.setItem(
            'panel_role_synced_at',
            String(Date.now())
        );

        window.dispatchEvent(new CustomEvent('panel-user-updated'));

        return isPlatformAdmin();

    } catch (error) {

        console.error(
            'Eroare la resincronizarea permisiunilor:',
            error
        );

        return false;
    }
}


// ============================================================
// PAGINA DE START A UTILIZATORULUI
// ============================================================

function getDefaultAllowedPage() {

    if (isPlatformAdmin()) {
        return 'index.html';
    }

    const allowedPages =
        getAllowedPages();

    /*
     * Preferăm Dashboard dacă utilizatorul are acces.
     */
    if (allowedPages.includes('index.html')) {
        return 'index.html';
    }

    /*
     * Altfel folosim prima pagină permisă.
     */
    if (allowedPages.length) {
        return allowedPages[0];
    }

    return 'guest.html';
}


// ============================================================
// SECURITY MIDDLEWARE
// ============================================================

(function initSecurityMiddleware() {

    const currentPage =
        window.location.pathname
            .split('/')
            .pop() || 'index.html';


    // --------------------------------------------------------
    // PAGINI PUBLICE
    // --------------------------------------------------------

    if (
        currentPage === 'login.html' ||
        currentPage === '403.html'
    ) {
        return;
    }


    // --------------------------------------------------------
    // AUTENTIFICARE
    // --------------------------------------------------------

    if (!isLogged()) {

        // Păstrăm pagina exactă de unde a pornit relogarea, inclusiv
        // query string-ul ?post=... folosit de linkurile Discord.
        sessionStorage.setItem(
            'panel_return_after_login',
            `${window.location.pathname}${window.location.search}${window.location.hash}`
        );

        window.location.replace(
            'login.html?v=20260819-session-return-fix'
        );

        return;
    }


    // --------------------------------------------------------
    // GUEST
    // --------------------------------------------------------

    if (currentPage === 'guest.html') {

        /*
         * Adminul sau utilizatorul care are cel puțin
         * o pagină configurată nu trebuie să rămână
         * în pagina Guest.
         */
        if (
            isPlatformAdmin() ||
            hasSelectedPages()
        ) {

            window.location.replace(
                getDefaultAllowedPage()
            );

            return;
        }

        /*
         * Utilizator autentificat fără rol configurat.
         */
        return;
    }


    // --------------------------------------------------------
    // PAGINI ADMINISTRATIVE
    // --------------------------------------------------------

    if (
        AdministrativePages.has(currentPage) &&
        !isPlatformAdmin()
    ) {

            const token =
                window.getPanelDiscordAccessToken?.() || '';

        /*
         * Facem o resincronizare înainte să refuzăm accesul,
         * în cazul în care sesiunea locală este veche.
         */
        if (
            token &&
            !sessionStorage.getItem(
                'panel_admin_sync_attempted'
            )
        ) {

            sessionStorage.setItem(
                'panel_admin_sync_attempted',
                '1'
            );

            document.documentElement.style.visibility =
                'hidden';

            refreshLegacyPlatformAdmin(true)
                .then(ok => {

                    sessionStorage.removeItem(
                        'panel_admin_sync_attempted'
                    );

                    if (ok) {
                        window.location.reload();
                        return;
                    }

                    document.documentElement.style.visibility =
                        '';

                    window.location.replace(
                        '403.html'
                    );
                })
                .catch(() => {

                    sessionStorage.removeItem(
                        'panel_admin_sync_attempted'
                    );

                    document.documentElement.style.visibility =
                        '';

                    window.location.replace(
                        '403.html'
                    );
                });

            return;
        }

        window.location.replace(
            '403.html'
        );

        return;
    }


    // --------------------------------------------------------
    // UTILIZATOR FĂRĂ PAGINI
    // --------------------------------------------------------

    if (
        !isPlatformAdmin() &&
        !hasSelectedPages()
    ) {

        if (currentPage === 'administrare-organizatie.html') {
            return;
        }

            const token =
                window.getPanelDiscordAccessToken?.() || '';

        /*
         * Înainte să considerăm utilizatorul Guest,
         * verificăm încă o dată rolurile Discord.
         */
        if (
            token &&
            !sessionStorage.getItem(
                'panel_permission_sync_attempted'
            )
        ) {

            sessionStorage.setItem(
                'panel_permission_sync_attempted',
                '1'
            );

            document.documentElement.style.visibility =
                'hidden';

            refreshLegacyPlatformAdmin(true)
                .then(() => {

                    sessionStorage.removeItem(
                        'panel_permission_sync_attempted'
                    );

                    window.location.reload();
                })
                .catch(() => {

                    sessionStorage.removeItem(
                        'panel_permission_sync_attempted'
                    );

                    document.documentElement.style.visibility =
                        '';

                    window.location.replace(
                        'guest.html'
                    );
                });

            return;
        }

        window.location.replace(
            'guest.html'
        );

        return;
    }


    // --------------------------------------------------------
    // VERIFICARE PAGINĂ CURENTĂ
    // --------------------------------------------------------

    if (!canAccessPage(currentPage)) {

        window.location.replace(
            '403.html'
        );

        return;
    }


    // --------------------------------------------------------
    // VIZIBILITATE MENIU
    // --------------------------------------------------------

    document.addEventListener(
        'DOMContentLoaded',
        () => {
            applyRoleBasedVisibility();
        }
    );


    // --------------------------------------------------------
    // RESINCRONIZARE PERIODICĂ
    // --------------------------------------------------------

    if (!window.__panelRoleWatcher) {

        window.__panelRoleWatcher =
            window.setInterval(
                async () => {

                    if (
                        document.visibilityState === 'hidden' ||
                        !(window.getPanelDiscordAccessToken?.() || '') ||
                        window.location.pathname.endsWith(
                            'organizatii.html'
                        )
                    ) {
                        return;
                    }

                    const before =
                        localStorage.getItem(
                            STORAGE_KEY
                        ) || '';

                    await refreshLegacyPlatformAdmin(
                        true
                    );

                    const after =
                        localStorage.getItem(
                            STORAGE_KEY
                        ) || '';

                    /*
                     * Dacă rolurile sau paginile permise
                     * s-au schimbat, reconstruim pagina.
                     */
                    if (
                        before &&
                        after &&
                        before !== after
                    ) {
                        window.location.reload();
                    }

                },
                1800000
            );
    }

})();


// ============================================================
// VIZIBILITATE ELEMENTE / MENIU
// ============================================================

function applyRoleBasedVisibility() {

    /*
     * Linkurile către pagini sunt afișate numai dacă
     * utilizatorul poate accesa pagina respectivă.
     */
    document.querySelectorAll('a[href]').forEach(element => {

        const rawHref =
            element.getAttribute('href') || '';

        /*
         * Ignorăm linkurile externe, ancorele și JS.
         */
        if (
            !rawHref ||
            rawHref.startsWith('#') ||
            rawHref.startsWith('http://') ||
            rawHref.startsWith('https://') ||
            rawHref.startsWith('mailto:') ||
            rawHref.startsWith('tel:') ||
            rawHref.startsWith('javascript:')
        ) {
            return;
        }

        const href =
            rawHref
                .split('?')[0]
                .split('#')[0]
                .split('/')
                .pop();

        if (!href || !href.endsWith('.html')) {
            return;
        }

        /*
         * Nu ascundem logout/login sau alte pagini publice.
         */
        if (
            href === 'login.html' ||
            href === '403.html' ||
            href === 'guest.html'
        ) {
            return;
        }

        element.style.display =
            canAccessPage(href)
                ? ''
                : 'none';
    });


    document.querySelectorAll('[data-nav-section]').forEach(section => {
        const hasVisibleLink = [...section.querySelectorAll('a[href]')]
            .some(link => getComputedStyle(link).display !== 'none');
        const hidden = !hasVisibleLink;
        section.hidden = hidden;
        section.classList.toggle('is-empty', hidden);
    });
}

// Menține sesiunea activă pentru lista utilizatorilor online din Panoul Admin.
function startPanelSessionHeartbeat() {
    if (window.__panelSessionHeartbeat) return;
    window.__panelSessionHeartbeat = true;

    const sendHeartbeat = async () => {
        if (document.visibilityState === 'hidden') return;

        const token = localStorage.getItem('panel_session_token');
        const config = window.PANEL_SUPABASE_CONFIG;
        if (!token || !config?.url || !config?.publishableKey) return;

        try {
            const response = await fetch(`${config.url}/functions/v1/touch-panel-session`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    apikey: config.publishableKey,
                    Authorization: `Bearer ${config.publishableKey}`,
                    'x-panel-session': token
                },
                body: '{}',
                keepalive: true
            });
            if (response.status === 401 || response.status === 403) {
                const payload = await response.json().catch(() => ({}));
                localStorage.removeItem('panel_session_token');
                localStorage.removeItem('panel_session_expires_at');
                localStorage.removeItem('panel_active_organization');
                localStorage.removeItem('user_role');
                if (!window.__panelRevocationRedirected) {
                    window.__panelRevocationRedirected = true;
                    alert(payload.error || 'Accesul la organizație a fost revocat.');
                    location.replace('login.html?reason=organization_revoked');
                }
            }
        } catch (_) {
            // Lipsa temporară a rețelei nu închide sesiunea locală.
        }
    };

    // Validate immediately on every protected page load so a deleted
    // organization or removed Discord member is not given a stale window.
    sendHeartbeat();
    window.setInterval(sendHeartbeat, 15000);
}

startPanelSessionHeartbeat();
