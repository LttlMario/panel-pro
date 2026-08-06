// Permisiuni comune pentru toate paginile panelului.
const Roles = { GUEST: 0 };

const PagePermissions = {
    // Paginile normale cer doar un grad numeric valid.
    "bucatarie.html": 1,
    "calculator.html": 1,
    'index.html': 1,
    'asistent.html': 1,
    'pontaj.html': 1,
    'status-live.html': 1,
    'cereri.html': 1,
    'craftmecanics.html': 1,
    'marketplace.html': 1,
    'anunturi.html': 1,
    'calculatorilegal.html': 1,
    'locatiiilegale.html': 1,
    'marketplace-ilegal.html': 1,
    'rapoarte.html': 1,
    'contracte.html': 1,
    'discord-configurare.html': 99
}
const AdministrativePages = new Set(['admin.html','logs.html','diagnostic.html','discord-configurare.html','organizatii.html','vouchere.html','developer.html','administrare-organizatie.html']);

function isPlatformAdmin() {
    const user = getUser();
    if (!user) return false;
    // Nivelul 99 este administrator platformă, indiferent de eticheta Discord.
    return user.platform_admin === true || Number(user.permission_level) >= 99;
}
function canAccessPage(page) {
    if (AdministrativePages.has(page)) return isPlatformAdmin();
    if (isPlatformAdmin()) return true;
    // Gradul numeric maxim al organizației are acces la toate paginile normale.
    if (getRole() >= 99) return true;
    const user=getUser();
    if (user?.page_permissions_configured === true) return Array.isArray(user.allowed_pages) && user.allowed_pages.includes(page);
    const required=PagePermissions[page];return required===undefined||getRole()>=required;
}

const STORAGE_KEY = 'discord_user';

function isLogged() {
    return getUser() !== null;
}

function getUser() {
    try {
        const userData = localStorage.getItem(STORAGE_KEY);
        return userData ? JSON.parse(userData) : null;
    } catch (error) {
        console.error('Eroare la citirea utilizatorului:', error);
        return null;
    }
}

function getRole() {
    const user = getUser();
    if (!user) return 0;
    if (user.platform_admin === true) return 100;
    const numericRole = Number(user.permission_level ?? user.role ?? user.default_role);
    return Number.isInteger(numericRole) && numericRole >= 0 && numericRole <= 99 ? numericRole : 0;
}

function hasSelectedPages() {
    const pages = getUser()?.allowed_pages;
    return Array.isArray(pages) && pages.length > 0;
}

function hasRole(requiredRole) {
    return getRole() >= requiredRole;
}

function logout() {
    localStorage.clear();
    sessionStorage.clear();
    window.location.replace('login.html');
}

async function refreshLegacyPlatformAdmin(force = false) {
    const token=localStorage.getItem('discord_access_token'),config=window.PANEL_SUPABASE_CONFIG;if(!token||!config)return false;
    const cachedAt=Number(localStorage.getItem('panel_role_synced_at')||0);
    if (!force && Date.now()-cachedAt < 5*60*1000 && getUser()?.permission_level !== undefined) return isPlatformAdmin();
    try{const response=await fetch(`${config.url}/functions/v1/sync-discord-role`,{method:'POST',headers:{'Content-Type':'application/json',apikey:config.publishableKey,Authorization:`Bearer ${config.publishableKey}`},body:JSON.stringify({access_token:token,organization_id:window.getActiveOrganizationId?.()})}),result=await response.json();if(!response.ok)throw new Error(result.error||'Resincronizarea a eșuat.');localStorage.setItem('discord_user',JSON.stringify(result.user));localStorage.setItem('user_role',result.user.role);localStorage.setItem('panel_session_token',result.session_token);localStorage.setItem('panel_session_expires_at',result.expires_at);localStorage.setItem('panel_active_organization',JSON.stringify(result.active_organization));localStorage.setItem('panel_organizations',JSON.stringify(result.organizations||[]));localStorage.setItem('panel_role_synced_at',String(Date.now()));return result.user?.platform_admin===true}catch(error){console.error(error);return false}
}

(function initSecurityMiddleware() {
    const currentPage =
        window.location.pathname.split('/').pop() || 'index.html';

    // Pagini publice.
    if (
        currentPage === 'login.html' ||
        currentPage === '403.html'
    ) {
        return;
    }

    // guest.html necesită autentificare,
    // dar este destinată exclusiv Vizitatorilor.
    if (currentPage === 'guest.html') {
        if (!isLogged()) {
            window.location.href = 'login.html';
            return;
        }

        if (getRole() > Roles.GUEST || hasSelectedPages()) {
            const allowed = getUser()?.allowed_pages;
            window.location.replace(Array.isArray(allowed) && allowed.length ? allowed[0] : 'index.html');
            return;
        }

        return;
    }

    if (!isLogged()) {
        window.location.href = 'login.html';
        return;
    }

    if (AdministrativePages.has(currentPage) && !isPlatformAdmin() && localStorage.getItem('discord_access_token')) {
        document.documentElement.style.visibility='hidden';refreshLegacyPlatformAdmin().then(ok=>{if(ok)location.reload();else{document.documentElement.style.visibility='';location.href='403.html'}});return;
    }

    const currentRole = getRole();

    // Dacă sesiunea locală este veche/incompletă, resincronizăm Discord înainte
    // să trimitem utilizatorul în guest. Astfel un rol real nu rămâne blocat ca vizitator.
    if (currentRole === Roles.GUEST && !hasSelectedPages() && currentPage !== 'guest.html') {
        const token = localStorage.getItem('discord_access_token');
        if (token && !sessionStorage.getItem('panel_role_sync_attempted')) {
            sessionStorage.setItem('panel_role_sync_attempted', '1');
            document.documentElement.style.visibility = 'hidden';
            refreshLegacyPlatformAdmin().then(() => {
                sessionStorage.removeItem('panel_role_sync_attempted');
                window.location.reload();
            }).catch(() => {
                sessionStorage.removeItem('panel_role_sync_attempted');
                document.documentElement.style.visibility = '';
                window.location.href = 'guest.html';
            });
            return;
        }
        window.location.href = 'guest.html';
        return;
    }

    // Dacă utilizatorul primește un rol și încearcă să intre pe guest.html,
    // îl trimitem în panelul principal.
    if (currentRole > Roles.GUEST && currentPage === 'guest.html') {
        window.location.href = 'index.html';
        return;
    }

    if (!canAccessPage(currentPage)) {
        window.location.href = '403.html';
        return;
    }

        document.addEventListener('DOMContentLoaded', () => {
            applyRoleBasedVisibility(getRole());
        });
        // Verifică periodic schimbările de rol fără logout/login.
        if (!window.__panelRoleWatcher) {
            window.__panelRoleWatcher = window.setInterval(async () => {
                if (document.visibilityState === 'hidden' || !localStorage.getItem('discord_access_token') || window.location.pathname.endsWith('organizatii.html')) return;
                const before = localStorage.getItem(STORAGE_KEY) || '';
                await refreshLegacyPlatformAdmin(true);
                const after = localStorage.getItem(STORAGE_KEY) || '';
                if (before && after && before !== after) window.location.reload();
            }, 1800000);
        }
    })();

function applyRoleBasedVisibility(userRole) {
    document.querySelectorAll('[data-role]').forEach((element) => {
        const href=(element.getAttribute('href')||'').split('/').pop();
        if(href&&PagePermissions[href]!==undefined){element.style.display=isPlatformAdmin()||canAccessPage(href)?'':'none';return;}
        const requiredRole = Number.parseInt(
            element.getAttribute('data-role'),
            10
        );

        if (!Number.isNaN(requiredRole)) {
            element.style.display =
                userRole < requiredRole ? 'none' : '';
        }
    });
}
