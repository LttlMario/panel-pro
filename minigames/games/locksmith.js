MG.register('locksmith', {
    title: 'Locksmith',
    hint: 'Raise each pin to the shear line · SPACE to set',
    run(api) {
        const diff = Math.max(1, Math.min(5, api.cfg.difficulty || 2));
        const pinCount = 3 + Math.floor(diff / 1.3);
        const tol = Math.max(5, 12 - diff * 1.4);
        const W = 360, H = 260;
        const cvs = document.createElement('canvas');
        cvs.width = W; cvs.height = H;
        api.board.appendChild(cvs);
        const ctx = cvs.getContext('2d');

        const shearY = 90;
        const pins = [];
        const pinW = (W - 80) / pinCount;
        for (let i = 0; i < pinCount; i++) {
            pins.push({ x: 40 + pinW * (i + 0.5), target: api.randInt(40, 150), h: 0, set: false });
        }
        let cur = 0, dir = 1, ended = false;
        api.setDots(pinCount);

        function attempt() {
            if (ended || cur >= pinCount) return;
            const p = pins[cur];
            if (Math.abs(p.h - p.target) < tol) {
                p.set = true; p.h = p.target; api.sfx('latch');
                api.setDots(pinCount, pins.map((x) => x.set ? 'done' : ''));
                cur++;
                if (cur >= pinCount) { finish(true); }
            } else { api.shake(); p.h = 0; }
        }
        function key(e) { if (e.code === 'Space') { e.preventDefault(); attempt(); } }
        document.addEventListener('keydown', key);
        cvs.addEventListener('click', attempt);

        api.setTag('PICKING');
        api.startTimer(Math.max(14, 26 - diff * 2), () => finish(false));
        function finish(ok) { if (ended) return; ended = true; document.removeEventListener('keydown', key); api.stopTimer(); setTimeout(() => ok ? api.succeed() : api.fail(), 250); }

        const riseSpeed = 1.6 + diff * 0.5;
        function draw() {
            const acc = (getComputedStyle(document.documentElement).getPropertyValue('--accent') || '#00e0b8').trim();
            const suc = (getComputedStyle(document.documentElement).getPropertyValue('--success') || '#39d98a').trim();
            if (!ended && cur < pinCount) {
                const p = pins[cur];
                p.h += dir * riseSpeed;
                if (p.h > 170) { p.h = 170; dir = -1; }
                if (p.h < 0) { p.h = 0; dir = 1; }
            }
            ctx.clearRect(0, 0, W, H);
            ctx.strokeStyle = acc; ctx.lineWidth = 2; ctx.setLineDash([6, 5]);
            ctx.beginPath(); ctx.moveTo(20, shearY); ctx.lineTo(W - 20, shearY); ctx.stroke(); ctx.setLineDash([]);
            ctx.fillStyle = acc; ctx.font = '10px monospace'; ctx.textAlign = 'left';
            ctx.fillText('SHEAR LINE', 22, shearY - 6);

            pins.forEach((p, i) => {
                const baseY = H - 30;
                const isCur = i === cur && !ended;
                ctx.fillStyle = 'rgba(255,255,255,0.06)';
                ctx.fillRect(p.x - 12, shearY, 24, baseY - shearY);
                const topY = baseY - p.h;
                ctx.fillStyle = p.set ? suc : (isCur ? acc : 'rgba(255,255,255,0.25)');
                ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = isCur ? 12 : 0;
                ctx.fillRect(p.x - 9, topY, 18, baseY - topY);
                ctx.shadowBlur = 0;
                if (isCur) {
                    const tY = baseY - p.target;
                    ctx.strokeStyle = suc; ctx.lineWidth = 2;
                    ctx.beginPath(); ctx.moveTo(p.x - 14, tY); ctx.lineTo(p.x + 14, tY); ctx.stroke();
                }
            });
            ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.font = '12px monospace'; ctx.textAlign = 'center';
            ctx.fillText('SPACE when the pin meets its mark', W / 2, H - 8);
            loop = requestAnimationFrame(draw);
        }
        let loop = requestAnimationFrame(draw);
        return { destroy() { cancelAnimationFrame(loop); document.removeEventListener('keydown', key); } };
    }
});
