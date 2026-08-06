(() => {
    const SUPABASE_URL = window.PANEL_SUPABASE_CONFIG.url;
    const SUPABASE_KEY = window.PANEL_SUPABASE_CONFIG.publishableKey;
    const PENDING_KEY = 'panel_pending_discord_notification';
    window.sendPanelDiscord = async (channel, payload) => {
        const accessToken = localStorage.getItem('discord_access_token');
        if (!accessToken) throw new Error('Sesiunea Discord lipsește. Autentifică-te din nou.');
        let body;
        const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };
        if (payload instanceof FormData) {
            body = payload;
            body.append('_panel_channel', channel);
            body.append('_panel_access_token', accessToken);
        } else {
            headers['Content-Type'] = 'application/json';
            body = JSON.stringify({ channel, payload, access_token: accessToken });
        }
        console.log('====================');
        console.log('SUPABASE_URL:', SUPABASE_URL);
        console.log('Function URL:', `${SUPABASE_URL}/functions/v1/send-discord-notification`);
        console.log('Channel:', channel);
        console.log('====================');
        const response = await fetch(`${SUPABASE_URL}/functions/v1/send-discord-notification`, { method: 'POST', headers, body });
        if (!response.ok) {
            let message = 'Notificarea Discord nu a putut fi trimisă.';
            try { message = (await response.json()).error || message; } catch (_) {}
            if (response.status === 401 && !(payload instanceof FormData)) {
                sessionStorage.setItem(PENDING_KEY, JSON.stringify({ channel, payload }));
                sessionStorage.setItem('panel_return_after_login', window.location.href);
                setTimeout(() => { window.location.href = 'login.html'; }, 800);
                throw new Error('Sesiunea Discord a expirat. Notificarea a fost păstrată și va fi retrimisă după autentificare.');
            }
            throw new Error(`${message} (HTTP ${response.status})`);
        }
        return response;
    };

    document.addEventListener('DOMContentLoaded', async () => {
        const saved = sessionStorage.getItem(PENDING_KEY);
        if (!saved || !localStorage.getItem('discord_access_token')) return;
        try {
            const pending = JSON.parse(saved);
            sessionStorage.removeItem(PENDING_KEY);
            await window.sendPanelDiscord(pending.channel, pending.payload);
        } catch (error) {
            console.error('Retrimiterea notificării Discord a eșuat:', error);
        }
    });
})();
