MG.register('lugnuts', {
    title: 'Lug Nuts',
    hint: 'SPACE / click when the torque needle hits the green band',
    run(api) {
        const diff = Math.max(1, Math.min(5, api.cfg.difficulty || 2));
        const W = 300, H = 300, cx = W / 2, cy = H / 2 - 10;

        const cvs = document.createElement('canvas');
        cvs.width = W; cvs.height = H;
        cvs.style.cursor = 'pointer';
        api.board.appendChild(cvs);
        const ctx = cvs.getContext('2d');

        const css = getComputedStyle(document.documentElement);
        const acc = (css.getPropertyValue('--accent') || '#00e0b8').trim();
        const suc = (css.getPropertyValue('--success') || '#39d98a').trim();
        const dng = (css.getPropertyValue('--danger') || '#ff3b5c').trim();

        const N = 5;
        const order = [0, 2, 4, 1, 3]; // star torque pattern
        const nuts = [];
        for (let i = 0; i < N; i++) {
            const a = -Math.PI / 2 + i * (Math.PI * 2 / N);
            nuts.push({ x: cx + Math.cos(a) * 78, y: cy + Math.sin(a) * 78, set: false });
        }
        let step = 0, t = 0, done = false;
        const band = Math.max(0.12, 0.28 - diff * 0.03);
        const lo = 0.6, hi = lo + band;
        const spd = 0.012 + diff * 0.004;

        api.setDots(N);
        function update() { api.setDots(N, order.map((oi, k) => nuts[order[k]].set ? 'done' : (k === step ? 'active' : ''))); }
        update();

        function attempt() {
            if (done) return;
            const ni = order[step];
            if (t >= lo && t <= hi) {
                nuts[ni].set = true; api.sfx('latch'); step++; t = 0; update();
                if (step >= N) { done = true; api.stopTimer(); api.setTag('TORQUED'); setTimeout(() => api.succeed(), 300); }
            } else { api.shake(); api.addTime(-1500); t = 0; }
        }
        function key(e) { if (e.code === 'Space') { e.preventDefault(); attempt(); } }
        document.addEventListener('keydown', key);
        cvs.addEventListener('click', attempt);

        api.setTag('TORQUING');
        api.startTimer(Math.max(14, 26 - diff * 2), () => { if (!done) { done = true; api.stopTimer(); document.removeEventListener('keydown', key); setTimeout(() => api.fail(), 200); } });

        function hexNut(x, y, r, col, glow) {
            ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 6);
            ctx.beginPath();
            for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; const px = Math.cos(a) * r, py = Math.sin(a) * r; k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
            ctx.closePath();
            ctx.fillStyle = col; ctx.shadowColor = glow ? col : 'transparent'; ctx.shadowBlur = glow ? 10 : 0; ctx.fill();
            ctx.restore(); ctx.shadowBlur = 0;
        }

        function draw() {
            if (!done) { t += spd; if (t > 1) t = 0; }
            ctx.clearRect(0, 0, W, H);

            ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 16;
            ctx.beginPath(); ctx.arc(cx, cy, 78, 0, Math.PI * 2); ctx.stroke();
            ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.beginPath(); ctx.arc(cx, cy, 58, 0, Math.PI * 2); ctx.fill();

            const activeNut = done ? -1 : order[step];
            nuts.forEach((n, i) => hexNut(n.x, n.y, 13, n.set ? suc : (i === activeNut ? acc : 'rgba(255,255,255,0.2)'), n.set || i === activeNut));

            const gx = 40, gy = H - 24, gw = W - 80, gh = 12;
            ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(gx, gy, gw, gh);
            ctx.fillStyle = 'rgba(57,217,138,0.3)'; ctx.fillRect(gx + gw * lo, gy, gw * (hi - lo), gh);
            const inB = t >= lo && t <= hi;
            ctx.fillStyle = inB ? suc : acc; ctx.fillRect(gx + gw * t - 2, gy - 3, 4, gh + 6);
            ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '9px monospace'; ctx.textAlign = 'center';
            ctx.fillText('TORQUE  ·  nut ' + Math.min(step + 1, N) + '/' + N, cx, gy - 6);

            if (!done) loop = requestAnimationFrame(draw);
        }
        let loop = requestAnimationFrame(draw);
        return { destroy() { cancelAnimationFrame(loop); document.removeEventListener('keydown', key); } };
    }
});
