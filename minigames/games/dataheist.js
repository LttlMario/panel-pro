MG.register('dataheist', {
    title: 'Data Heist',
    hint: 'Catch the clean data · dodge the corrupt (red) packets',
    run(api) {
        const diff = Math.max(1, Math.min(5, api.cfg.difficulty || 2));
        const W = 420, H = 300;
        const cvs = document.createElement('canvas');
        cvs.width = W; cvs.height = H;
        cvs.style.cursor = 'none';
        api.board.appendChild(cvs);
        const ctx = cvs.getContext('2d');

        const need = 8 + diff * 2;
        const maxMiss = Math.max(2, 5 - diff);
        const fallSpeed = 1.8 + diff * 0.6;
        const spawnGap = Math.max(28, 60 - diff * 6);
        const corruptChance = 0.22 + diff * 0.04;

        let packets = [], grabbed = 0, miss = 0, frame = 0, ended = false;
        let paddle = W / 2, hasMouse = false;
        const padW = Math.max(50, 90 - diff * 8), padY = H - 28;
        api.setDots(maxMiss);

        function rel(e) {
            const b = cvs.getBoundingClientRect();
            return (e.clientX - b.left) * (cvs.width / b.width);
        }
        cvs.addEventListener('mousemove', (e) => { paddle = rel(e); hasMouse = true; });

        api.setTag('0/' + need);
        api.startTimer(Math.max(16, 30 - diff * 2), () => finish(grabbed >= need));
        function registerMiss() { miss++; api.setDots(maxMiss, Array.from({ length: maxMiss }, (_, i) => i < miss ? 'fail' : '')); if (miss >= maxMiss) finish(false); }
        function finish(ok) { if (ended) return; ended = true; api.stopTimer(); setTimeout(() => ok ? api.succeed() : api.fail(), 250); }

        function draw() {
            const acc = (getComputedStyle(document.documentElement).getPropertyValue('--accent') || '#00e0b8').trim();
            const suc = (getComputedStyle(document.documentElement).getPropertyValue('--success') || '#39d98a').trim();
            const dng = (getComputedStyle(document.documentElement).getPropertyValue('--danger') || '#ff3b5c').trim();
            frame++;
            if (!ended && frame % spawnGap === 0) {
                packets.push({ x: api.rand(20, W - 20), y: -14, corrupt: Math.random() < corruptChance, gone: false });
            }
            ctx.clearRect(0, 0, W, H);
            ctx.strokeStyle = 'rgba(255,255,255,0.06)';
            for (let i = 0; i < W; i += 20) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, H); ctx.globalAlpha = 0.3; ctx.stroke(); ctx.globalAlpha = 1; }

            packets.forEach((p) => {
                if (p.gone) return;
                if (!ended) p.y += fallSpeed;
                const caught = p.y > padY - 8 && p.y < padY + 8 && Math.abs(p.x - paddle) < padW / 2;
                if (caught) {
                    p.gone = true;
                    if (p.corrupt) { api.shake(); registerMiss(); }
                    else { grabbed++; api.sfx('beep'); api.setTag(grabbed + '/' + need); if (grabbed >= need) finish(true); }
                    return;
                }
                if (p.y > H + 14) { p.gone = true; if (!p.corrupt) registerMiss(); return; }
                ctx.fillStyle = p.corrupt ? dng : suc; ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 8;
                ctx.fillRect(p.x - 7, p.y - 7, 14, 14); ctx.shadowBlur = 0;
                ctx.fillStyle = '#0a0e14'; ctx.font = '9px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText(p.corrupt ? '✕' : '1', p.x, p.y);
            });
            packets = packets.filter((p) => !p.gone);

            if (hasMouse) {
                paddle = Math.max(padW / 2, Math.min(W - padW / 2, paddle));
                ctx.fillStyle = acc; ctx.shadowColor = acc; ctx.shadowBlur = 10;
                ctx.fillRect(paddle - padW / 2, padY, padW, 8); ctx.shadowBlur = 0;
            } else {
                ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.font = '12px monospace'; ctx.textAlign = 'center';
                ctx.fillText('move mouse to catch packets', W / 2, padY - 10);
            }
            if (!ended) loop = requestAnimationFrame(draw);
        }
        let loop = requestAnimationFrame(draw);
        return { destroy() { cancelAnimationFrame(loop); } };
    }
});
