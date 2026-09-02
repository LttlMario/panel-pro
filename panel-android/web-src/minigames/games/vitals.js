MG.register('vitals', {
    title: 'Vitals',
    hint: 'Keep every gauge in the green — tap 1 / 2 / 3 to stabilize',
    run(api) {
        const diff = Math.max(1, Math.min(5, api.cfg.difficulty || 2));
        const W = 380, H = 280;

        const cvs = document.createElement('canvas');
        cvs.width = W; cvs.height = H;
        api.board.appendChild(cvs);
        const ctx = cvs.getContext('2d');

        const css = getComputedStyle(document.documentElement);
        const acc = (css.getPropertyValue('--accent') || '#00e0b8').trim();
        const suc = (css.getPropertyValue('--success') || '#39d98a').trim();
        const dng = (css.getPropertyValue('--danger') || '#ff3b5c').trim();

        const labels = ['HR', 'O2', 'BP'];
        const keys = ['Digit1', 'Digit2', 'Digit3'];
        const G = 3;
        const bandH = Math.max(0.16, 0.3 - diff * 0.025);
        const gauges = [];
        for (let i = 0; i < G; i++) { const lo = 0.32 + Math.random() * (0.36 - bandH); gauges.push({ v: 0.5, lo, hi: lo + bandH, vel: 0, drift: 0.05 + diff * 0.02 }); }
        let stab = 0, done = false;
        const stabGain = 0.16;
        let last = performance.now();

        function key(e) { const i = keys.indexOf(e.code); if (i >= 0 && !done) { e.preventDefault(); gauges[i].vel += 0.16; api.sfx('tick'); } }
        document.addEventListener('keydown', key);

        api.setTag('MONITOR');
        api.startTimer(Math.max(20, 34 - diff * 2), () => { if (!done && stab < 1) fail(); });
        function fail() { if (done) return; done = true; document.removeEventListener('keydown', key); api.stopTimer(); api.shake(); setTimeout(() => api.fail(), 200); }
        function win() { if (done) return; done = true; document.removeEventListener('keydown', key); api.stopTimer(); api.setTag('STABLE'); setTimeout(() => api.succeed(), 300); }

        function draw() {
            const now = performance.now(); const dt = Math.min(0.05, (now - last) / 1000); last = now;
            let allIn = true;
            if (!done) {
                gauges.forEach(g => {
                    g.vel += (Math.random() - 0.52) * g.drift * dt * 6;
                    g.vel *= 0.92;
                    g.v = Math.max(0.04, Math.min(0.96, g.v + g.vel * dt * 3));
                    if (g.v < g.lo || g.v > g.hi) allIn = false;
                });
                stab = allIn ? Math.min(1, stab + stabGain * dt) : Math.max(0, stab - stabGain * 0.6 * dt);
                if (stab >= 1) { win(); return; }
            }

            ctx.clearRect(0, 0, W, H);
            const colW = 70, gap = (W - G * colW) / (G + 1), top = 26, bh = H - 96;
            gauges.forEach((g, i) => {
                const x = gap + i * (colW + gap);
                ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.fillRect(x, top, colW, bh);
                ctx.fillStyle = 'rgba(57,217,138,0.18)'; ctx.fillRect(x, top + bh * (1 - g.hi), colW, bh * (g.hi - g.lo));
                ctx.strokeStyle = 'rgba(57,217,138,0.5)'; ctx.lineWidth = 1; ctx.strokeRect(x, top + bh * (1 - g.hi), colW, bh * (g.hi - g.lo));
                const inB = g.v >= g.lo && g.v <= g.hi, ny = top + bh * (1 - g.v);
                ctx.fillStyle = inB ? suc : dng; ctx.shadowColor = inB ? suc : dng; ctx.shadowBlur = 10;
                ctx.fillRect(x - 3, ny - 3, colW + 6, 6); ctx.shadowBlur = 0;
                ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = 'bold 13px monospace'; ctx.textAlign = 'center'; ctx.fillText(labels[i], x + colW / 2, H - 56);
                ctx.fillStyle = acc; ctx.font = '11px monospace'; ctx.fillText('[' + (i + 1) + ']', x + colW / 2, H - 40);
            });

            ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(30, H - 24, W - 60, 10);
            ctx.fillStyle = suc; ctx.fillRect(30, H - 24, (W - 60) * stab, 10);
            ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '9px monospace'; ctx.textAlign = 'left'; ctx.fillText('STABILITY ' + Math.round(stab * 100) + '%', 30, H - 27);

            if (!done) loop = requestAnimationFrame(draw);
        }
        let loop = requestAnimationFrame(draw);
        return { destroy() { cancelAnimationFrame(loop); document.removeEventListener('keydown', key); } };
    }
});
