MG.register('quicktime', {
    title: 'Quicktime',
    hint: 'Press the keys in order, fast',
    run(api) {
        const diff = Math.max(1, Math.min(5, api.cfg.difficulty || 2));
        const len = 4 + diff * 2;
        const perKey = Math.max(0.7, 2.3 - diff * 0.3);
        const KEYS = ['Q','W','E','R','A','S','D','F','Z','X','C','V'];
        const seq = Array.from({ length: len }, () => KEYS[api.randInt(0, KEYS.length - 1)]);

        let idx = 0, ended = false, keyTimer = null;

        const box = document.createElement('div');
        box.style.cssText = 'display:flex;flex-direction:column;gap:20px;align-items:center;width:480px;';
        box.innerHTML = `
            <div class="label">INPUT SEQUENCE</div>
            <div id="keys" style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;"></div>
            <div id="kbar" style="width:300px;height:6px;border-radius:3px;background:rgba(255,255,255,.1);overflow:hidden;">
                <div id="kfill" style="height:100%;width:100%;background:var(--accent);"></div>
            </div>`;
        api.board.appendChild(box);
        const keysEl = box.querySelector('#keys');
        const kfill = box.querySelector('#kfill');

        function render() {
            keysEl.innerHTML = '';
            seq.forEach((k, i) => {
                const d = document.createElement('div');
                const state = i < idx ? 'done' : (i === idx ? 'active' : '');
                d.style.cssText = `width:42px;height:42px;border-radius:8px;display:grid;place-items:center;
                    font-family:var(--display);font-weight:700;font-size:18px;border:2px solid var(--line);
                    ${state === 'done' ? 'border-color:var(--success);color:var(--success);' : ''}
                    ${state === 'active' ? 'border-color:var(--accent);color:var(--accent);box-shadow:0 0 14px -2px var(--accent);transform:scale(1.12);' : ''}
                    ${state === '' ? 'color:var(--muted);' : ''}`;
                d.textContent = k;
                keysEl.appendChild(d);
            });
        }

        let keyStart = 0, raf = null;
        function startKeyTimer() {
            keyStart = performance.now();
            const tick = () => {
                const el = performance.now() - keyStart;
                const p = Math.max(0, 1 - el / (perKey * 1000));
                kfill.style.width = (p * 100) + '%';
                kfill.style.background = p < 0.3 ? 'var(--danger)' : 'var(--accent)';
                if (p <= 0) { fail(); return; }
                raf = requestAnimationFrame(tick);
            };
            raf = requestAnimationFrame(tick);
        }
        function stopKeyTimer() { if (raf) cancelAnimationFrame(raf); raf = null; }

        function key(e) {
            if (ended) return;
            const k = e.key.toUpperCase();
            if (!KEYS.includes(k)) return;
            e.preventDefault();
            if (k === seq[idx]) {
                idx++; stopKeyTimer(); render();
                if (idx >= len) { win(); return; }
                startKeyTimer();
            } else { fail(); }
        }
        document.addEventListener('keydown', key);

        function win() { if (ended) return; ended = true; cleanup(); api.stopTimer(); setTimeout(() => api.succeed(), 250); }
        function fail() { if (ended) return; ended = true; api.shake(); cleanup(); api.stopTimer(); setTimeout(() => api.fail(), 200); }
        function cleanup() { stopKeyTimer(); document.removeEventListener('keydown', key); }

        api.setTag('REACT');
        api.startTimer(perKey * len + 2, () => fail());
        render(); startKeyTimer();
        return { destroy() { cleanup(); } };
    }
});
