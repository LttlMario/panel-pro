MG.register('breathalyzer', {
    title: 'Breathalyzer',
    hint: 'Hold SPACE / mouse to blow · keep the flow in the green to log a reading',
    run(api) {
        const diff = Math.max(1, Math.min(5, api.cfg.difficulty || 2));
        const W = 360, H = 280;

        const cvs = document.createElement('canvas');
        cvs.width = W; cvs.height = H;
        cvs.style.cursor = 'pointer';
        api.board.appendChild(cvs);
        const ctx = cvs.getContext('2d');

        const css = getComputedStyle(document.documentElement);
        const acc = (css.getPropertyValue('--accent') || '#00e0b8').trim();
        const suc = (css.getPropertyValue('--success') || '#39d98a').trim();
        const dng = (css.getPropertyValue('--danger') || '#ff3b5c').trim();

        const bandH = Math.max(0.16, 0.34 - diff * 0.03);
        const lo = 0.48, hi = lo + bandH;
        const rise = 0.95, drain = 0.85, fillRate = 0.32;
        let flow = 0, reading = 0, hold = false, done = false, last = performance.now();

        function down(e) { if (e.code === 'Space') { e.preventDefault(); hold = true; } }
        function up(e) { if (e.code === 'Space') { e.preventDefault(); hold = false; } }
        document.addEventListener('keydown', down);
        document.addEventListener('keyup', up);
        cvs.addEventListener('mousedown', () => hold = true);
        cvs.addEventListener('mouseup', () => hold = false);
        cvs.addEventListener('mouseleave', () => hold = false);

        api.setTag('BLOW');
        api.startTimer(Math.max(16, 26 - diff * 2), () => fail());
        function clean() { document.removeEventListener('keydown', down); document.removeEventListener('keyup', up); }
        function fail() { if (done) return; done = true; clean(); api.stopTimer(); api.shake(); setTimeout(() => api.fail(), 200); }
        function win() { if (done) return; done = true; clean(); api.stopTimer(); api.setTag('READING LOGGED'); setTimeout(() => api.succeed(), 300); }

        function draw() {
            const now = performance.now(); const dt = Math.min(0.05, (now - last) / 1000); last = now;
            if (!done) {
                flow = Math.max(0, Math.min(1, flow + (hold ? rise : -drain) * dt));
                const inB = flow >= lo && flow <= hi;
                reading = Math.max(0, Math.min(1, reading + (inB ? fillRate : -fillRate * 0.5) * dt));
                if (reading >= 1) { win(); return; }
            }
            ctx.clearRect(0, 0, W, H);

            // flow gauge (vertical)
            const gx = 90, gw = 54, top = 30, bh = H - 80;
            ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.fillRect(gx, top, gw, bh);
            ctx.fillStyle = 'rgba(57,217,138,0.18)'; ctx.fillRect(gx, top + bh * (1 - hi), gw, bh * (hi - lo));
            ctx.strokeStyle = 'rgba(57,217,138,0.5)'; ctx.lineWidth = 1; ctx.strokeRect(gx, top + bh * (1 - hi), gw, bh * (hi - lo));
            const inB = flow >= lo && flow <= hi;
            const fy = top + bh * (1 - flow);
            ctx.fillStyle = inB ? suc : dng; ctx.shadowColor = inB ? suc : dng; ctx.shadowBlur = 12;
            ctx.fillRect(gx - 4, fy - 3, gw + 8, 6); ctx.shadowBlur = 0;
            ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '10px monospace'; ctx.textAlign = 'center'; ctx.fillText('FLOW', gx + gw / 2, H - 38);

            // device + reading bar
            const dxc = 230;
            ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 2;
            ctx.strokeRect(dxc - 36, 60, 72, 120);
            ctx.fillStyle = inB ? 'rgba(57,217,138,0.12)' : 'rgba(255,255,255,0.03)'; ctx.fillRect(dxc - 36, 60, 72, 120);
            ctx.fillStyle = '#fff'; ctx.font = 'bold 22px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(Math.round(reading * 100) + '%', dxc, 120);
            ctx.textBaseline = 'alphabetic';
            ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(dxc - 36, 196, 72, 10);
            ctx.fillStyle = suc; ctx.fillRect(dxc - 36, 196, 72 * reading, 10);
            ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '10px monospace'; ctx.fillText('READING', dxc, 224);

            if (!done) loop = requestAnimationFrame(draw);
        }
        let loop = requestAnimationFrame(draw);
        return { destroy() { cancelAnimationFrame(loop); clean(); } };
    }
});
