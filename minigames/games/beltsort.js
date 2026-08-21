MG.register('beltsort', {
    title: 'Quality Control',
    hint: 'Click the cracked (red) parts before they leave the belt · let good ones pass',
    run(api) {
        const diff = Math.max(1, Math.min(5, api.cfg.difficulty || 2));
        const W = 440, H = 280;

        const cvs = document.createElement('canvas');
        cvs.width = W; cvs.height = H;
        cvs.style.cursor = 'pointer';
        api.board.appendChild(cvs);
        const ctx = cvs.getContext('2d');

        const css = getComputedStyle(document.documentElement);
        const acc = (css.getPropertyValue('--accent') || '#00e0b8').trim();
        const suc = (css.getPropertyValue('--success') || '#39d98a').trim();
        const dng = (css.getPropertyValue('--danger') || '#ff3b5c').trim();

        const need = 5 + diff;
        const maxWrong = Math.max(2, 5 - diff);
        const speed = 1.1 + diff * 0.4;
        const spawnGap = Math.max(34, 72 - diff * 8);
        const beltY = H / 2, R = 16;
        let parts = [], caught = 0, wrong = 0, frame = 0, done = false, dash = 0;

        api.setDots(maxWrong);
        function strike() { wrong++; api.setDots(maxWrong, Array.from({ length: maxWrong }, (_, i) => i < wrong ? 'fail' : '')); if (wrong >= maxWrong) finish(false); }
        function finish(ok) { if (done) return; done = true; api.stopTimer(); setTimeout(() => ok ? api.succeed() : api.fail(), 250); }

        cvs.addEventListener('click', (e) => {
            if (done) return;
            const b = cvs.getBoundingClientRect();
            const x = (e.clientX - b.left) * (W / b.width), y = (e.clientY - b.top) * (H / b.height);
            for (let i = parts.length - 1; i >= 0; i--) {
                const p = parts[i];
                if (!p.gone && Math.hypot(x - p.x, y - beltY) < R + 4) {
                    p.gone = true;
                    if (p.def) { caught++; api.sfx('zap'); api.setTag(caught + '/' + need); if (caught >= need) finish(true); }
                    else { api.shake(); strike(); }
                    return;
                }
            }
        });

        api.setTag('0/' + need);
        api.startTimer(Math.max(20, 34 - diff * 2), () => finish(caught >= need));

        function gear(x, y, r, col, def) {
            ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 3; ctx.lineCap = 'round';
            ctx.shadowColor = col; ctx.shadowBlur = 8;
            ctx.beginPath(); ctx.arc(x, y, r * 0.62, 0, Math.PI * 2); ctx.stroke();
            for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.62); ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); ctx.stroke(); }
            ctx.shadowBlur = 0;
            ctx.beginPath(); ctx.arc(x, y, r * 0.2, 0, Math.PI * 2); ctx.stroke();
            if (def) { ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x - r * 0.4, y - r * 0.3); ctx.lineTo(x + r * 0.05, y + r * 0.1); ctx.lineTo(x - r * 0.15, y + r * 0.35); ctx.stroke(); }
        }

        function draw() {
            frame++;
            if (!done && frame % spawnGap === 0) parts.push({ x: -R, def: Math.random() < 0.5, gone: false });
            if (!done) dash = (dash + speed) % 28;
            ctx.clearRect(0, 0, W, H);

            // belt
            ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.fillRect(0, beltY - R - 10, W, (R + 10) * 2);
            ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(0, beltY - R - 10); ctx.lineTo(W, beltY - R - 10); ctx.moveTo(0, beltY + R + 10); ctx.lineTo(W, beltY + R + 10); ctx.stroke();
            ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 2;
            for (let x = -28 + dash; x < W; x += 28) { ctx.beginPath(); ctx.moveTo(x, beltY + R + 10); ctx.lineTo(x + 14, beltY + R + 10); ctx.stroke(); }

            parts.forEach(p => {
                if (p.gone) return;
                if (!done) p.x += speed;
                if (p.x > W + R) { p.gone = true; if (p.def) strike(); return; }
                gear(p.x, beltY, R, p.def ? dng : acc, p.def);
            });
            parts = parts.filter(p => !p.gone);

            ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '11px monospace'; ctx.textAlign = 'center';
            ctx.fillText('PULL THE CRACKED PARTS · ' + caught + ' / ' + need, W / 2, 22);
            if (!done) loop = requestAnimationFrame(draw);
        }
        let loop = requestAnimationFrame(draw);
        return { destroy() { cancelAnimationFrame(loop); } };
    }
});
