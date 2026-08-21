MG.register('diving', {
    title: 'Salvage Dive',
    hint: 'Move to grab the loot · surface to breathe before air runs out',
    run(api) {
        const diff = Math.max(1, Math.min(5, api.cfg.difficulty || 2));
        const W = 420, H = 300;

        const cvs = document.createElement('canvas');
        cvs.width = W; cvs.height = H;
        cvs.style.cursor = 'crosshair';
        api.board.appendChild(cvs);
        const ctx = cvs.getContext('2d');

        const css = getComputedStyle(document.documentElement);
        const acc = (css.getPropertyValue('--accent') || '#00e0b8').trim();
        const suc = (css.getPropertyValue('--success') || '#39d98a').trim();
        const dng = (css.getPropertyValue('--danger') || '#ff3b5c').trim();

        const need = 4 + diff;
        const surfaceY = 42;
        const drain = 0.05 + diff * 0.015, refill = 0.55;
        let air = 1, collected = 0, done = false, last = performance.now();
        const diver = { x: W / 2, y: surfaceY + 24, r: 9 };
        let mx = diver.x, my = diver.y, has = false;

        const items = [];
        for (let i = 0; i < need; i++) items.push({ x: 36 + Math.random() * (W - 72), y: surfaceY + 78 + Math.random() * (H - surfaceY - 120), got: false });

        cvs.addEventListener('mousemove', (e) => { const b = cvs.getBoundingClientRect(); mx = (e.clientX - b.left) * (W / b.width); my = (e.clientY - b.top) * (H / b.height); has = true; });

        api.setTag('DIVE');
        api.startTimer(Math.max(28, 46 - diff * 2), () => { if (!done) finish(collected >= need); });
        function finish(ok) { if (done) return; done = true; api.stopTimer(); setTimeout(() => ok ? api.succeed() : api.fail(), 250); }

        function draw() {
            const now = performance.now(); const dt = Math.min(0.05, (now - last) / 1000); last = now;
            if (!done) {
                if (has) { diver.x += (mx - diver.x) * 0.18; diver.y += (my - diver.y) * 0.18; }
                diver.x = Math.max(diver.r, Math.min(W - diver.r, diver.x));
                diver.y = Math.max(surfaceY - 6, Math.min(H - diver.r, diver.y));
                const atSurface = diver.y <= surfaceY + 16;
                air = Math.max(0, Math.min(1, air + (atSurface ? refill : -drain * (0.7 + diver.y / H)) * dt));
                if (air <= 0) { finish(false); return; }
                items.forEach(it => { if (!it.got && Math.hypot(diver.x - it.x, diver.y - it.y) < diver.r + 9) { it.got = true; collected++; api.sfx('beep'); api.setTag(collected + '/' + need); if (collected >= need) finish(true); } });
            }
            ctx.clearRect(0, 0, W, H);

            // water
            const grd = ctx.createLinearGradient(0, surfaceY, 0, H);
            grd.addColorStop(0, 'rgba(0,150,180,0.10)'); grd.addColorStop(1, 'rgba(0,40,80,0.22)');
            ctx.fillStyle = grd; ctx.fillRect(0, surfaceY, W, H - surfaceY);
            ctx.strokeStyle = 'rgba(0,224,184,0.4)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, surfaceY); ctx.lineTo(W, surfaceY); ctx.stroke();
            ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.font = '9px monospace'; ctx.textAlign = 'left'; ctx.fillText('SURFACE', 8, surfaceY - 4);

            // loot
            items.forEach(it => { if (it.got) return; ctx.fillStyle = '#ffd23f'; ctx.shadowColor = '#ffd23f'; ctx.shadowBlur = 10; ctx.fillRect(it.x - 7, it.y - 7, 14, 14); ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(it.x - 7, it.y - 1, 14, 3); });

            // diver
            ctx.fillStyle = acc; ctx.shadowColor = acc; ctx.shadowBlur = 12; ctx.beginPath(); ctx.arc(diver.x, diver.y, diver.r, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;

            // air bar
            ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(12, H - 18, W - 24, 8);
            ctx.fillStyle = air < 0.25 ? dng : suc; ctx.fillRect(12, H - 18, (W - 24) * air, 8);
            ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '9px monospace'; ctx.textAlign = 'left'; ctx.fillText('AIR  ·  LOOT ' + collected + '/' + need, 12, H - 22);

            if (!done) loop = requestAnimationFrame(draw);
        }
        let loop = requestAnimationFrame(draw);
        return { destroy() { cancelAnimationFrame(loop); } };
    }
});
