MG.register('crane', {
    title: 'Cargo Crane',
    hint: 'SPACE / click to drop · lead the swing onto the truck',
    run(api) {
        const diff = Math.max(1, Math.min(5, api.cfg.difficulty || 2));
        const W = 420, H = 300;

        const cvs = document.createElement('canvas');
        cvs.width = W; cvs.height = H;
        cvs.style.cursor = 'pointer';
        api.board.appendChild(cvs);
        const ctx = cvs.getContext('2d');

        const css = getComputedStyle(document.documentElement);
        const acc = (css.getPropertyValue('--accent') || '#00e0b8').trim();
        const suc = (css.getPropertyValue('--success') || '#39d98a').trim();
        const dng = (css.getPropertyValue('--danger') || '#ff3b5c').trim();

        const pivot = { x: W / 2, y: 26 };
        const L = 150, maxA = 0.9, g = 0.5, floorY = H - 30;
        const swSpd = 0.03 + diff * 0.006;
        const tgW = Math.max(46, 92 - diff * 9);
        const rounds = 3;
        let phase = api.rand(0, Math.PI * 2), prevX = 0, round = 0, done = false;
        let target = newTarget(), crate = null;

        api.setDots(rounds);
        function newTarget() { return 60 + Math.random() * (W - 120); }
        function hookPos() { const a = Math.sin(phase) * maxA; return { x: pivot.x + Math.sin(a) * L, y: pivot.y + Math.cos(a) * L }; }
        prevX = hookPos().x;

        function drop() {
            if (done || crate) return;
            const h = hookPos();
            crate = { x: h.x, y: h.y, vx: (h.x - prevX), vy: 0 };
            api.sfx('whoosh');
        }
        function key(e) { if (e.code === 'Space') { e.preventDefault(); drop(); } }
        document.addEventListener('keydown', key);
        cvs.addEventListener('click', drop);

        api.setTag('HOIST');
        api.startTimer(Math.max(20, 34 - diff * 2), () => fail());
        function fail() { if (done) return; done = true; document.removeEventListener('keydown', key); api.stopTimer(); api.shake(); setTimeout(() => api.fail(), 200); }
        function win() { if (done) return; done = true; document.removeEventListener('keydown', key); api.stopTimer(); api.setTag('LOADED'); setTimeout(() => api.succeed(), 300); }
        function dotState() { return Array.from({ length: rounds }, (_, i) => i < round ? 'done' : ''); }

        function draw() {
            if (!done) { prevX = hookPos().x; phase += swSpd; }
            const h = hookPos();

            if (crate) {
                crate.vy += g; crate.x += crate.vx; crate.y += crate.vy;
                if (crate.y >= floorY - 10) {
                    if (Math.abs(crate.x - target) < tgW / 2) {
                        round++; api.setDots(rounds, dotState()); api.sfx('good');
                        if (round >= rounds) { win(); return; }
                        crate = null; target = newTarget();
                    } else { fail(); return; }
                }
            }

            ctx.clearRect(0, 0, W, H);
            ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(20, pivot.y); ctx.lineTo(W - 20, pivot.y); ctx.stroke();
            ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(pivot.x, pivot.y); ctx.lineTo(h.x, h.y); ctx.stroke();
            if (!crate) { ctx.fillStyle = acc; ctx.shadowColor = acc; ctx.shadowBlur = 10; ctx.fillRect(h.x - 14, h.y - 12, 28, 24); ctx.shadowBlur = 0; }

            ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(0, floorY, W, H - floorY);
            ctx.fillStyle = 'rgba(57,217,138,0.18)'; ctx.fillRect(target - tgW / 2, floorY - 8, tgW, 8);
            ctx.strokeStyle = suc; ctx.lineWidth = 2; ctx.strokeRect(target - tgW / 2, floorY - 8, tgW, 8);

            if (crate) { ctx.fillStyle = acc; ctx.shadowColor = acc; ctx.shadowBlur = 12; ctx.fillRect(crate.x - 14, crate.y - 12, 28, 24); ctx.shadowBlur = 0; }

            if (!done) loop = requestAnimationFrame(draw);
        }
        let loop = requestAnimationFrame(draw);
        return { destroy() { cancelAnimationFrame(loop); document.removeEventListener('keydown', key); } };
    }
});
