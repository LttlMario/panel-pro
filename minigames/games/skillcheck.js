MG.register('skillcheck', {
    title: 'Skill Check',
    hint: 'SPACE / click when the marker hits the zone',
    run(api) {
        const diff = Math.max(1, Math.min(5, api.cfg.difficulty || 2));
        const need = api.cfg.rounds || (2 + Math.floor(diff / 1.5));
        const W = 300, H = 300, cx = W / 2, cy = H / 2, R = 110;
        const cvs = document.createElement('canvas');
        cvs.width = W; cvs.height = H;
        cvs.style.cursor = 'pointer';
        api.board.appendChild(cvs);
        const ctx = cvs.getContext('2d');

        const zoneSize = Math.max(0.18, 0.72 - diff * 0.10);
        const speed = 0.022 + diff * 0.016;
        let ang = 0, dir = 1, done = 0, zoneStart = 0, ended = false;

        function newZone() {
            zoneStart = api.rand(0, Math.PI * 2);
            dir = Math.random() < 0.5 ? 1 : -1;
            ang = zoneStart + Math.PI + api.rand(-0.5, 0.5);
        }
        api.setDots(need); newZone();

        function attempt() {
            if (ended) return;
            let d = ang - zoneStart;
            d = ((d % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
            if (d <= zoneSize) {
                done++;
                api.sfx('latch');
                api.setDots(need, Array.from({ length: need }, (_, i) => i < done ? 'done' : ''));
                if (done >= need) { ended = true; api.stopTimer(); cleanup(); setTimeout(() => api.succeed(), 250); }
                else newZone();
            } else { ended = true; api.shake(); api.stopTimer(); cleanup(); setTimeout(() => api.fail(), 200); }
        }
        function key(e) { if (e.code === 'Space') { e.preventDefault(); attempt(); } }
        document.addEventListener('keydown', key);
        cvs.addEventListener('click', attempt);
        function cleanup() { document.removeEventListener('keydown', key); }

        api.startTimer(Math.max(7, 18 - diff * 1.6), () => { cleanup(); api.fail(); });

        function draw() {
            if (!ended) ang += speed * dir;
            ctx.clearRect(0, 0, W, H);
            const acc = (getComputedStyle(document.documentElement).getPropertyValue('--accent') || '#00e0b8').trim();
            const suc = (getComputedStyle(document.documentElement).getPropertyValue('--success') || '#39d98a').trim();
            ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 14;
            ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
            ctx.strokeStyle = suc; ctx.lineWidth = 14;
            ctx.shadowColor = suc; ctx.shadowBlur = 14;
            ctx.beginPath(); ctx.arc(cx, cy, R, zoneStart, zoneStart + zoneSize); ctx.stroke();
            ctx.shadowBlur = 0;
            const mx = cx + Math.cos(ang) * R, my = cy + Math.sin(ang) * R;
            ctx.fillStyle = '#fff'; ctx.shadowColor = acc; ctx.shadowBlur = 12;
            ctx.beginPath(); ctx.arc(mx, my, 10, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
            ctx.fillStyle = acc; ctx.font = 'bold 30px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText((done) + '/' + need, cx, cy);
            loop = requestAnimationFrame(draw);
        }
        let loop = requestAnimationFrame(draw);
        return { destroy() { cancelAnimationFrame(loop); cleanup(); } };
    }
});
