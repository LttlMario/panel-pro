// Configurația publică de conectare. Cheia service_role NU se pune aici.
// Consola rămâne disponibilă pentru diagnosticarea erorilor de autentificare.
// Nu logăm tokenuri sau date private în acest fișier.

window.PANEL_SUPABASE_CONFIG = Object.freeze({
    url: 'https://vkvsabbbawyiurnaiugo.supabase.co',
    publishableKey: 'sb_publishable_gRM7uXmfknjfFiOg7jjqDA_y-VGPMVD'
});

// Logurile de depanare nu sunt afișate în producție. Pentru diagnostic local,
// setează window.PANEL_DEBUG = true înainte de încărcarea acestui fișier.
window.PANEL_DEBUG = window.PANEL_DEBUG === true;
if (!window.PANEL_DEBUG) {
    const quietConsole = () => {};
    ['log', 'info', 'debug', 'warn'].forEach((method) => { console[method] = quietConsole; });
}

// Sesiunile opace au o durată limitată. Curățăm imediat tokenul expirat,
// ca browserul să nu-l mai trimită către funcții sau către Supabase REST.
window.clearPanelSession = function clearPanelSession() {
    localStorage.removeItem('panel_session_token');
    localStorage.removeItem('panel_session_expires_at');
    window.clearPanelDiscordAccessToken?.();
};

// Discord OAuth tokens are bearer credentials. Keep them only in the current
// tab and migrate any legacy localStorage value once, then remove it.
window.getPanelDiscordAccessToken = function getPanelDiscordAccessToken() {
    return window.sessionStorage.getItem('discord_access_token') || '';
};
window.setPanelDiscordAccessToken = function setPanelDiscordAccessToken(token) {
    window.localStorage.removeItem('discord_access_token');
    if (token) window.sessionStorage.setItem('discord_access_token', String(token));
    else window.sessionStorage.removeItem('discord_access_token');
};
window.clearPanelDiscordAccessToken = function clearPanelDiscordAccessToken() {
    window.localStorage.removeItem('discord_access_token');
    window.sessionStorage.removeItem('discord_access_token');
};
(() => {
    const legacyToken = window.localStorage.getItem('discord_access_token');
    if (legacyToken) window.setPanelDiscordAccessToken(legacyToken);
})();
(() => {
    const expires = Number(localStorage.getItem('panel_session_expires_at') || 0);
    if (expires && expires <= Date.now()) window.clearPanelSession();
})();

// Toate cererile către tabele transmit sesiunea opacă verificată de RLS.
// Refolosim clientul pentru a evita mai multe GoTrueClient-uri în aceeași pagină.
let panelSupabaseClientCache = null;

window.createPanelSupabaseClient = function createPanelSupabaseClient() {
    const config = window.PANEL_SUPABASE_CONFIG;
    if (panelSupabaseClientCache) return panelSupabaseClientCache;

    panelSupabaseClientCache = window.supabase.createClient(config.url, config.publishableKey, {
        global: {
            fetch(input, init = {}) {
                const headers = new Headers(init.headers || {});
                const sessionToken = localStorage.getItem('panel_session_token') || '';
                if (sessionToken) headers.set('X-Panel-Session', sessionToken);
                return window.fetch(input, { ...init, headers });
            }
        },
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    });
    return panelSupabaseClientCache;
};

// Directorul folosit în paginile unei organizații trebuie construit din
// membrii acelei organizații. Tabelul users este o identitate globală și nu
// trebuie citit fără această limitare.
window.loadPanelOrganizationDirectory = async function loadPanelOrganizationDirectory(organizationId) {
    const normalizedOrganizationId = String(organizationId || '').trim();
    if (!normalizedOrganizationId) {
        return { data: [], error: new Error('Organizația activă nu a fost identificată.') };
    }

    const db = window.createPanelSupabaseClient();
    const { data: members, error: memberError } = await db
        .from('organization_members')
        .select('discord_id')
        .eq('organization_id', normalizedOrganizationId)
        .eq('active', true);

    if (memberError) return { data: [], error: memberError };

    const ids = [...new Set((members || [])
        .map((member) => String(member.discord_id || '').trim())
        .filter(Boolean))];
    if (!ids.length) return { data: [], error: null };

    return db
        .from('users')
        .select('discord_id,display_name,username')
        .in('discord_id', ids);
};

// Client separat pentru conturile email. Nu îl folosim pentru permisiunile panelului;
// acesta gestionează doar sesiunea Auth, confirmarea emailului și recuperarea parolei.
const panelAuthClientCache = new Map();
window.createPanelAuthClient = function createPanelAuthClient(options = {}) {
    const config = window.PANEL_SUPABASE_CONFIG;
    const persistSession = options.persistSession !== false;
    const cacheKey = persistSession ? 'persistent' : 'tab';
    if (panelAuthClientCache.has(cacheKey)) return panelAuthClientCache.get(cacheKey);
    const storage = persistSession ? window.localStorage : window.sessionStorage;
    const client = window.supabase.createClient(config.url, config.publishableKey, {
        auth: {
            persistSession,
            autoRefreshToken: true,
            detectSessionInUrl: true,
            storage,
            storageKey: persistSession ? 'panel-email-auth' : 'panel-email-auth-tab'
        }
    });
    panelAuthClientCache.set(cacheKey, client);
    return client;
};

window.isPanelOrganizationId = function isPanelOrganizationId(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '').trim());
};

window.getActiveOrganization = function getActiveOrganization() {
    try {
        const value = JSON.parse(localStorage.getItem('panel_active_organization') || 'null');
        const id = [value?.id, value?.organization_id]
            .map(candidate => String(candidate || '').trim())
            .find(candidate => window.isPanelOrganizationId(candidate)) || '';
        if (!window.isPanelOrganizationId(id)) return null;
        return { ...value, id: String(id).trim() };
    } catch (_) {
        return null;
    }
};

window.getActiveOrganizationId = function getActiveOrganizationId() {
    let candidate = window.getActiveOrganization()?.id || null;
    if (!candidate) {
        try { candidate = JSON.parse(localStorage.getItem('discord_user') || 'null')?.organization_id || null; }
        catch (_) { candidate = null; }
    }
    const value = String(candidate || '').trim();
    return window.isPanelOrganizationId(value) ? value : null;
};

let panelSessionRefreshPromise = null;

window.panelRequest = async function panelRequest(functionName, options = {}) {
    const config = window.PANEL_SUPABASE_CONFIG;
    const method = String(options.method || 'GET').toUpperCase();
    const timeoutMs = Number(options.timeoutMs || 15000);
    const canRetry = options.retry === true && ['GET', 'HEAD', 'OPTIONS'].includes(method);
    const attempts = canRetry ? 2 : 1;
    const endpoint = String(functionName || '').replace(/^\/+/, '');

    if (!endpoint) throw new Error('Funcția Supabase nu a fost specificată.');

    for (let attempt = 0; attempt < attempts; attempt += 1) {
        const controller = typeof AbortController === 'function' ? new AbortController() : null;
        const timeout = controller ? window.setTimeout(() => controller.abort(), timeoutMs) : null;
        const headers = new Headers(options.headers || {});
        headers.set('Content-Type', 'application/json');
        headers.set('apikey', config.publishableKey);
        headers.set('Authorization', `Bearer ${config.publishableKey}`);

        const panelSession = localStorage.getItem('panel_session_token');
        if (panelSession) headers.set('X-Panel-Session', panelSession);

        try {
            const response = await fetch(`${config.url}/functions/v1/${endpoint}`, {
                ...options,
                method,
                headers,
                signal: options.signal || controller?.signal
            });

            if (timeout) window.clearTimeout(timeout);
            if (response.status === 401 && endpoint !== 'sync-discord-role') window.clearPanelSession();
            if (canRetry && attempt + 1 < attempts && [408, 429, 500, 502, 503, 504].includes(response.status)) {
                await new Promise(resolve => window.setTimeout(resolve, 250));
                continue;
            }
            return response;
        } catch (error) {
            if (timeout) window.clearTimeout(timeout);
            if (attempt + 1 >= attempts) throw error;
            await new Promise(resolve => window.setTimeout(resolve, 250));
        }
    }
};

window.panelRequestJson = async function panelRequestJson(functionName, options = {}) {
    const response = await window.panelRequest(functionName, options);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error(payload.error || payload.message || `Cererea a eșuat (${response.status}).`);
        error.status = response.status;
        error.payload = payload;
        throw error;
    }
    return payload;
};

window.ensurePanelSession = async function ensurePanelSession() {
    const current = localStorage.getItem('panel_session_token');
    const expires = Number(localStorage.getItem('panel_session_expires_at') || 0);
    const activeOrganizationId = window.getActiveOrganizationId?.();
    // Un token valid nu este suficient: paginile au nevoie și de organizația
    // activă salvată pentru filtrarea datelor și rutarea notificărilor.
    if (current && expires > Date.now() + 30_000 && activeOrganizationId) return current;
    if (panelSessionRefreshPromise) return panelSessionRefreshPromise;

    panelSessionRefreshPromise = (async () => {
        // Versiunile vechi puteau lăsa un ID numeric în browser. Nu îl
        // reutilizăm pentru sesiune, pagini sau webhook-uri.
        if (!activeOrganizationId) {
            localStorage.removeItem('panel_active_organization');
            try {
                const cachedUser = JSON.parse(localStorage.getItem('discord_user') || 'null');
                if (cachedUser && cachedUser.organization_id && !window.isPanelOrganizationId(cachedUser.organization_id)) {
                    delete cachedUser.organization_id;
                    localStorage.setItem('discord_user', JSON.stringify(cachedUser));
                }
            } catch (_) {}
        }
        const discordToken = window.getPanelDiscordAccessToken();
        if (!discordToken) throw new Error('Sesiunea Discord lipsește. Autentifică-te din nou.');
        const result = await window.panelRequestJson('sync-discord-role', {
            method: 'POST',
            body: JSON.stringify({ access_token: discordToken, organization_id: window.getActiveOrganizationId?.() })
        });
        if (!result.session_token || !result.active_organization?.id) throw new Error('Organizația activă nu a putut fi identificată. Selectează din nou organizația.');
        localStorage.setItem('discord_user', JSON.stringify(result.user));
        localStorage.setItem('user_role', result.user?.role || result.active_organization?.panel_role || '');
        localStorage.setItem('panel_session_token', result.session_token);
        localStorage.setItem('panel_session_expires_at', result.expires_at);
        localStorage.setItem('panel_active_organization', JSON.stringify(result.active_organization));
        localStorage.setItem('panel_organizations', JSON.stringify(result.organizations || []));
        return result.session_token;
    })().finally(() => {
        panelSessionRefreshPromise = null;
    });

    return panelSessionRefreshPromise;
};

// Atașează sesiunea numai apelurilor Edge Functions ale proiectului curent.
const panelNativeFetch = window.fetch.bind(window);
window.fetch = function panelAuthenticatedFetch(input, init = {}) {
    const url = typeof input === 'string' ? input : input?.url || '';
    const functionPrefix = `${window.PANEL_SUPABASE_CONFIG.url}/functions/v1/`;
    if (!String(url).startsWith(functionPrefix)) return panelNativeFetch(input, init);
    const sessionToken = localStorage.getItem('panel_session_token');
    if (!sessionToken) return panelNativeFetch(input, init);
    const headers = new Headers(init.headers || (typeof input !== 'string' ? input.headers : undefined));
    headers.set('X-Panel-Session', sessionToken);
    return panelNativeFetch(input, { ...init, headers });
};
