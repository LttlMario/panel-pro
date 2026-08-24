(() => {
    const SUPABASE_URL = window.PANEL_SUPABASE_CONFIG.url;
    const SUPABASE_KEY = window.PANEL_SUPABASE_CONFIG.publishableKey;

    const PENDING_KEY = 'panel_pending_discord_notification';

    window.sendPanelDiscord = async (channel, payload, options = {}) => {
        const accessToken = window.getPanelDiscordAccessToken?.() || '';

        // Reface automat contextul dacă panelul a păstrat tokenul, dar a
        // pierdut organizația activă din localStorage.
        if (typeof window.ensurePanelSession === 'function') await window.ensurePanelSession();

        const panelSessionToken = localStorage.getItem('panel_session_token');
        if (!panelSessionToken) throw new Error('Sesiunea securizată a panelului lipsește. Reautentifică-te.');

        // Identificăm organizația activă a utilizatorului.
        const organizationId = window.PANEL_ACTIVE_ORGANIZATION_ID || window.getActiveOrganizationId?.() || null;

        if (!window.isPanelOrganizationId?.(organizationId)) {
            throw new Error('Organizația activă nu a fost identificată.');
        }

        let body;

        const headers = {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            'x-panel-session': panelSessionToken
        };

        // Pentru notificările care conțin fișiere.
        if (payload instanceof FormData) {
            body = payload;

            body.append('_panel_channel', channel);
            if (accessToken) body.append('_panel_access_token', accessToken);
            body.append('_panel_organization_id', organizationId);
        } else {
            // Pentru notificările JSON normale.
            headers['Content-Type'] = 'application/json';

            body = JSON.stringify({
                channel,
                payload,
                message_key: options?.messageKey ? String(options.messageKey) : '',
                organization_id: organizationId
            });
        }

        const response = await fetch(
            `${SUPABASE_URL}/functions/v1/send-discord-notification`,
            {
                method: 'POST',
                headers,
                body
            }
        );

        if (!response.ok) {
            let message = 'Notificarea Discord nu a putut fi trimisă.';

            try {
                message = (await response.json()).error || message;
            } catch (_) {}

            if (
                response.status === 401 &&
                !(payload instanceof FormData)
            ) {
                sessionStorage.setItem(
                    PENDING_KEY,
                    JSON.stringify({
                        channel,
                        payload,
                        options: options || {}
                    })
                );

                sessionStorage.setItem(
                    'panel_return_after_login',
                    window.location.href
                );

                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 800);

                throw new Error(
                    'Sesiunea Discord a expirat. Notificarea a fost păstrată și va fi retrimisă după autentificare.'
                );
            }

            throw new Error(
                `${message} (HTTP ${response.status})`
            );
        }

        return response;
    };

    // Dacă o notificare a rămas în așteptare din cauza expirării
    // sesiunii Discord, încercăm retrimiterea după autentificare.
    document.addEventListener('DOMContentLoaded', async () => {
        const saved = sessionStorage.getItem(PENDING_KEY);

        if (
            !saved ||
            !(window.getPanelDiscordAccessToken?.() || '')
        ) {
            return;
        }

        try {
            const pending = JSON.parse(saved);

            sessionStorage.removeItem(PENDING_KEY);

            await window.sendPanelDiscord(
                pending.channel,
                pending.payload,
                pending.options || {}
            );
        } catch (error) {
            console.error(
                'Retrimiterea notificării Discord a eșuat:',
                error
            );
        }
    });
})();
