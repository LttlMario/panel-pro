MG.register('mash', {
    title: 'Mash',
    hint: 'Tap SPACE / click rapidly to fill the bar',
    run(api) {
        const diff = Math.max(1, Math.min(5, api.cfg.difficulty || 2));
        const perPress = 7.5 - diff * 0.7;
        const drainPerSec = 14 + diff * 7;
        const W = 360, H = 220;

        const cvs = document.createElement('canvas');
        cvs.width = W; cvs.height = H;
        cvs.style.cursor = 'pointer';
        api.board.appendChild(cvs);
        const ctx = cvs.getContext('2d');

        let fill = 12, ended = false, pulse = 0, lastT = performance.now();

        function bump() {
            if (ended) return;
            fill = Math.min(100, fill + perPress);
            pulse = 8;
            api.sfx('tick');
            if (fill >= 100) finish();
        }
        function key(e) { if (e.code === 'Space') { e.preventDefault(); bump(); } }
        document.addEventListener('keydown', key);
        cvs.addEventListener('mousedown', bump);

        api.setTag('PUSH');
        api.startTimer(Math.max(7, 13 - diff), () => finish());
        function finish() {
            if (ended) return; ended = true;
            document.removeEventListener('keydown', key);
            api.stopTimer();
            const pass = fill >= 100;
            setTimeout(() => pass ? api.succeed() : api.fail(), 200);
        }

        function draw() {
            const now = performance.now();
            const dt = Math.min(0.05, (now - lastT) / 1000);
            lastT = now;
            if (!ended) {
                fill = Math.max(0, fill - drainPerSec * dt);
                if (fill >= 100) { finish(); return; }
            }
            if (pulse > 0) pulse--;
            ctx.clearRect(0, 0, W, H);
            const acc = (getComputedStyle(document.documentElement).getPropertyValue('--accent') || '#00e0b8').trim();
            const suc = (getComputedStyle(document.documentElement).getPropertyValue('--success') || '#39d98a').trim();

            const bw = W - 80, bh = 40, bx = 40, by = H / 2 - bh / 2;
            ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(bx, by, bw, bh);
            ctx.fillStyle = fill > 80 ? suc : acc;
            ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 10 + pulse;
            ctx.fillRect(bx, by, bw * (fill / 100), bh);
            ctx.shadowBlur = 0;
            ctx.strokeStyle = suc; ctx.lineWidth = 2; ctx.setLineDash([4, 4]);
            ctx.beginPath(); ctx.moveTo(bx + bw, by - 6); ctx.lineTo(bx + bw, by + bh + 6); ctx.stroke(); ctx.setLineDash([]);
            ctx.fillStyle = '#fff'; ctx.font = 'bold 26px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(Math.round(fill) + '%', W / 2, by - 26);
            ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.font = '13px monospace';
            ctx.fillText('TAP  TAP  TAP', W / 2, by + bh + 30);
            loop = requestAnimationFrame(draw);
        }
        let loop = requestAnimationFrame(draw);
        return { destroy() { cancelAnimationFrame(loop); document.removeEventListener('keydown', key); } };
    }
});
