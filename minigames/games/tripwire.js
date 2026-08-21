MG.register('tripwire', {
    title: 'Tripwire',
    hint: 'Move the mouse to weave past the sweeping lasers · reach the green exit',
    run(api) {
        const diff = Math.max(1, Math.min(5, api.cfg.difficulty || 2));
        const W = 460, H = 300;

        const cvs = document.createElement('canvas');
        cvs.width = W; cvs.height = H;
        cvs.style.cursor = 'crosshair';
        api.board.appendChild(cvs);
        const ctx = cvs.getContext('2d');

        const css = getComputedStyle(document.documentElement);
        const acc = (css.getPropertyValue('--accent') || '#00e0b8').trim();
        const suc = (css.getPropertyValue('--success') || '#39d98a').trim();
        const dng = (css.getPropertyValue('--danger') || '#ff3b5c').trim();

        // Oscillating "wiper" lasers: each pivots from the top or bottom edge and
        // sweeps a bounded fan into the room. They sit at separated x columns and
        // start out of phase, so a clear gap to weave through always exists.
        const count = 2 + Math.floor((diff - 1) / 2); // 2,2,3,3,4
        const L = H * 0.64;
        const sweep = 0.5 + diff * 0.06;
        const beams = [];
        for (let i = 0; i < count; i++) {
            const top = i % 2 === 0;
            beams.push({
                x: 120 + (i + 0.5) * (W - 190) / count,
                y: top ? 10 : H - 10,
                base: top ? Math.PI / 2 : -Math.PI / 2,
                phase: api.rand(0, Math.PI * 2),
                spd: (0.015 + diff * 0.003) * (Math.random() < 0.5 ? 1 : -1),
                ang: 0
            });
        }

        const start = { x: 26, y: H / 2 };
        const av = { x: start.x, y: start.y, r: 8 };
        let mx = start.x, my = start.y, has = false, done = false;

        cvs.addEventListener('mousemove', (e) => {
            const b = cvs.getBoundingClientRect();
            mx = (e.clientX - b.left) * (W / b.width);
            my = (e.clientY - b.top) * (H / b.height);
            has = true;
        });

        api.setTag('INFILTRATING');
        api.startTimer(Math.max(18, 30 - diff * 2), () => fail());
        function fail() { if (done) return; done = true; api.stopTimer(); setTimeout(() => api.fail(), 200); }
        function win() { if (done) return; done = true; api.stopTimer(); api.setTag('CLEAR'); setTimeout(() => api.succeed(), 300); }

        function segDist(px, py, ax, ay, bx, by) {
            const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
            let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
            t = Math.max(0, Math.min(1, t));
            return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
        }

        function draw() {
            if (has) { av.x += (mx - av.x) * 0.4; av.y += (my - av.y) * 0.4; }
            av.x = Math.max(av.r, Math.min(W - av.r, av.x));
            av.y = Math.max(av.r, Math.min(H - av.r, av.y));

            ctx.clearRect(0, 0, W, H);

            const exX = W - 34;
            ctx.fillStyle = 'rgba(57,217,138,0.12)'; ctx.fillRect(exX, 0, W - exX, H);
            ctx.strokeStyle = suc; ctx.lineWidth = 2; ctx.strokeRect(exX, 0, W - exX, H);
            ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(0, 0, 42, H);

            let tripped = false;
            beams.forEach(bm => {
                if (!done) bm.phase += bm.spd;
                bm.ang = bm.base + Math.sin(bm.phase) * sweep;
                const tx = bm.x + Math.cos(bm.ang) * L, ty = bm.y + Math.sin(bm.ang) * L;
                const d = segDist(av.x, av.y, bm.x, bm.y, tx, ty), near = d < 22;
                ctx.strokeStyle = near ? dng : 'rgba(255,59,92,0.5)';
                ctx.lineWidth = 2; ctx.shadowColor = dng; ctx.shadowBlur = near ? 14 : 6;
                ctx.beginPath(); ctx.moveTo(bm.x, bm.y); ctx.lineTo(tx, ty); ctx.stroke(); ctx.shadowBlur = 0;
                ctx.fillStyle = dng; ctx.beginPath(); ctx.arc(bm.x, bm.y, 5, 0, Math.PI * 2); ctx.fill();
                if (d < av.r + 2) tripped = true;
            });

            ctx.fillStyle = tripped ? dng : acc;
            ctx.shadowColor = tripped ? dng : acc; ctx.shadowBlur = 14;
            ctx.beginPath(); ctx.arc(av.x, av.y, av.r, 0, Math.PI * 2); ctx.fill();
            ctx.shadowBlur = 0;

            if (tripped && !done) { api.sfx('zap'); api.shake(); fail(); return; }
            if (av.x > exX && !done) { win(); return; }

            if (!done) loop = requestAnimationFrame(draw);
        }
        let loop = requestAnimationFrame(draw);
        return { destroy() { cancelAnimationFrame(loop); } };
    }
});
