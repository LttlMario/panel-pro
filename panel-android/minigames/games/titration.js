MG.register('titration', {
    title: 'Titration',
    hint: 'Hold to pour · stop in the green band · don’t overshoot',
    run(api) {
        const diff = Math.max(1, Math.min(5, api.cfg.difficulty || 2));
        const W = 360, H = 300;

        const cvs = document.createElement('canvas');
        cvs.width = W; cvs.height = H;
        cvs.style.cursor = 'pointer';
        api.board.appendChild(cvs);
        const ctx = cvs.getContext('2d');

        const css = getComputedStyle(document.documentElement);
        const acc = (css.getPropertyValue('--accent') || '#00e0b8').trim();
        const suc = (css.getPropertyValue('--success') || '#39d98a').trim();
        const dng = (css.getPropertyValue('--danger') || '#ff3b5c').trim();

        const rounds = 2 + Math.floor(diff / 2);
        const bandH = Math.max(0.05, 0.13 - diff * 0.012);
        const pourRate = 0.34 + diff * 0.06;
        let round = 0, level = 0, lo = 0, hi = 0, pour = false, done = false, last = performance.now();

        function newTarget() { lo = 0.45 + Math.random() * (0.92 - bandH - 0.45); hi = lo + bandH; level = 0; }
        newTarget();
        api.setDots(rounds);

        function release() {
            if (done || !pour) return; pour = false;
            if (level >= lo && level <= hi) {
                round++; api.sfx('good'); api.setDots(rounds, Array.from({ length: rounds }, (_, i) => i < round ? 'done' : ''));
                if (round >= rounds) { done = true; api.stopTimer(); api.setTag('TITRATED'); setTimeout(() => api.succeed(), 300); return; }
                newTarget();
            } else if (level > hi) { api.shake(); done = true; api.stopTimer(); api.setTag('OVERSHOT'); setTimeout(() => api.fail(), 300); }
            // under the band: stays, player may pour again
        }
        function down(e) { if (e.code === 'Space') { e.preventDefault(); pour = true; } }
        function up(e) { if (e.code === 'Space') { e.preventDefault(); release(); } }
        document.addEventListener('keydown', down);
        document.addEventListener('keyup', up);
        cvs.addEventListener('mousedown', () => pour = true);
        cvs.addEventListener('mouseup', release);
        cvs.addEventListener('mouseleave', release);

        api.setTag('POURING');
        api.startTimer(Math.max(16, 28 - diff * 2), () => { if (!done) { done = true; api.stopTimer(); document.removeEventListener('keydown', down); document.removeEventListener('keyup', up); setTimeout(() => api.fail(), 200); } });

        function draw() {
            const now = performance.now(); const dt = Math.min(0.05, (now - last) / 1000); last = now;
            if (!done && pour) {
                level = Math.min(1, level + pourRate * dt);
                if (level > hi + 0.001) release();
            }
            ctx.clearRect(0, 0, W, H);

            // burette dripping
            const bx = W / 2;
            ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 2; ctx.strokeRect(bx - 8, 14, 16, 40);
            if (pour) { ctx.fillStyle = acc; ctx.beginPath(); ctx.arc(bx, 60 + (performance.now() / 60 % 14), 2.5, 0, Math.PI * 2); ctx.fill(); }

            // beaker
            const beX = bx - 70, beY = 84, beW = 140, beH = H - 120;
            ctx.fillStyle = (level >= lo && level <= hi) ? 'rgba(57,217,138,0.6)' : (level > hi ? 'rgba(255,59,92,0.6)' : 'rgba(0,224,184,0.5)');
            ctx.fillRect(beX, beY + beH * (1 - level), beW, beH * level);
            // target band
            ctx.fillStyle = 'rgba(57,217,138,0.18)'; ctx.fillRect(beX, beY + beH * (1 - hi), beW, beH * (hi - lo));
            ctx.strokeStyle = suc; ctx.lineWidth = 1.5; ctx.strokeRect(beX, beY + beH * (1 - hi), beW, beH * (hi - lo));
            ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(beX, beY); ctx.lineTo(beX, beY + beH); ctx.lineTo(beX + beW, beY + beH); ctx.lineTo(beX + beW, beY); ctx.stroke();

            ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.font = '10px monospace'; ctx.textAlign = 'center';
            ctx.fillText('stop in the green band', bx, H - 14);
            if (!done) loop = requestAnimationFrame(draw);
        }
        let loop = requestAnimationFrame(draw);
        return { destroy() { cancelAnimationFrame(loop); document.removeEventListener('keydown', down); document.removeEventListener('keyup', up); } };
    }
});
