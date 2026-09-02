MG.register('chopshop', {
    title: 'Chop Shop',
    hint: 'Press & hold on each part to unbolt it · strip the car before the heat maxes',
    run(api) {
        const diff = Math.max(1, Math.min(5, api.cfg.difficulty || 2));
        const W = 440, H = 300;

        const cvs = document.createElement('canvas');
        cvs.width = W; cvs.height = H;
        cvs.style.cursor = 'pointer';
        api.board.appendChild(cvs);
        const ctx = cvs.getContext('2d');

        const css = getComputedStyle(document.documentElement);
        const acc = (css.getPropertyValue('--accent') || '#00e0b8').trim();
        const suc = (css.getPropertyValue('--success') || '#39d98a').trim();
        const dng = (css.getPropertyValue('--danger') || '#ff3b5c').trim();

        const n = 4 + Math.floor(diff / 1.5);
        const heatRate = 0.035 + diff * 0.012;
        const unbolt = 0.55 + diff * 0.12;
        const carX = 80, carY = 96, carW = 280, carH = 96;
        const spots = [
            { x: carX + 56, y: carY + carH, lbl: 'wheel' },
            { x: carX + carW - 56, y: carY + carH, lbl: 'wheel' },
            { x: carX + 44, y: carY + 30, lbl: 'hood' },
            { x: carX + carW - 44, y: carY + 26, lbl: 'trunk' },
            { x: carX + carW / 2 - 30, y: carY + 8, lbl: 'roof' },
            { x: carX + carW / 2 + 36, y: carY + carH - 26, lbl: 'door' },
            { x: carX + 14, y: carY + carH - 30, lbl: 'light' }
        ];
        const parts = spots.slice(0, n).map(s => ({ x: s.x, y: s.y, r: 15, prog: 0, done: false }));
        let heat = 0, stripped = 0, done = false, down = false, mx = 0, my = 0, last = performance.now();

        api.setDots(n);
        function rel(e) { const b = cvs.getBoundingClientRect(); mx = (e.clientX - b.left) * (W / b.width); my = (e.clientY - b.top) * (H / b.height); }
        cvs.addEventListener('mousedown', (e) => { rel(e); down = true; });
        cvs.addEventListener('mousemove', rel);
        cvs.addEventListener('mouseup', () => down = false);
        cvs.addEventListener('mouseleave', () => down = false);

        api.setTag('STRIP IT');
        api.startTimer(60, () => { });
        function fail() { if (done) return; done = true; api.stopTimer(); api.shake(); setTimeout(() => api.fail(), 200); }
        function win() { if (done) return; done = true; api.stopTimer(); api.setTag('STRIPPED'); setTimeout(() => api.succeed(), 300); }

        function draw() {
            const now = performance.now(); const dt = Math.min(0.05, (now - last) / 1000); last = now;
            let onPart = null;
            if (!done) {
                if (down) for (const p of parts) if (!p.done && Math.hypot(mx - p.x, my - p.y) < p.r + 4) { onPart = p; break; }
                parts.forEach(p => {
                    if (p.done) return;
                    if (p === onPart) { p.prog += dt / unbolt; if (p.prog >= 1) { p.done = true; stripped++; api.sfx('latch'); api.setDots(n, parts.map(q => q.done ? 'done' : '')); if (stripped >= n) { win(); } } }
                    else p.prog = Math.max(0, p.prog - dt * 1.5);
                });
                heat = Math.min(1, heat + heatRate * dt);
                if (heat >= 1) { fail(); return; }
            }
            ctx.clearRect(0, 0, W, H);

            // car body
            ctx.fillStyle = 'rgba(255,255,255,0.05)';
            ctx.beginPath(); ctx.moveTo(carX, carY + carH); ctx.lineTo(carX + 30, carY + 18); ctx.lineTo(carX + carW - 50, carY + 18); ctx.lineTo(carX + carW, carY + carH); ctx.closePath(); ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.fillRect(carX + 60, carY + 24, carW - 130, 26);
            ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(carX, carY + carH); ctx.lineTo(carX + 30, carY + 18); ctx.lineTo(carX + carW - 50, carY + 18); ctx.lineTo(carX + carW, carY + carH); ctx.stroke();

            // parts
            parts.forEach(p => {
                if (p.done) { ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); return; }
                ctx.fillStyle = 'rgba(0,224,184,0.12)'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
                ctx.strokeStyle = acc; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.stroke();
                // bolt cross
                ctx.strokeStyle = acc; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(p.x - 5, p.y); ctx.lineTo(p.x + 5, p.y); ctx.moveTo(p.x, p.y - 5); ctx.lineTo(p.x, p.y + 5); ctx.stroke();
                if (p.prog > 0) { ctx.strokeStyle = suc; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.x, p.y, p.r + 4, -Math.PI / 2, -Math.PI / 2 + p.prog * Math.PI * 2); ctx.stroke(); }
            });

            // heat bar
            ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.font = '11px monospace'; ctx.textAlign = 'center'; ctx.fillText('STRIPPED ' + stripped + ' / ' + n, W / 2, 28);
            ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(40, H - 24, W - 80, 10);
            ctx.fillStyle = heat > 0.7 ? dng : 'rgba(255,140,0,0.85)'; ctx.fillRect(40, H - 24, (W - 80) * heat, 10);
            ctx.fillStyle = heat > 0.7 ? dng : 'rgba(255,255,255,0.5)'; ctx.font = '9px monospace'; ctx.textAlign = 'left'; ctx.fillText('HEAT — cops incoming', 40, H - 28);

            if (!done) loop = requestAnimationFrame(draw);
        }
        let loop = requestAnimationFrame(draw);
        return { destroy() { cancelAnimationFrame(loop); } };
    }
});
