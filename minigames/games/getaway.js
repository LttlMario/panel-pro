MG.register('getaway', {
    title: 'Getaway',
    hint: 'A / D (or ← →) to switch lanes · dodge traffic until you’re clear',
    run(api) {
        const diff = Math.max(1, Math.min(5, api.cfg.difficulty || 2));
        const lanes = 3;
        const W = 300, H = 330;

        const cvs = document.createElement('canvas');
        cvs.width = W; cvs.height = H;
        api.board.appendChild(cvs);
        const ctx = cvs.getContext('2d');

        const css = getComputedStyle(document.documentElement);
        const acc = (css.getPropertyValue('--accent') || '#00e0b8').trim();
        const suc = (css.getPropertyValue('--success') || '#39d98a').trim();
        const dng = (css.getPropertyValue('--danger') || '#ff3b5c').trim();

        const laneX = (i) => (W / lanes) * (i + 0.5);
        let targetLane = 1, carX = laneX(1);
        const carW = 36, carH = 58, carY = H - 70;
        let done = false, dash = 0, spawnT = 0;
        const speed = 3 + diff * 0.7;
        const spawnEvery = Math.max(22, 60 - diff * 7);
        const traffic = [];

        function key(e) {
            if (done) return;
            if (e.code === 'ArrowLeft' || e.code === 'KeyA') { targetLane = Math.max(0, targetLane - 1); api.sfx('tick'); }
            else if (e.code === 'ArrowRight' || e.code === 'KeyD') { targetLane = Math.min(lanes - 1, targetLane + 1); api.sfx('tick'); }
        }
        document.addEventListener('keydown', key);

        api.setTag('FLOOR IT');
        api.startTimer(Math.max(11, 17 - diff), () => win());
        function fail() { if (done) return; done = true; document.removeEventListener('keydown', key); api.stopTimer(); api.shake(); api.sfx('bad'); setTimeout(() => api.fail(), 250); }
        function win() { if (done) return; done = true; document.removeEventListener('keydown', key); api.stopTimer(); api.setTag('CLEAR'); setTimeout(() => api.succeed(), 250); }

        function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

        function draw() {
            if (!done) {
                carX += (laneX(targetLane) - carX) * 0.22;
                dash = (dash + speed) % 44;
                if (++spawnT >= spawnEvery) {
                    spawnT = 0;
                    const l = api.randInt(0, lanes - 1);
                    traffic.push({ x: laneX(l), y: -carH });
                    if (diff >= 3 && Math.random() < 0.45) {
                        const l2 = (l + 1 + api.randInt(0, lanes - 2)) % lanes;
                        traffic.push({ x: laneX(l2), y: -carH - api.rand(40, 110) });
                    }
                }
            }

            ctx.clearRect(0, 0, W, H);
            ctx.fillStyle = 'rgba(255,255,255,0.03)'; ctx.fillRect(0, 0, W, H);
            ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 3;
            for (let i = 1; i < lanes; i++) { const x = (W / lanes) * i; for (let y = -44 + dash; y < H; y += 44) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 22); ctx.stroke(); } }

            let crash = false;
            for (const t of traffic) {
                if (!done) t.y += speed;
                ctx.fillStyle = dng; rr(t.x - carW / 2, t.y, carW, carH, 7); ctx.fill();
                ctx.fillStyle = 'rgba(0,0,0,0.35)'; rr(t.x - carW / 2 + 5, t.y + 9, carW - 10, 15, 3); ctx.fill();
                if (Math.abs(t.x - carX) < carW * 0.78 && t.y + carH > carY + 8 && t.y < carY + carH - 8) crash = true;
            }
            for (let i = traffic.length - 1; i >= 0; i--) if (traffic[i].y > H + 30) traffic.splice(i, 1);

            ctx.fillStyle = acc; ctx.shadowColor = acc; ctx.shadowBlur = 14; rr(carX - carW / 2, carY, carW, carH, 7); ctx.fill(); ctx.shadowBlur = 0;
            ctx.fillStyle = 'rgba(0,0,0,0.35)'; rr(carX - carW / 2 + 5, carY + 9, carW - 10, 15, 3); ctx.fill();

            if (crash && !done) { fail(); return; }
            if (!done) loop = requestAnimationFrame(draw);
        }
        let loop = requestAnimationFrame(draw);
        return { destroy() { cancelAnimationFrame(loop); document.removeEventListener('keydown', key); } };
    }
});
