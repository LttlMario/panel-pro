MG.register('pickpocket', {
    title: 'Pickpocket',
    hint: 'Hold SPACE / mouse to lift · release before they glance',
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

        let progress = 0, suspicion = 0, holding = false, done = false;
        let glanceT = api.rand(1.4, 2.6), glancing = false, glanceLeft = 0, warn = 0;
        const riseP = 0.16 + diff * 0.02;
        const riseS = 0.30 + diff * 0.06;
        const fallS = 0.45 + diff * 0.05;
        let last = performance.now();

        function down(e) { if (e.code === 'Space') { e.preventDefault(); holding = true; } }
        function up(e) { if (e.code === 'Space') { e.preventDefault(); holding = false; } }
        document.addEventListener('keydown', down);
        document.addEventListener('keyup', up);
        cvs.addEventListener('mousedown', () => holding = true);
        cvs.addEventListener('mouseup', () => holding = false);
        cvs.addEventListener('mouseleave', () => holding = false);

        api.setTag('STEADY');
        api.startTimer(Math.max(16, 26 - diff * 2), () => fail('TIME'));
        function clean() { document.removeEventListener('keydown', down); document.removeEventListener('keyup', up); }
        function fail(m) { if (done) return; done = true; api.setTag(m || 'CAUGHT'); api.shake(); clean(); api.stopTimer(); setTimeout(() => api.fail(), 250); }
        function win() { if (done) return; done = true; clean(); api.stopTimer(); api.setTag('LIFTED'); setTimeout(() => api.succeed(), 250); }

        function bar(x, y, w, h, v, col, label) {
            ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(x, y, w, h);
            ctx.fillStyle = col; ctx.fillRect(x, y, w * Math.min(1, v), h);
            ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '9px monospace'; ctx.textAlign = 'left';
            ctx.fillText(label, x, y - 3);
        }

        function draw() {
            const now = performance.now(); const dt = Math.min(0.05, (now - last) / 1000); last = now;
            if (!done) {
                if (!glancing) {
                    glanceT -= dt;
                    warn = glanceT < 0.55 ? (0.55 - glanceT) / 0.55 : 0;
                    if (glanceT <= 0) { glancing = true; glanceLeft = api.rand(0.7, 1.1); }
                } else {
                    glanceLeft -= dt; warn = 1;
                    if (holding) { fail('SPOTTED'); return; }
                    if (glanceLeft <= 0) { glancing = false; glanceT = Math.max(0.9, api.rand(1.3, 2.6) - diff * 0.12); warn = 0; }
                }
                if (holding) { progress = Math.min(1, progress + riseP * dt); suspicion = Math.min(1, suspicion + riseS * dt); }
                else suspicion = Math.max(0, suspicion - fallS * dt);
                if (suspicion >= 1) { fail('TOO BOLD'); return; }
                if (progress >= 1) { win(); return; }
            }

            ctx.clearRect(0, 0, W, H);
            const cx = W / 2, hy = 92;
            ctx.fillStyle = 'rgba(255,255,255,0.08)';
            ctx.beginPath(); ctx.arc(cx, hy, 38, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.moveTo(cx - 58, H - 6); ctx.lineTo(cx - 34, hy + 28); ctx.lineTo(cx + 34, hy + 28); ctx.lineTo(cx + 58, H - 6); ctx.closePath(); ctx.fill();

            const open = 2 + warn * 12;
            ctx.fillStyle = warn > 0.5 ? dng : 'rgba(255,255,255,0.4)';
            ctx.beginPath(); ctx.ellipse(cx, hy - 4, 13, open, 0, 0, Math.PI * 2); ctx.fill();
            if (warn > 0.5) { ctx.fillStyle = '#0a0e14'; ctx.beginPath(); ctx.arc(cx, hy - 4, 4, 0, Math.PI * 2); ctx.fill(); }

            ctx.fillStyle = holding ? acc : 'rgba(255,255,255,0.3)';
            ctx.shadowColor = holding ? acc : 'transparent'; ctx.shadowBlur = holding ? 10 : 0;
            ctx.beginPath(); ctx.arc(cx + 44, hy + 52, holding ? 9 : 6, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;

            bar(40, H - 30, W - 80, 10, progress, acc, 'LIFT ' + Math.round(progress * 100) + '%');
            bar(40, H - 14, W - 80, 8, suspicion, suspicion > 0.7 ? dng : 'rgba(255,150,0,0.85)', 'HEAT');

            if (!done) loop = requestAnimationFrame(draw);
        }
        let loop = requestAnimationFrame(draw);
        return { destroy() { cancelAnimationFrame(loop); clean(); } };
    }
});
