// Configurația publică de conectare. Cheia service_role NU se pune aici.
// Logurile din browser sunt dezactivate pentru a nu expune date de sesiune,
// identificatori sau configuratii interne in F12.
(() => {
    const blockedConsoleMethods = [
        'log', 'info', 'warn', 'error', 'debug', 'trace',
        'dir', 'dirxml', 'table', 'group', 'groupCollapsed', 'groupEnd',
        'time', 'timeEnd', 'timeLog', 'count', 'countReset', 'clear',
        'profile', 'profileEnd'
    ];
    blockedConsoleMethods.forEach(method => {
        try { window.console[method] = () => {}; } catch (_) {}
    });
})();

window.PANEL_SUPABASE_CONFIG = Object.freeze({
    url: 'https://vkvsabbbawyiurnaiugo.supabase.co',
    publishableKey: 'sb_publishable_gRM7uXmfknjfFiOg7jjqDA_y-VGPMVD'
});

// Toate cererile către tabele transmit sesiunea opacă verificată de RLS.
window.createPanelSupabaseClient = function createPanelSupabaseClient() {
    const config = window.PANEL_SUPABASE_CONFIG;
    const sessionToken = localStorage.getItem('panel_session_token') || '';
    return window.supabase.createClient(config.url, config.publishableKey, {
        global: { headers: sessionToken ? { 'X-Panel-Session': sessionToken } : {} },
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    });
};

window.getActiveOrganization = function getActiveOrganization() {
    try { return JSON.parse(localStorage.getItem('panel_active_organization') || 'null'); }
    catch (_) { return null; }
};

window.getActiveOrganizationId = function getActiveOrganizationId() {
    return window.getActiveOrganization()?.id || JSON.parse(localStorage.getItem('discord_user') || 'null')?.organization_id || null;
};

window.ensurePanelSession = async function ensurePanelSession() {
    const current = localStorage.getItem('panel_session_token');
    const expires = Number(localStorage.getItem('panel_session_expires_at') || 0);
    if (current && expires > Date.now() + 30_000) return current;
    const discordToken = localStorage.getItem('discord_access_token');
    if (!discordToken) throw new Error('Sesiunea Discord lipsește. Autentifică-te din nou.');
    const response = await fetch(`${window.PANEL_SUPABASE_CONFIG.url}/functions/v1/sync-discord-role`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: window.PANEL_SUPABASE_CONFIG.publishableKey, Authorization: `Bearer ${window.PANEL_SUPABASE_CONFIG.publishableKey}` }, body: JSON.stringify({ access_token: discordToken, organization_id: window.getActiveOrganizationId?.() }) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'Sesiunea panel nu a putut fi reînnoită.');
    localStorage.setItem('discord_user', JSON.stringify(result.user));
    localStorage.setItem('panel_session_token', result.session_token);
    localStorage.setItem('panel_session_expires_at', result.expires_at);
    localStorage.setItem('panel_active_organization', JSON.stringify(result.active_organization));
    localStorage.setItem('panel_organizations', JSON.stringify(result.organizations || []));
    return result.session_token;
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
