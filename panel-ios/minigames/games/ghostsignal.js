MG.register('ghostsignal', {
    title: 'Ghost Signal',
    hint: '↑↓ frequency · ←→ phase · lock to match',
    run(api) {
        const diff = Math.max(1, Math.min(5, api.cfg.difficulty || 2));
        const W = 480, H = 240;
        const cvs = document.createElement('canvas');
        cvs.width = W; cvs.height = H;
        api.board.appendChild(cvs);
        const ctx = cvs.getContext('2d');

        const tol = Math.max(0.04, 0.16 - diff * 0.022);
        const noise = 4 + diff * 3;
        const targetF = api.rand(0.6, 2.2);
        const targetP = api.rand(0, Math.PI * 2);
        let f = api.rand(0.6, 2.2), p = api.rand(0, Math.PI * 2);
        let lockT = 0;
        const needLock = 55;

        api.startTimer(Math.max(12, 24 - diff * 2), () => { unbind(); api.fail(); });

        function key(e) {
            if (e.code === 'ArrowUp')    { f += 0.04; e.preventDefault(); }
            if (e.code === 'ArrowDown')  { f -= 0.04; e.preventDefault(); }
            if (e.code === 'ArrowLeft')  { p -= 0.12; e.preventDefault(); }
            if (e.code === 'ArrowRight') { p += 0.12; e.preventDefault(); }
            f = Math.max(0.4, Math.min(2.6, f));
        }
        document.addEventListener('keydown', key);
        function unbind() { document.removeEventListener('keydown', key); }

        function wave(fr, ph, amp, color, glow) {
            ctx.strokeStyle = color; ctx.lineWidth = 2;
            ctx.shadowColor = glow ? color : 'transparent'; ctx.shadowBlur = glow ? 10 : 0;
            ctx.beginPath();
            for (let x = 0; x <= W; x += 2) {
                const t = (x / W) * Math.PI * 6;
                const y = H / 2 - Math.sin(t * fr + ph) * amp
                    + (glow ? 0 : (Math.random() - 0.5) * noise);
                x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
            }
            ctx.stroke(); ctx.shadowBlur = 0;
        }

        function draw() {
            ctx.clearRect(0, 0, W, H);
            wave(targetF, targetP, 60, 'rgba(255,255,255,0.22)', false);
            const acc = getComputedStyle(document.documentElement).getPropertyValue('--accent') || '#00e0b8';
            wave(f, p, 60, acc, true);

            const df = Math.abs(f - targetF);
            let dp = Math.abs(((p - targetP) % (Math.PI * 2)));
            dp = Math.min(dp, Math.PI * 2 - dp) / Math.PI;
            const locked = df < tol && dp < tol;

            if (locked) { lockT++; api.setTag('LOCKING ' + Math.round(lockT / needLock * 100) + '%'); }
            else { lockT = Math.max(0, lockT - 2); api.setTag('SCANNING'); }

            ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(20, H - 14, W - 40, 6);
            ctx.fillStyle = acc; ctx.fillRect(20, H - 14, (W - 40) * (lockT / needLock), 6);

            if (lockT >= needLock) { api.stopTimer(); unbind(); setTimeout(() => api.succeed(), 200); return; }
            loop = requestAnimationFrame(draw);
        }
        let loop = requestAnimationFrame(draw);
        return { destroy() { cancelAnimationFrame(loop); unbind(); } };
    }
});
