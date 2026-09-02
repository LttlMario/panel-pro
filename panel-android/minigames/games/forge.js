MG.register('forge', {
    title: 'Blacksmith',
    hint: 'SPACE / click to strike while the metal glows in the green',
    run(api) {
        const diff = Math.max(1, Math.min(5, api.cfg.difficulty || 2));
        const W = 400, H = 280;

        const cvs = document.createElement('canvas');
        cvs.width = W; cvs.height = H;
        cvs.style.cursor = 'pointer';
        api.board.appendChild(cvs);
        const ctx = cvs.getContext('2d');

        const css = getComputedStyle(document.documentElement);
        const acc = (css.getPropertyValue('--accent') || '#00e0b8').trim();
        const suc = (css.getPropertyValue('--success') || '#39d98a').trim();
        const dng = (css.getPropertyValue('--danger') || '#ff3b5c').trim();

        const need = 4 + diff;
        const maxClang = Math.max(2, 5 - diff);
        const lo = 0.55, hi = lo + Math.max(0.14, 0.3 - diff * 0.03);
        const rise = 0.3 + diff * 0.06, drop = (hi - lo) + 0.18;
        let heat = 0.15, made = 0, clang = 0, done = false, flash = 0, last = performance.now();

        api.setDots(need);
        function strike() {
            if (done) return;
            if (heat >= lo && heat <= hi) {
                made++; flash = 6; api.sfx('latch'); heat = Math.max(0.05, heat - drop);
                api.setDots(need, Array.from({ length: need }, (_, i) => i < made ? 'done' : ''));
                if (made >= need) { done = true; api.stopTimer(); api.setTag('FORGED'); document.removeEventListener('keydown', key); setTimeout(() => api.succeed(), 300); }
            } else {
                clang++; api.shake(); api.sfx('error'); heat = Math.max(0.05, heat - 0.1);
                if (clang >= maxClang) { done = true; api.stopTimer(); document.removeEventListener('keydown', key); setTimeout(() => api.fail(), 300); }
            }
        }
        function key(e) { if (e.code === 'Space') { e.preventDefault(); strike(); } }
        document.addEventListener('keydown', key);
        cvs.addEventListener('click', strike);

        api.setTag('HEATING');
        api.startTimer(Math.max(18, 30 - diff * 2), () => { if (!done) { done = true; api.stopTimer(); document.removeEventListener('keydown', key); setTimeout(() => api.fail(), 200); } });

        function heatColor(h) {
            if (h < 0.35) return 'rgb(90,30,20)';
            if (h < lo) return 'rgb(' + Math.round(150 + h * 120) + ',60,30)';
            if (h <= hi) return 'rgb(255,' + Math.round(120 + (h - lo) * 200) + ',40)';
            return 'rgb(255,' + Math.round(220 + h * 35) + ',' + Math.round(150 + h * 100) + ')';
        }

        function draw() {
            const now = performance.now(); const dt = Math.min(0.05, (now - last) / 1000); last = now;
            if (!done) { heat = Math.min(1, heat + rise * dt); if (heat >= 1) { done = true; api.stopTimer(); api.setTag('BURNT'); api.shake(); document.removeEventListener('keydown', key); setTimeout(() => api.fail(), 300); } }
            if (flash > 0) flash--;
            ctx.clearRect(0, 0, W, H);

            // anvil
            ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(W / 2 - 90, H - 70, 180, 26); ctx.fillRect(W / 2 - 30, H - 44, 60, 30);
            // metal bar
            const inB = heat >= lo && heat <= hi;
            ctx.fillStyle = heatColor(heat); ctx.shadowColor = heatColor(heat); ctx.shadowBlur = 10 + heat * 26 + flash * 4;
            ctx.fillRect(W / 2 - 70, H - 92 - (flash ? 4 : 0), 140, 18); ctx.shadowBlur = 0;
            ctx.strokeStyle = inB ? suc : 'rgba(255,255,255,0.15)'; ctx.lineWidth = 2; ctx.strokeRect(W / 2 - 70, H - 92 - (flash ? 4 : 0), 140, 18);

            // heat gauge
            const gx = W - 60, gy = 30, gw = 26, gh = H - 120;
            ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.fillRect(gx, gy, gw, gh);
            ctx.fillStyle = 'rgba(57,217,138,0.18)'; ctx.fillRect(gx, gy + gh * (1 - hi), gw, gh * (hi - lo));
            ctx.fillStyle = 'rgba(255,59,92,0.18)'; ctx.fillRect(gx, gy, gw, gh * 0.06);
            const hy = gy + gh * (1 - heat);
            ctx.fillStyle = inB ? suc : (heat > hi ? dng : acc); ctx.fillRect(gx - 4, hy - 2, gw + 8, 4);
            ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '9px monospace'; ctx.textAlign = 'center'; ctx.fillText('HEAT', gx + gw / 2, H - 78);

            // progress
            ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.font = '11px monospace'; ctx.textAlign = 'center';
            ctx.fillText('SHAPED ' + made + ' / ' + need, W / 2 - 20, 28);
            for (let i = 0; i < maxClang; i++) { ctx.fillStyle = i < clang ? dng : 'rgba(255,255,255,0.15)'; ctx.beginPath(); ctx.arc(20 + i * 14, 22, 4, 0, Math.PI * 2); ctx.fill(); }

            if (!done) loop = requestAnimationFrame(draw);
        }
        let loop = requestAnimationFrame(draw);
        return { destroy() { cancelAnimationFrame(loop); document.removeEventListener('keydown', key); } };
    }
});
