// ============================================================
// PERMISSIONS.JS
// Sistem de acces bazat pe rolurile Discord + allowed_pages.
// ============================================================

const Roles = {
    GUEST: 0
};

const STORAGE_KEY = 'discord_user';
const PLATFORM_ADMIN_DISCORD_ID = '247012210021236738';

const AdministrativePages = new Set([
    'admin.html',
    'logs.html',
    'diagnostic.html',
    'discord-configurare.html',
    'organizatii.html',
    'vouchere.html',
    'developer.html'
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
    return getUser() !== null;
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
    return String(user.discord_id ?? user.id ?? user.user_id ?? '').trim() === PLATFORM_ADMIN_DISCORD_ID;
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
        .find(value => value && /[\p{L}]/u.test(value) && !/^\d+$/.test(value) && !/^(?:level|nivel|rolul tÄƒu|rol discord|necunoscut|rol)$/i.test(value)) || '';
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
// VERIFICARE ACCES PAGINÄ‚
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

    // Pagina este lÄƒsatÄƒ sÄƒ se Ã®ncarce pentru verificarea proprietarului;
    // accesul efectiv este decis server-side de manage-owned-organization.
    if (page === 'administrare-organizatie.html') {
        return isLogged();
    }

    /*
     * Paginile administrative NU pot fi acordate
     * prin rolurile unei organizaÈ›ii.
     */
    if (AdministrativePages.has(page)) {
        return false;
    }

    /*
     * Pentru utilizatorii organizaÈ›iilor nu mai existÄƒ
     * nivel numeric.
     *
     * Accesul este determinat exclusiv de allowed_pages,
     * calculat dupÄƒ rolurile Discord configurate pentru
     * organizaÈ›ia respectivÄƒ.
     */
    const allowedPages = getAllowedPages();
    return allowedPages.includes(page);
}


// ============================================================
// LOGOUT
// ============================================================

function logout() {
    localStorage.clear();
    sessionStorage.clear();

    window.location.replace('login.html');
}


// ============================================================
// RESINCRONIZARE DISCORD
// ============================================================

async function refreshLegacyPlatformAdmin(force = false) {

    const token =
        localStorage.getItem('discord_access_token');

    const config =
        window.PANEL_SUPABASE_CONFIG;

    if (!token || !config) {
        return false;
    }

    const cachedAt = Number(
        localStorage.getItem('panel_role_synced_at') || 0
    );

    /*
     * DacÄƒ sesiunea este recentÄƒ, nu facem request inutil.
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
                'Resincronizarea a eÈ™uat.'
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
         * PÄƒstrÄƒm aceste valori pentru compatibilitate
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
     * PreferÄƒm Dashboard dacÄƒ utilizatorul are acces.
     */
    if (allowedPages.includes('index.html')) {
        return 'index.html';
    }

    /*
     * Altfel folosim prima paginÄƒ permisÄƒ.
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

        window.location.replace(
            'login.html'
        );

        return;
    }


    // --------------------------------------------------------
    // GUEST
    // --------------------------------------------------------

    if (currentPage === 'guest.html') {

        /*
         * Adminul sau utilizatorul care are cel puÈ›in
         * o paginÄƒ configuratÄƒ nu trebuie sÄƒ rÄƒmÃ¢nÄƒ
         * Ã®n pagina Guest.
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
         * Utilizator autentificat fÄƒrÄƒ rol configurat.
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
            localStorage.getItem(
                'discord_access_token'
            );

        /*
         * Facem o resincronizare Ã®nainte sÄƒ refuzÄƒm accesul,
         * Ã®n cazul Ã®n care sesiunea localÄƒ este veche.
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
    // UTILIZATOR FÄ‚RÄ‚ PAGINI
    // --------------------------------------------------------

    if (
        !isPlatformAdmin() &&
        !hasSelectedPages()
    ) {

        if (currentPage === 'administrare-organizatie.html') {
            return;
        }

        const token =
            localStorage.getItem(
                'discord_access_token'
            );

        /*
         * ÃŽnainte sÄƒ considerÄƒm utilizatorul Guest,
         * verificÄƒm Ã®ncÄƒ o datÄƒ rolurile Discord.
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
    // VERIFICARE PAGINÄ‚ CURENTÄ‚
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
    // RESINCRONIZARE PERIODICÄ‚
    // --------------------------------------------------------

    if (!window.__panelRoleWatcher) {

        window.__panelRoleWatcher =
            window.setInterval(
                async () => {

                    if (
                        document.visibilityState === 'hidden' ||
                        !localStorage.getItem(
                            'discord_access_token'
                        ) ||
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
                     * DacÄƒ rolurile sau paginile permise
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
     * Linkurile cÄƒtre pagini sunt afiÈ™ate numai dacÄƒ
     * utilizatorul poate accesa pagina respectivÄƒ.
     */
    document.querySelectorAll('a[href]').forEach(element => {

        const rawHref =
            element.getAttribute('href') || '';

        /*
         * IgnorÄƒm linkurile externe, ancorele È™i JS.
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


    /*
     * Compatibilitate temporarÄƒ.
     *
     * Unele pagini vechi pot avea Ã®ncÄƒ data-role.
     * Nu mai interpretÄƒm valoarea numericÄƒ.
     *
     * DacÄƒ elementul este un link cÄƒtre o paginÄƒ,
     * accesul este decis de allowed_pages.
     */
    document
        .querySelectorAll('[data-role]')
        .forEach(element => {

            const rawHref =
                element.getAttribute('href') || '';

            if (!rawHref) {
                /*
                 * Nu ascundem automat elementele fÄƒrÄƒ href.
                 * Acestea vor fi curÄƒÈ›ate ulterior din
                 * paginile vechi.
                 */
                return;
            }

            const href =
                rawHref
                    .split('?')[0]
                    .split('#')[0]
                    .split('/')
                    .pop();

            if (
                href &&
                href.endsWith('.html')
            ) {
                element.style.display =
                    canAccessPage(href)
                        ? ''
                        : 'none';
            }
        });

    document.querySelectorAll('[data-nav-section]').forEach(section => {
        const hasVisibleLink = [...section.querySelectorAll('a[href]')]
            .some(link => getComputedStyle(link).display !== 'none');
        section.classList.toggle('is-empty', !hasVisibleLink);
    });
}

// MenÈ›ine sesiunea activÄƒ pentru lista utilizatorilor online din Panoul Admin.
function startPanelSessionHeartbeat() {
    if (window.__panelSessionHeartbeat) return;
    window.__panelSessionHeartbeat = true;

    const sendHeartbeat = async () => {
        if (document.visibilityState === 'hidden') return;

        const token = localStorage.getItem('panel_session_token');
        const config = window.PANEL_SUPABASE_CONFIG;
        if (!token || !config?.url || !config?.publishableKey) return;

        try {
            await fetch(`${config.url}/functions/v1/touch-panel-session`, {
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
        } catch (_) {
            // Lipsa temporarÄƒ a reÈ›elei nu Ã®nchide sesiunea localÄƒ.
        }
    };

    window.setTimeout(sendHeartbeat, 1000);
    window.setInterval(sendHeartbeat, 30000);
}

startPanelSessionHeartbeat();

