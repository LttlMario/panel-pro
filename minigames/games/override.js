MG.register('override', {
    title: 'Override',
    hint: 'SPACE / click when the marker hits the top notch',
    run(api) {
        const diff = Math.max(1, Math.min(5, api.cfg.difficulty || 2));
        const ringCount = 2 + Math.floor(diff / 1.3);
        const W = 320, H = 320, cx = W / 2, cy = H / 2;

        const cvs = document.createElement('canvas');
        cvs.width = W; cvs.height = H;
        cvs.style.cursor = 'pointer';
        api.board.appendChild(cvs);
        const ctx = cvs.getContext('2d');

        const rings = [];
        for (let i = 0; i < ringCount; i++) {
            rings.push({
                r: 50 + i * 38,
                ang: Math.random() * Math.PI * 2,
                spd: (0.02 + diff * 0.006) * (1 + i * 0.25) * (Math.random() < 0.5 ? 1 : -1),
                locked: false
            });
        }
        let active = ringCount - 1;
        const notch = -Math.PI / 2;
        const tol = Math.max(0.12, 0.3 - diff * 0.03);
        let corruption = 0;
        const corrSpeed = 0.0016 + diff * 0.0006;
        let done = false;

        api.setDots(ringCount);

        function attempt() {
            if (done || active < 0) return;
            const ring = rings[active];
            let d = Math.abs(((ring.ang - notch) % (Math.PI * 2)));
            d = Math.min(d, Math.PI * 2 - d);
            if (d < tol) {
                ring.locked = true; ring.ang = notch;
                const st = []; for (let i = 0; i < ringCount; i++)
                    st[i] = rings[i].locked ? 'done' : (i === active - 1 ? 'active' : '');
                api.setDots(ringCount, st.reverse());
                active--;
                if (active < 0) { done = true; api.stopTimer(); api.setTag('OVERRIDDEN'); setTimeout(() => api.succeed(), 400); }
            } else {
                api.shake();
                ring.spd *= 1.25;
                corruption = Math.min(1, corruption + 0.12);
            }
        }
        function key(e) { if (e.code === 'Space') { e.preventDefault(); attempt(); } }
        document.addEventListener('keydown', key);
        cvs.addEventListener('click', attempt);

        api.setTag('OVERRIDING');
        api.startTimer(Math.max(16, 34 - diff * 3), () => fail());
        function fail() { if (done) return; done = true; document.removeEventListener('keydown', key); api.stopTimer(); setTimeout(() => api.fail(), 200); }

        function draw() {
            if (!done) {
                corruption = Math.min(1, corruption + corrSpeed);
                if (corruption >= 1) { fail(); return; }
            }
            ctx.clearRect(0, 0, W, H);
            const acc = (getComputedStyle(document.documentElement).getPropertyValue('--accent') || '#00e0b8').trim();
            const suc = (getComputedStyle(document.documentElement).getPropertyValue('--success') || '#39d98a').trim();
            const dng = (getComputedStyle(document.documentElement).getPropertyValue('--danger') || '#ff3b5c').trim();

            ctx.fillStyle = 'rgba(255,255,255,0.06)';
            ctx.beginPath(); ctx.moveTo(cx, cy);
            ctx.arc(cx, cy, rings[ringCount - 1].r + 16, notch - tol, notch + tol); ctx.closePath(); ctx.fill();
            ctx.strokeStyle = acc; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(cx, cy - 30); ctx.lineTo(cx, cy - (rings[ringCount - 1].r + 20)); ctx.stroke();

            rings.forEach((ring, i) => {
                if (!ring.locked && !done) ring.ang += ring.spd;
                const isActive = i === active;
                ctx.strokeStyle = ring.locked ? suc : (isActive ? acc : 'rgba(255,255,255,0.15)');
                ctx.lineWidth = isActive ? 4 : 2;
                ctx.shadowColor = ring.locked ? suc : (isActive ? acc : 'transparent');
                ctx.shadowBlur = (ring.locked || isActive) ? 10 : 0;
                ctx.beginPath(); ctx.arc(cx, cy, ring.r, 0, Math.PI * 2); ctx.stroke();
                const ix = cx + Math.cos(ring.ang) * ring.r;
                const iy = cy + Math.sin(ring.ang) * ring.r;
                ctx.fillStyle = ring.locked ? suc : (isActive ? '#fff' : 'rgba(255,255,255,0.4)');
                ctx.beginPath(); ctx.arc(ix, iy, isActive ? 8 : 5, 0, Math.PI * 2); ctx.fill();
                ctx.shadowBlur = 0;
            });

            ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(40, H - 16, W - 80, 6);
            ctx.fillStyle = corruption > 0.7 ? dng : 'rgba(255,140,0,0.8)';
            ctx.fillRect(40, H - 16, (W - 80) * corruption, 6);

            loop = requestAnimationFrame(draw);
        }
        let loop = requestAnimationFrame(draw);
        return { destroy() { cancelAnimationFrame(loop); document.removeEventListener('keydown', key); } };
    }
});
