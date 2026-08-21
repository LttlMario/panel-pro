MG.register('lasergrid', {
    title: 'Laser Grid',
    hint: 'Move to the exit · don’t touch the lasers',
    run(api) {
        const diff = Math.max(1, Math.min(5, api.cfg.difficulty || 2));
        const W = 460, H = 280;
        const cvs = document.createElement('canvas');
        cvs.width = W; cvs.height = H;
        cvs.style.cursor = 'none';
        api.board.appendChild(cvs);
        const ctx = cvs.getContext('2d');

        const laserCount = 3 + diff;
        const lasers = [];
        for (let i = 0; i < laserCount; i++) {
            const horizontal = Math.random() < 0.5;
            lasers.push({
                horizontal,
                pos: api.rand(60, (horizontal ? H : W) - 60),
                dir: Math.random() < 0.5 ? 1 : -1,
                speed: 0.6 + diff * 0.35 + Math.random() * 0.6
            });
        }
        let player = { x: 24, y: H / 2 }, ended = false, hasMouse = false;
        const exit = { x: W - 30, y: H / 2, r: 22 };

        function rel(e) {
            const b = cvs.getBoundingClientRect();
            return { x: (e.clientX - b.left) * (cvs.width / b.width), y: (e.clientY - b.top) * (cvs.height / b.height) };
        }
        cvs.addEventListener('mousemove', (e) => { const p = rel(e); player = p; hasMouse = true; });

        api.setTag('INFILTRATE');
        api.startTimer(Math.max(12, 22 - diff * 1.6), () => finish(false));
        function finish(ok) { if (ended) return; ended = true; api.stopTimer(); setTimeout(() => ok ? api.succeed() : api.fail(), 250); }

        function draw() {
            const acc = (getComputedStyle(document.documentElement).getPropertyValue('--accent') || '#00e0b8').trim();
            const dng = (getComputedStyle(document.documentElement).getPropertyValue('--danger') || '#ff3b5c').trim();
            const suc = (getComputedStyle(document.documentElement).getPropertyValue('--success') || '#39d98a').trim();
            ctx.clearRect(0, 0, W, H);
            ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 2; ctx.strokeRect(8, 8, W - 16, H - 16);

            ctx.fillStyle = suc; ctx.shadowColor = suc; ctx.shadowBlur = 16;
            ctx.beginPath(); ctx.arc(exit.x, exit.y, exit.r, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
            ctx.fillStyle = '#0a0e14'; ctx.font = '9px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText('EXIT', exit.x, exit.y);

            let hit = false;
            lasers.forEach((l) => {
                if (!ended) {
                    l.pos += l.dir * l.speed;
                    const max = l.horizontal ? H - 16 : W - 16;
                    if (l.pos > max) { l.pos = max; l.dir = -1; }
                    if (l.pos < 16) { l.pos = 16; l.dir = 1; }
                }
                ctx.strokeStyle = dng; ctx.lineWidth = 2; ctx.shadowColor = dng; ctx.shadowBlur = 8;
                ctx.beginPath();
                if (l.horizontal) { ctx.moveTo(10, l.pos); ctx.lineTo(W - 10, l.pos); if (Math.abs(player.y - l.pos) < 8) hit = true; }
                else { ctx.moveTo(l.pos, 10); ctx.lineTo(l.pos, H - 10); if (Math.abs(player.x - l.pos) < 8) hit = true; }
                ctx.stroke(); ctx.shadowBlur = 0;
            });

            if (hasMouse) {
                ctx.fillStyle = hit ? dng : acc; ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 12;
                ctx.beginPath(); ctx.arc(player.x, player.y, 8, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
            } else {
                ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.font = '12px monospace'; ctx.textAlign = 'left';
                ctx.fillText('move your mouse from the left edge', 20, H / 2);
            }

            if (!ended && hasMouse) {
                if (hit) { api.shake(); finish(false); return; }
                if (Math.hypot(player.x - exit.x, player.y - exit.y) < exit.r) { finish(true); return; }
            }
            loop = requestAnimationFrame(draw);
        }
        let loop = requestAnimationFrame(draw);
        return { destroy() { cancelAnimationFrame(loop); } };
    }
});
