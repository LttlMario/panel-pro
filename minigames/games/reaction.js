MG.register('reaction', {
    title: 'Reaction',
    hint: 'Wait for GREEN, then SPACE / click — don’t jump early',
    run(api) {
        const diff = Math.max(1, Math.min(5, api.cfg.difficulty || 2));
        const rounds = 3;
        const threshold = Math.max(280, 850 - diff * 95);
        const W = 360, H = 240;

        const cvs = document.createElement('canvas');
        cvs.width = W; cvs.height = H;
        cvs.style.cursor = 'pointer';
        api.board.appendChild(cvs);
        const ctx = cvs.getContext('2d');

        let state = 'red', greenAt = 0, round = 0, ended = false, last = 0, waitTO = null;
        api.setDots(rounds);
        scheduleGreen();

        function scheduleGreen() {
            state = 'red';
            const delay = api.rand(900, 2600);
            clearTimeout(waitTO);
            waitTO = setTimeout(() => { state = 'green'; greenAt = performance.now(); }, delay);
        }
        function tap() {
            if (ended) return;
            if (state === 'red') { fail('TOO EARLY'); return; }
            if (state === 'green') {
                const rt = performance.now() - greenAt;
                last = Math.round(rt);
                if (rt <= threshold) {
                    round++;
                    api.setDots(rounds, Array.from({ length: rounds }, (_, i) => i < round ? 'done' : ''));
                    if (round >= rounds) { win(); return; }
                if (round >= rounds) { win(); return; } api.sfx('beep');
                    state = 'wait'; setTimeout(scheduleGreen, 500);
                } else { fail('TOO SLOW ' + last + 'ms'); }
            }
        }
        function key(e) { if (e.code === 'Space') { e.preventDefault(); tap(); } }
        document.addEventListener('keydown', key);
        cvs.addEventListener('click', tap);

        function win() { if (ended) return; ended = true; cleanup(); api.stopTimer(); setTimeout(() => api.succeed(), 250); }
        function fail(msg) { if (ended) return; ended = true; api.setTag(msg || 'FAIL'); api.shake(); cleanup(); api.stopTimer(); setTimeout(() => api.fail(), 250); }
        function cleanup() { clearTimeout(waitTO); document.removeEventListener('keydown', key); }

        api.startTimer(20, () => fail());

        function draw() {
            ctx.clearRect(0, 0, W, H);
            const dng = (getComputedStyle(document.documentElement).getPropertyValue('--danger') || '#ff3b5c').trim();
            const suc = (getComputedStyle(document.documentElement).getPropertyValue('--success') || '#39d98a').trim();
            let col = state === 'green' ? suc : (state === 'wait' ? 'rgba(255,255,255,0.15)' : dng);
            ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 30;
            ctx.beginPath(); ctx.arc(W / 2, H / 2 - 10, 60, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
            ctx.fillStyle = '#0a0e14'; ctx.font = 'bold 16px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(state === 'green' ? 'GO' : (state === 'wait' ? '…' : 'WAIT'), W / 2, H / 2 - 10);
            if (last) { ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '13px monospace'; ctx.fillText('last: ' + last + 'ms (need ≤' + threshold + ')', W / 2, H - 24); }
            if (!ended) loop = requestAnimationFrame(draw);
        }
        let loop = requestAnimationFrame(draw);
        return { destroy() { cancelAnimationFrame(loop); cleanup(); } };
    }
});
