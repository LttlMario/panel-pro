MG.register('pulse', {
    title: 'Pulse',
    hint: 'Hit D F J K as notes cross the line',
    run(api) {
        const diff = Math.max(1, Math.min(5, api.cfg.difficulty || 2));
        const LANES = ['KeyD', 'KeyF', 'KeyJ', 'KeyK'];
        const LABEL = ['D', 'F', 'J', 'K'];
        const W = 360, H = 320, laneW = W / 4, strikeY = H - 50;

        const cvs = document.createElement('canvas');
        cvs.width = W; cvs.height = H;
        api.board.appendChild(cvs);
        const ctx = cvs.getContext('2d');

        const total = 12 + diff * 3;
        const speed = 1.5 + diff * 0.7;
        const spawnGap = Math.max(30, 78 - diff * 8);
        const needPct = 0.6 + diff * 0.05;

        let notes = [], spawned = 0, hits = 0, judged = 0, frame = 0, flash = {};
        const done = () => judged >= total;

        function key(e) {
            const lane = LANES.indexOf(e.code);
            if (lane < 0) return; e.preventDefault();
            flash[lane] = 6;
            let best = null, bestD = 9999;
            notes.forEach((n) => {
                if (n.lane === lane && !n.hit && !n.missed) {
                    const d = Math.abs(n.y - strikeY);
                    if (d < bestD) { bestD = d; best = n; }
                }
            });
            if (best && bestD < 26) { best.hit = true; hits++; judged++; }
            else { /* wrong/early tap: light penalty */ judged += 0; }
            checkEnd();
        }
        document.addEventListener('keydown', key);

        function checkEnd() {
            if (done()) {
                document.removeEventListener('keydown', key);
                api.stopTimer();
                const pass = (hits / total) >= needPct;
                api.setTag(Math.round(hits / total * 100) + '% ACCURACY');
                setTimeout(() => pass ? api.succeed() : api.fail(), 350);
            }
        }

        api.setTag('SYNCING');
        api.startTimer(Math.max(14, 26 - diff), () => {
            document.removeEventListener('keydown', key);
            const pass = (hits / total) >= needPct;
            setTimeout(() => pass ? api.succeed() : api.fail(), 200);
        });

        function draw() {
            frame++;
            if (spawned < total && frame % spawnGap === 0) {
                notes.push({ lane: api.randInt(0, 3), y: -20, hit: false, missed: false });
                spawned++;
            }
            ctx.clearRect(0, 0, W, H);
            const acc = (getComputedStyle(document.documentElement).getPropertyValue('--accent') || '#00e0b8').trim();
            const suc = (getComputedStyle(document.documentElement).getPropertyValue('--success') || '#39d98a').trim();
            const dng = (getComputedStyle(document.documentElement).getPropertyValue('--danger') || '#ff3b5c').trim();

            for (let i = 0; i < 4; i++) {
                ctx.strokeStyle = 'rgba(255,255,255,0.06)';
                ctx.strokeRect(i * laneW, 0, laneW, H);
                ctx.fillStyle = flash[i] > 0 ? acc : 'rgba(255,255,255,0.08)';
                ctx.fillRect(i * laneW + 4, strikeY - 6, laneW - 8, 12);
                ctx.fillStyle = flash[i] > 0 ? '#0a0e14' : 'rgba(255,255,255,0.5)';
                ctx.font = 'bold 14px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText(LABEL[i], i * laneW + laneW / 2, strikeY);
                if (flash[i] > 0) flash[i]--;
            }
            ctx.strokeStyle = acc; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(0, strikeY); ctx.lineTo(W, strikeY); ctx.stroke();

            notes.forEach((n) => {
                if (n.hit) return;
                n.y += speed;
                if (n.y > strikeY + 26 && !n.missed) { n.missed = true; judged++; }
                ctx.fillStyle = n.missed ? dng : acc;
                ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = n.missed ? 0 : 8;
                const x = n.lane * laneW + 6, w = laneW - 12;
                roundRect(x, n.y - 9, w, 18, 5); ctx.fill();
                ctx.shadowBlur = 0;
            });
            notes = notes.filter((n) => n.y < H + 30 && !n.hit);

            if (done()) { checkEnd(); return; }
            loop = requestAnimationFrame(draw);
        }
        function roundRect(x, y, w, h, r) {
            ctx.beginPath();
            ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r);
            ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r);
            ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
        }
        let loop = requestAnimationFrame(draw);
        return { destroy() { cancelAnimationFrame(loop); document.removeEventListener('keydown', key); } };
    }
});
