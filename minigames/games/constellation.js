MG.register('constellation', {
    title: 'Stargazing',
    hint: 'Connect the stars in number order · trace the constellation',
    run(api) {
        const diff = Math.max(1, Math.min(5, api.cfg.difficulty || 2));
        const W = 440, H = 300;

        const cvs = document.createElement('canvas');
        cvs.width = W; cvs.height = H;
        cvs.style.cursor = 'crosshair';
        api.board.appendChild(cvs);
        const ctx = cvs.getContext('2d');

        const css = getComputedStyle(document.documentElement);
        const acc = (css.getPropertyValue('--accent') || '#00e0b8').trim();
        const suc = (css.getPropertyValue('--success') || '#39d98a').trim();

        const n = 4 + Math.floor(diff / 1.5);
        const decoyN = diff;
        const pts = [];
        let x = 55 + Math.random() * 40, y = 70 + Math.random() * 150;
        for (let i = 0; i < n; i++) {
            pts.push({ x: Math.min(W - 40, Math.max(40, x)), y: Math.min(H - 50, Math.max(45, y)) });
            x += (W - 110) / (n - 1) * (0.7 + Math.random() * 0.6);
            y += (Math.random() - 0.5) * 130;
            y = Math.min(H - 50, Math.max(45, y));
        }
        const decoys = [];
        let tries = 0;
        while (decoys.length < decoyN && tries < 300) { tries++; const dx = 40 + Math.random() * (W - 80), dy = 45 + Math.random() * (H - 95); if (pts.concat(decoys).every(p => Math.hypot(p.x - dx, p.y - dy) > 42)) decoys.push({ x: dx, y: dy }); }
        const stars = [];
        for (let i = 0; i < 60; i++) stars.push({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.2 });

        let idx = 0, wrong = 0, done = false;
        const maxWrong = Math.max(2, 5 - diff), hitR = 18;
        api.setDots(n);

        cvs.addEventListener('click', (e) => {
            if (done) return;
            const b = cvs.getBoundingClientRect();
            const mx = (e.clientX - b.left) * (W / b.width), my = (e.clientY - b.top) * (H / b.height);
            let hit = null, hd = hitR;
            pts.concat(decoys).forEach(p => { const d = Math.hypot(mx - p.x, my - p.y); if (d < hd) { hd = d; hit = p; } });
            if (!hit) return;
            if (hit === pts[idx]) {
                idx++; api.sfx('beep'); api.setDots(n, Array.from({ length: n }, (_, i) => i < idx ? 'done' : ''));
                if (idx >= n) { done = true; api.stopTimer(); api.setTag('CONSTELLATION'); setTimeout(() => api.succeed(), 300); }
            } else { wrong++; api.shake(); if (wrong >= maxWrong) { done = true; api.stopTimer(); setTimeout(() => api.fail(), 300); } }
        });

        api.setTag('STARGAZING');
        api.startTimer(Math.max(14, 26 - diff * 2), () => { if (!done) { done = true; api.stopTimer(); setTimeout(() => api.fail(), 200); } });

        function draw() {
            ctx.clearRect(0, 0, W, H);
            stars.forEach(s => { ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill(); });

            ctx.strokeStyle = acc; ctx.lineWidth = 2; ctx.shadowColor = acc; ctx.shadowBlur = 8;
            ctx.beginPath();
            for (let i = 0; i < idx; i++) { if (i === 0) ctx.moveTo(pts[0].x, pts[0].y); else ctx.lineTo(pts[i].x, pts[i].y); }
            ctx.stroke(); ctx.shadowBlur = 0;

            decoys.forEach(p => { ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2); ctx.fill(); });
            pts.forEach((p, i) => {
                const lit = i < idx, next = i === idx;
                ctx.fillStyle = lit ? suc : (next ? '#fff' : acc);
                ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = next ? 14 : (lit ? 10 : 4);
                ctx.beginPath(); ctx.arc(p.x, p.y, next ? 6 : 5, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
                ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = '10px monospace'; ctx.textAlign = 'center';
                ctx.fillText(i + 1, p.x, p.y - 10);
            });
            if (!done) loop = requestAnimationFrame(draw);
        }
        let loop = requestAnimationFrame(draw);
        return { destroy() { cancelAnimationFrame(loop); } };
    }
});
