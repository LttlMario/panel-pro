MG.register('vaultdrill', {
    title: 'Vault Drill',
    hint: 'Stop each drill in the green core · SPACE / click',
    run(api) {
        const diff = Math.max(1, Math.min(5, api.cfg.difficulty || 2));
        const points = 3 + Math.floor(diff / 1.3);
        const W = 340, H = 300, cx = W / 2, cy = H / 2, R = 110;

        const cvs = document.createElement('canvas');
        cvs.width = W; cvs.height = H;
        cvs.style.cursor = 'pointer';
        api.board.appendChild(cvs);
        const ctx = cvs.getContext('2d');

        const drillPts = [];
        for (let i = 0; i < points; i++) {
            const a = (i / points) * Math.PI * 2 - Math.PI / 2;
            drillPts.push({ x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R, done: false });
        }
        let cur = 0, prog = 0, dir = 1, ended = false;
        const speed = 1.2 + diff * 0.5;
        const coreLow = 42, coreHigh = 58;
        api.setDots(points);

        function attempt() {
            if (ended || cur >= points) return;
            if (prog >= coreLow && prog <= coreHigh) {
                drillPts[cur].done = true; api.sfx('zap'); cur++; prog = 0;
                api.setDots(points, drillPts.map((p) => p.done ? 'done' : ''));
                if (cur >= points) finish(true);
            } else { api.shake(); finish(false); }
        }
        function key(e) { if (e.code === 'Space') { e.preventDefault(); attempt(); } }
        document.addEventListener('keydown', key);
        cvs.addEventListener('click', attempt);

        api.setTag('DRILLING');
        api.startTimer(Math.max(12, 24 - diff * 2), () => finish(false));
        function finish(ok) { if (ended) return; ended = true; document.removeEventListener('keydown', key); api.stopTimer(); setTimeout(() => ok ? api.succeed() : api.fail(), 250); }

        function draw() {
            const acc = (getComputedStyle(document.documentElement).getPropertyValue('--accent') || '#00e0b8').trim();
            const suc = (getComputedStyle(document.documentElement).getPropertyValue('--success') || '#39d98a').trim();
            if (!ended && cur < points) { prog += dir * speed; if (prog > 100) { prog = 100; dir = -1; } if (prog < 0) { prog = 0; dir = 1; } }
            ctx.clearRect(0, 0, W, H);

            ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(cx, cy, R + 16, 0, Math.PI * 2); ctx.stroke();
            ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.beginPath(); ctx.arc(cx, cy, R - 6, 0, Math.PI * 2); ctx.fill();

            drillPts.forEach((p) => {
                const isCur = !p.done && drillPts.indexOf(p) === cur && !ended;
                ctx.fillStyle = p.done ? suc : (isCur ? acc : 'rgba(255,255,255,0.2)');
                ctx.strokeStyle = ctx.fillStyle; ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = isCur ? 12 : (p.done ? 10 : 0);
                ctx.beginPath(); ctx.arc(p.x, p.y, 12, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
            });

            ctx.fillStyle = '#fff'; ctx.font = 'bold 20px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(cur + '/' + points, cx, cy - 14);

            const bw = 140, bx = cx - bw / 2, by = cy + 18;
            ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(bx, by, bw, 14);
            ctx.fillStyle = 'rgba(57,217,138,0.25)'; ctx.fillRect(bx + bw * coreLow / 100, by, bw * (coreHigh - coreLow) / 100, 14);
            ctx.strokeStyle = suc; ctx.lineWidth = 1; ctx.strokeRect(bx + bw * coreLow / 100, by, bw * (coreHigh - coreLow) / 100, 14);
            ctx.fillStyle = '#fff'; ctx.fillRect(bx + bw * prog / 100 - 1.5, by - 3, 3, 20);
            loop = requestAnimationFrame(draw);
        }
        let loop = requestAnimationFrame(draw);
        return { destroy() { cancelAnimationFrame(loop); document.removeEventListener('keydown', key); } };
    }
});
