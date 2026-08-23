const MG = (function () {
    const games = {};
    let current = null;
    let raf = null;
    let timer = null;
    let ended = false;
    let sessionNonce = null;   // per-game token from Lua; required to report a result

    const $ = (id) => document.getElementById(id);
    const setText = (id, value) => { const node = $(id); if (node) node.textContent = value; };

    /* ---- Lua bridge ---- */
    function post(name, body) {
        if (typeof GetParentResourceName !== 'function') return;
        const url = `https://${resName()}/${name}`;
        fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=UTF-8' },
            body: JSON.stringify(body || {})
        }).catch(() => {});
    }
    function resName() {
        return (typeof GetParentResourceName === 'function')
            ? GetParentResourceName() : 'eye_minigames';
    }

    /* ---- Timer ---- */
    function startTimer(seconds, onExpire) {
        timer = { duration: seconds * 1000, start: performance.now(), onExpire };
        tick();
    }
    function tick() {
        if (!timer) return;
        const elapsed = performance.now() - timer.start;
        const remain = Math.max(0, timer.duration - elapsed);
        const pct = remain / timer.duration;
        $('timer-fill').style.width = (pct * 100) + '%';
        $('timer-text').textContent = (remain / 1000).toFixed(1);
        $('timer-fill').style.background = pct < 0.25
            ? 'linear-gradient(90deg, var(--danger), #fff)'
            : 'linear-gradient(90deg, var(--accent), #fff)';
        if (remain <= 0) {
            const fn = timer.onExpire; timer = null;
            if (fn) fn();
            return;
        }
        raf = requestAnimationFrame(tick);
    }
    function stopTimer() {
        if (raf) cancelAnimationFrame(raf);
        raf = null; timer = null;
    }
    function addTime(ms) {
        if (timer) timer.start += ms;
    }

    // Converts per-frame movement to a stable 60 FPS reference step. This keeps
    // the same difficulty on 60 Hz, 120 Hz and 144 Hz displays.
    function frameScale(now, previous) {
        if (!previous) return 1;
        return Math.min(3, Math.max(0.25, (now - previous) / (1000 / 60)));
    }

    /* ---- Round dots ---- */
    function setDots(total, states) {
        const c = $('dots'); if (!c) return; c.innerHTML = '';
        for (let i = 0; i < total; i++) {
            const d = document.createElement('div');
            d.className = 'dot' + (states && states[i] ? ' ' + states[i] : '');
            c.appendChild(d);
        }
    }

    /* ---- Lifecycle ---- */
    function open(payload) {
        ended = false;
        sessionNonce = payload.nonce || null;
        if (typeof SFX !== 'undefined') {
            if (payload.sound === false) SFX.setEnabled(false);
            else SFX.setEnabled(true);
            if (typeof payload.volume === 'number') SFX.setVolume(payload.volume);
        }
        const game = games[payload.game];
        $('root').classList.remove('hidden');
        $('flash').className = 'hidden';

        const name = game ? game.title : payload.game;
        setText('hud-name', name);
        setText('hud-tag', 'SECURE TASK');
        setText('hint', (game && game.hint) ? game.hint : '');
        const board = $('board'); if (!board) return end(false);
        board.innerHTML = '';
        setDots(0);

        if (!game) { return end(false); }

        const api = {
            board,
            cfg: payload,
            startTimer, stopTimer, addTime, setDots,
            setHint: (t) => setText('hint', t || ''),
            setTag:  (t) => setText('hud-tag', t || ''),
            frameScale,
            succeed: () => end(true),
            fail:    () => end(false),
            shake:   () => { $('stage').classList.add('shake');
                             if (typeof SFX !== 'undefined') SFX.play('bad');
                             setTimeout(() => $('stage').classList.remove('shake'), 320); },
            sfx:     (name) => { if (typeof SFX !== 'undefined') SFX.play(name); },
            rand: (a, b) => a + Math.random() * (b - a),
            randInt: (a, b) => Math.floor(a + Math.random() * (b - a + 1))
        };

        current = game.run(api) || {};
        $('hud-timer').style.visibility = timer ? 'visible' : 'visible';
    }

    function cleanup() {
        stopTimer();
        if (current && typeof current.destroy === 'function') {
            try { current.destroy(); } catch (e) {}
        }
        current = null;
        document.onkeydown = null;
    }

    function end(success) {
        if (ended) return;
        ended = true;
        cleanup();
        if (typeof SFX !== 'undefined') SFX.play(success ? 'success' : 'fail');

        const flash = $('flash');
        flash.className = success ? 'win' : 'lose';
        $('flash-text').textContent = success ? 'Success' : 'Failed';

        setTimeout(() => {
            $('root').classList.add('hidden');
            flash.className = 'hidden';
            $('board').innerHTML = '';
            post('result', { success: success, nonce: sessionNonce });
            sessionNonce = null;
        }, 850);
    }

    function cancelCurrent() {
        if (ended || !current) return;
        if (current.__allowCancel !== false) end(false);
    }

    $('mg-close')?.addEventListener('click', cancelCurrent);

    /* ---- Global cancel key ---- */
    document.addEventListener('keydown', (e) => {
        if (ended || !current) return;
        if (e.key === 'Escape') {
            const allow = current.__allowCancel !== false;
            if (allow) {
                e.preventDefault();
                e.stopPropagation();
                cancelCurrent();
            }
        }
    });

    /* ---- Message in from Lua ---- */
    window.addEventListener('message', (ev) => {
        const d = ev.data || {};
        if (d.action === 'open') open(d.payload || {});
    });

    return {
        games,
        open,
        register(id, def) { games[id] = def; },
        _internal: { end }
    };
})();

if (typeof window !== 'undefined') window.MG = MG;
