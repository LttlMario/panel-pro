MG.register('decrypt', {
    title: 'Decrypt',
    hint: 'Type the highlighted token · ENTER to submit',
    run(api) {
        const diff = Math.max(1, Math.min(5, api.cfg.difficulty || 2));
        const need = 3 + diff;
        const tokenLen = 4 + diff;
        const pool = 'abcdef0123456789xZ#$%&@';

        let cleared = 0, target = '', typed = '';
        api.setDots(need);

        const box = document.createElement('div');
        box.style.cssText = 'width:480px;display:flex;flex-direction:column;gap:14px;';
        box.innerHTML = `
            <div id="stream" style="height:150px;overflow:hidden;font-size:12px;line-height:1.5;
                 color:rgba(57,217,138,0.55);border:1px solid var(--line);border-radius:8px;
                 padding:10px;background:rgba(0,0,0,.3);white-space:pre-wrap;"></div>
            <div style="display:flex;flex-direction:column;gap:8px;align-items:center;">
                <div class="label">DECRYPT TOKEN</div>
                <div id="target" style="font-size:30px;letter-spacing:6px;font-weight:700;"></div>
                <div id="typed" style="font-size:20px;letter-spacing:6px;color:var(--accent);min-height:26px;"></div>
            </div>`;
        api.board.appendChild(box);
        const streamEl = box.querySelector('#stream');
        const targetEl = box.querySelector('#target');
        const typedEl  = box.querySelector('#typed');

        function junk(n) {
            let s = '';
            for (let i = 0; i < n; i++) s += pool[Math.floor(Math.random() * pool.length)];
            return s;
        }
        function newToken() {
            target = ''; typed = '';
            for (let i = 0; i < tokenLen; i++) target += pool[Math.floor(Math.random() * pool.length)];
            render();
        }
        function render() {
            let html = '';
            for (let i = 0; i < target.length; i++) {
                const done = i < typed.length;
                html += `<span style="color:${done ? 'var(--success)' : 'var(--muted)'};">${target[i]}</span>`;
            }
            targetEl.innerHTML = html;
            typedEl.textContent = typed || '\u00A0';
        }

        let lines = [];
        const feedSpeed = 420 - diff * 50;
        const feed = setInterval(() => {
            lines.push('> ' + junk(api.randInt(20, 40)));
            if (lines.length > 9) lines.shift();
            streamEl.textContent = lines.join('\n');
        }, feedSpeed);

        function key(e) {
            if (e.key === 'Enter' || e.code === 'Space') {
                e.preventDefault();
                if (typed === target) {
                    cleared++;
                    const st = []; for (let i = 0; i < need; i++) st[i] = i < cleared ? 'done' : '';
                    api.setDots(need, st);
                    if (cleared >= need) { done(true); return; }
                    newToken();
                } else { api.shake(); typed = ''; render(); }
                return;
            }
            if (e.key === 'Backspace') { typed = typed.slice(0, -1); render(); return; }
            if (e.key.length === 1) {
                const ch = e.key;
                if (target[typed.length] === ch) { typed += ch; render(); }
                else { /* wrong char: small reset */ typed = ''; api.shake(); render(); }
            }
        }
        document.addEventListener('keydown', key);

        function done(ok) {
            clearInterval(feed);
            document.removeEventListener('keydown', key);
            api.stopTimer();
            setTimeout(() => ok ? api.succeed() : api.fail(), 200);
        }

        api.startTimer(Math.max(12, 28 - diff * 2), () => done(false));
        newToken();
        return { destroy() { clearInterval(feed); document.removeEventListener('keydown', key); } };
    }
});
