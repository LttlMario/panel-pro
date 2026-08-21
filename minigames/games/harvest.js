MG.register('harvest', {
    title: 'Harvest',
    hint: 'SPACE / click as each crop crosses the cut line',
    run(api) {
        const diff = Math.max(1, Math.min(5, api.cfg.difficulty || 2));
        const W = 360, H = 320, cutY = H - 60;
        const cvs = document.createElement('canvas');
        cvs.width = W; cvs.height = H;
        cvs.style.cursor = 'pointer';
        api.board.appendChild(cvs);
        const ctx = cvs.getContext('2d');

        const total = 8 + diff * 2;
        const speed = 1.4 + diff * 0.7;
        const gap = Math.max(34, 64 - diff * 6);
        const needPct = 0.65 + diff * 0.04;
        const window_ = Math.max(22, 44 - diff * 3);

        let crops = [], spawned = 0, cut = 0, judged = 0, frame = 0, ended = false, flash = 0;

        function attempt() {
            if (ended) return;
            flash = 6;
            let best = null, bestD = 999;
            crops.forEach((c) => {
                if (!c.cut && !c.missed) { const d = Math.abs(c.y - cutY); if (d < bestD) { bestD = d; best = c; } }
            });
            if (best && bestD < window_) { best.cut = true; cut++; judged++; api.sfx('select'); }
            checkEnd();
        }
        function key(e) { if (e.code === 'Space') { e.preventDefault(); attempt(); } }
        document.addEventListener('keydown', key);
        cvs.addEventListener('click', attempt);

        function checkEnd() {
            if (judged >= total) {
                api.setTag(Math.round(cut / total * 100) + '%');
                finish((cut / total) >= needPct);
            }
        }
        api.setTag('HARVEST');
        api.startTimer(Math.max(14, 26 - diff), () => finish((cut / total) >= needPct));
        function finish(ok) { if (ended) return; ended = true; document.removeEventListener('keydown', key); api.stopTimer(); setTimeout(() => ok ? api.succeed() : api.fail(), 250); }

        function draw() {
            frame++;
            const acc = (getComputedStyle(document.documentElement).getPropertyValue('--accent') || '#00e0b8').trim();
            const suc = (getComputedStyle(document.documentElement).getPropertyValue('--success') || '#39d98a').trim();
            const dng = (getComputedStyle(document.documentElement).getPropertyValue('--danger') || '#ff3b5c').trim();
            if (!ended && spawned < total && frame % gap === 0) {
                crops.push({ x: api.rand(60, W - 60), y: -20, cut: false, missed: false }); spawned++;
            }
            ctx.clearRect(0, 0, W, H);
            ctx.strokeStyle = flash > 0 ? suc : acc; ctx.lineWidth = flash > 0 ? 4 : 2;
            ctx.shadowColor = acc; ctx.shadowBlur = flash > 0 ? 14 : 4;
            ctx.beginPath(); ctx.moveTo(0, cutY); ctx.lineTo(W, cutY); ctx.stroke(); ctx.shadowBlur = 0;
            if (flash > 0) flash--;

            crops.forEach((c) => {
                if (c.cut) return;
                if (!ended) c.y += speed;
                if (c.y > cutY + window_ && !c.missed) { c.missed = true; judged++; }
                ctx.fillStyle = c.missed ? dng : suc;
                ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = c.missed ? 0 : 6;
                ctx.beginPath();
                ctx.moveTo(c.x, c.y - 14); ctx.lineTo(c.x + 6, c.y); ctx.lineTo(c.x, c.y + 8); ctx.lineTo(c.x - 6, c.y);
                ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0;
                ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.beginPath(); ctx.moveTo(c.x, c.y + 8); ctx.lineTo(c.x, c.y + 18); ctx.stroke();
            });
            crops = crops.filter((c) => c.y < H + 30 && !c.cut);
            checkEnd();
            if (!ended) loop = requestAnimationFrame(draw);
        }
        let loop = requestAnimationFrame(draw);
        return { destroy() { cancelAnimationFrame(loop); document.removeEventListener('keydown', key); } };
    }
});
