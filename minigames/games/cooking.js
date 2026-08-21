MG.register('cooking', {
    title: 'Cooking',
    hint: 'Hit SPACE when the marker is in the green for each step',
    run(api) {
        const diff = Math.max(1, Math.min(5, api.cfg.difficulty || 2));
        const steps = 3 + Math.floor(diff / 1.3);
        const W = 420, H = 220;
        const cvs = document.createElement('canvas');
        cvs.width = W; cvs.height = H;
        api.board.appendChild(cvs);
        const ctx = cvs.getContext('2d');

        const STEP_NAMES = ['CHOP', 'SEAR', 'SEASON', 'STIR', 'PLATE', 'GARNISH'];
        const zoneW = Math.max(44, 130 - diff * 14);
        const speed = 1.6 + diff * 0.8;

        let step = 0, ended = false, pos = 60, dir = 1;
        let zoneX = newZone();
        api.setDots(steps);

        function newZone() { return 70 + Math.random() * (W - 140 - zoneW); }

        function attempt() {
            if (ended) return;
            const inside = pos >= zoneX && pos <= zoneX + zoneW;
            if (inside) {
                step++;
                api.sfx('step');
                api.setDots(steps, Array.from({ length: steps }, (_, i) => i < step ? 'done' : ''));
                if (step >= steps) { finish(true); return; }
                zoneX = newZone(); dir = Math.random() < 0.5 ? 1 : -1;
            } else { finish(false); }
        }
        function key(e) { if (e.code === 'Space') { e.preventDefault(); attempt(); } }
        document.addEventListener('keydown', key);
        cvs.addEventListener('click', attempt);

        api.startTimer(Math.max(11, 24 - diff * 1.6), () => finish(false));
        function finish(ok) { if (ended) return; ended = true; if (!ok) api.shake(); document.removeEventListener('keydown', key); api.stopTimer(); setTimeout(() => ok ? api.succeed() : api.fail(), 200); }

        function draw() {
            const acc = (getComputedStyle(document.documentElement).getPropertyValue('--accent') || '#00e0b8').trim();
            const suc = (getComputedStyle(document.documentElement).getPropertyValue('--success') || '#39d98a').trim();
            if (!ended) {
                pos += dir * speed;
                if (pos > W - 60) { pos = W - 60; dir = -1; }
                if (pos < 60) { pos = 60; dir = 1; }
            }
            ctx.clearRect(0, 0, W, H);
            api.setTag(STEP_NAMES[step % STEP_NAMES.length] + ' (' + (step + 1) + '/' + steps + ')');

            const trackY = H / 2;
            ctx.fillStyle = 'rgba(255,255,255,0.08)';
            ctx.fillRect(50, trackY - 24, W - 100, 48);
            ctx.fillStyle = 'rgba(57,217,138,0.18)';
            ctx.strokeStyle = suc; ctx.lineWidth = 2;
            ctx.fillRect(zoneX, trackY - 24, zoneW, 48);
            ctx.strokeRect(zoneX, trackY - 24, zoneW, 48);
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.shadowColor = acc; ctx.shadowBlur = 12;
            ctx.beginPath(); ctx.moveTo(pos, trackY - 32); ctx.lineTo(pos, trackY + 32); ctx.stroke(); ctx.shadowBlur = 0;

            ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.font = '12px monospace'; ctx.textAlign = 'center';
            ctx.fillText('SPACE in the green', W / 2, trackY + 60);
            if (!ended) loop = requestAnimationFrame(draw);
        }
        let loop = requestAnimationFrame(draw);
        return { destroy() { cancelAnimationFrame(loop); document.removeEventListener('keydown', key); } };
    }
});
