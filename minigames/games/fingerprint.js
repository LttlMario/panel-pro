MG.register('fingerprint', {
    title: 'Fingerprint',
    hint: 'Match the scanned print · click the identical one',
    run(api) {
        const diff = Math.max(1, Math.min(5, api.cfg.difficulty || 2));
        const W = 440, H = 300;

        const cvs = document.createElement('canvas');
        cvs.width = W; cvs.height = H;
        cvs.style.cursor = 'pointer';
        api.board.appendChild(cvs);
        const ctx = cvs.getContext('2d');

        const css = getComputedStyle(document.documentElement);
        const acc = (css.getPropertyValue('--accent') || '#00e0b8').trim();

        const rounds = 1 + Math.floor(diff / 2);
        const N = 3 + Math.floor(diff / 1.3);
        const ANG = [0, 1, 2, 3, 4, 5].map(i => i * Math.PI / 3);
        let round = 0, done = false, refRot = 0, cands = [], scan = 0;

        function setup() {
            const pool = ANG.slice();
            for (let i = pool.length - 1; i > 0; i--) { const j = api.randInt(0, i); const t = pool[i]; pool[i] = pool[j]; pool[j] = t; }
            const chosen = pool.slice(0, N);
            refRot = chosen[api.randInt(0, N - 1)];
            const perRow = Math.min(N, 4);
            const cw = W / perRow;
            cands = chosen.map((rot, i) => ({ rot, x: cw * ((i % perRow) + 0.5), y: 156 + Math.floor(i / perRow) * 92, match: rot === refRot }));
        }
        setup();
        api.setDots(rounds);

        function pick(c) {
            if (done) return;
            if (c.match) {
                round++; api.sfx('beep'); api.setDots(rounds, Array.from({ length: rounds }, (_, i) => i < round ? 'done' : ''));
                if (round >= rounds) { done = true; api.stopTimer(); api.setTag('IDENTIFIED'); setTimeout(() => api.succeed(), 300); return; }
                setup();
            } else { api.shake(); done = true; api.stopTimer(); setTimeout(() => api.fail(), 300); }
        }
        cvs.addEventListener('click', (e) => {
            if (done) return;
            const b = cvs.getBoundingClientRect();
            const x = (e.clientX - b.left) * (W / b.width), y = (e.clientY - b.top) * (H / b.height);
            for (const c of cands) if (Math.hypot(x - c.x, y - c.y) < 36) { pick(c); return; }
        });

        api.setTag('SCANNING');
        api.startTimer(Math.max(11, 22 - diff * 2), () => { if (!done) { done = true; api.stopTimer(); setTimeout(() => api.fail(), 200); } });

        function print(cx, cy, R, rot, col, glow) {
            ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot);
            ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.lineCap = 'round';
            if (glow) { ctx.shadowColor = col; ctx.shadowBlur = 10; }
            const gap = 0.55;
            for (let i = 0; i < 6; i++) { const r = 5 + i * (R - 5) / 6; ctx.beginPath(); ctx.arc(0, 0, r, gap, Math.PI * 2 - gap); ctx.stroke(); }
            ctx.shadowBlur = 0;
            ctx.beginPath(); ctx.moveTo(Math.cos(gap) * 5, Math.sin(gap) * 5); ctx.lineTo(R + 4, 0); ctx.stroke();
            ctx.restore();
        }

        function draw() {
            ctx.clearRect(0, 0, W, H);
            ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.font = '10px monospace'; ctx.textAlign = 'center'; ctx.fillText('REFERENCE', W / 2, 18);
            ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.fillRect(W / 2 - 46, 26, 92, 92);
            ctx.strokeStyle = acc; ctx.lineWidth = 1; ctx.strokeRect(W / 2 - 46, 26, 92, 92);
            print(W / 2, 72, 34, refRot, acc, true);
            scan = (scan + 1.3) % 92; ctx.strokeStyle = 'rgba(0,224,184,0.5)'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(W / 2 - 46, 26 + scan); ctx.lineTo(W / 2 + 46, 26 + scan); ctx.stroke();

            cands.forEach(c => { ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1; ctx.strokeRect(c.x - 34, c.y - 34, 68, 68); print(c.x, c.y, 26, c.rot, 'rgba(255,255,255,0.72)', false); });
            if (!done) loop = requestAnimationFrame(draw);
        }
        let loop = requestAnimationFrame(draw);
        return { destroy() { cancelAnimationFrame(loop); } };
    }
});
