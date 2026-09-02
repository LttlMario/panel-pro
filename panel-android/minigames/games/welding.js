MG.register('welding', {
    title: 'Welding',
    hint: 'Drag the torch along the seam — steady, not too fast',
    run(api) {
        const diff = Math.max(1, Math.min(5, api.cfg.difficulty || 2));
        const W = 460, H = 240;
        const cvs = document.createElement('canvas');
        cvs.width = W; cvs.height = H;
        cvs.style.cursor = 'crosshair';
        api.board.appendChild(cvs);
        const ctx = cvs.getContext('2d');

        const idealSpeed = 2.0;
        const speedTol = Math.max(1.0, 2.6 - diff * 0.32);
        const seamTol = Math.max(10, 24 - diff * 3);

        // Randomized seam path — different shape every run so it can't be memorized.
        // More nodes + bigger vertical swings at higher difficulty.
        const pts = [];
        const segs = api.randInt(5 + diff, 7 + diff * 2);
        const amp = 30 + diff * 8;
        const midY = H / 2;
        let y = midY + api.rand(-amp, amp);
        for (let i = 0; i <= segs; i++) {
            const x = 40 + (W - 80) * (i / segs);
            if (i === 0) {
                // start somewhere in the safe vertical band
                y = midY + api.rand(-amp * 0.5, amp * 0.5);
            } else {
                // random walk with a pull back toward center so it stays on-canvas
                const step = api.rand(-amp, amp) * (0.5 + diff * 0.12);
                y += step + (midY - y) * 0.25;
                y = Math.max(40, Math.min(H - 40, y));
            }
            pts.push({ x, y });
        }
        let progress = 0, heat = 0, lastX = null, ended = false;
        let holding = false;

        function seamY(x) {
            for (let i = 0; i < pts.length - 1; i++) {
                if (x >= pts[i].x && x <= pts[i + 1].x) {
                    const t = (x - pts[i].x) / (pts[i + 1].x - pts[i].x);
                    return pts[i].y + (pts[i + 1].y - pts[i].y) * t;
                }
            }
            return pts[pts.length - 1].y;
        }
        function rel(e) {
            const b = cvs.getBoundingClientRect();
            return { x: (e.clientX - b.left) * (cvs.width / b.width),
                     y: (e.clientY - b.top) * (cvs.height / b.height) };
        }
        cvs.addEventListener('mousedown', () => holding = true);
        window.addEventListener('mouseup', mUp);
        function mUp() { holding = false; lastX = null; }
        cvs.addEventListener('mousemove', (e) => {
            if (!holding || ended) return;
            const p = rel(e);
            const targetX = pts[0].x + (W - 80) * progress / 100;
            const sy = seamY(p.x);
            if (Math.abs(p.y - sy) > seamTol) { heat += 1.6; }
            if (lastX !== null) {
                const dx = p.x - lastX;
                if (dx > 0) {
                    const spd = dx;
                    if (Math.abs(spd - idealSpeed) > speedTol) heat += 0.9;
                    if (p.x >= targetX - 30) progress = Math.min(100, ((p.x - pts[0].x) / (W - 80)) * 100);
                }
            }
            lastX = p.x;
            heat = Math.max(0, heat - 0.3);
            if (heat > 100) { finish(false); return; }
            if (progress >= 99) { finish(true); return; }
        });

        api.setTag('WELDING');
        api.startTimer(Math.max(12, 24 - diff * 2), () => finish(false));
        function finish(ok) { if (ended) return; ended = true; if (!ok) api.shake(); window.removeEventListener('mouseup', mUp); api.stopTimer(); setTimeout(() => ok ? api.succeed() : api.fail(), 250); }

        function draw() {
            const acc = (getComputedStyle(document.documentElement).getPropertyValue('--accent') || '#00e0b8').trim();
            const suc = (getComputedStyle(document.documentElement).getPropertyValue('--success') || '#39d98a').trim();
            const dng = (getComputedStyle(document.documentElement).getPropertyValue('--danger') || '#ff3b5c').trim();
            ctx.clearRect(0, 0, W, H);

            ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = seamTol * 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
            ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke();
            ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 2; ctx.setLineDash([6, 6]);
            ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke(); ctx.setLineDash([]);

            const weldX = pts[0].x + (W - 80) * progress / 100;
            ctx.strokeStyle = suc; ctx.lineWidth = 5; ctx.shadowColor = suc; ctx.shadowBlur = 10;
            ctx.beginPath();
            for (let x = pts[0].x; x <= weldX; x += 3) { const y = seamY(x); x === pts[0].x ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
            ctx.stroke(); ctx.shadowBlur = 0;

            ctx.fillStyle = heat > 60 ? dng : acc; ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 14;
            ctx.beginPath(); ctx.arc(weldX, seamY(weldX), 8, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;

            ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(40, H - 16, W - 80, 6);
            ctx.fillStyle = heat > 60 ? dng : 'rgba(255,140,0,0.8)';
            ctx.fillRect(40, H - 16, (W - 80) * (heat / 100), 6);
            ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.font = '11px monospace'; ctx.textAlign = 'left';
            ctx.fillText('heat', 40, H - 22);
            if (!ended) loop = requestAnimationFrame(draw);
        }
        let loop = requestAnimationFrame(draw);
        return { destroy() { cancelAnimationFrame(loop); window.removeEventListener('mouseup', mUp); } };
    }
});
