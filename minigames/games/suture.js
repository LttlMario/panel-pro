MG.register('suture', {
    title: 'Suture',
    hint: 'Click each stitch when its ring shrinks into the green',
    run(api) {
        const diff = Math.max(1, Math.min(5, api.cfg.difficulty || 2));
        const W = 400, H = 280;

        const cvs = document.createElement('canvas');
        cvs.width = W; cvs.height = H;
        cvs.style.cursor = 'pointer';
        api.board.appendChild(cvs);
        const ctx = cvs.getContext('2d');

        const css = getComputedStyle(document.documentElement);
        const acc = (css.getPropertyValue('--accent') || '#00e0b8').trim();
        const suc = (css.getPropertyValue('--success') || '#39d98a').trim();

        const N = 4 + Math.floor(diff / 2); // 4..6
        const x0 = 50, x1 = W - 50, yMid = H / 2;
        const stitches = [];
        for (let i = 0; i < N; i++) {
            const x = x0 + (x1 - x0) * ((i + 0.5) / N);
            stitches.push({ x, y: yMid + (i % 2 === 0 ? -26 : 26), done: false });
        }
        let idx = 0, ring = 1, dirR = -1, done = false;
        const ringSpd = 0.012 + diff * 0.003;
        const band = Math.max(0.1, 0.26 - diff * 0.03);
        const lo = 0.18, hi = lo + band;

        api.setDots(N);
        function attempt(cx, cy) {
            if (done) return;
            const s = stitches[idx];
            if (Math.hypot(cx - s.x, cy - s.y) < 42 && ring >= lo && ring <= hi) {
                s.done = true; idx++; api.sfx('latch');
                api.setDots(N, stitches.map(st => st.done ? 'done' : ''));
                ring = 1; dirR = -1;
                if (idx >= N) { done = true; api.stopTimer(); api.setTag('CLOSED'); setTimeout(() => api.succeed(), 300); }
            } else { api.shake(); api.addTime(-1500); }
        }
        cvs.addEventListener('click', (e) => { const b = cvs.getBoundingClientRect(); attempt((e.clientX - b.left) * (W / b.width), (e.clientY - b.top) * (H / b.height)); });

        api.setTag('SUTURING');
        api.startTimer(Math.max(16, 28 - diff * 2), () => { if (!done) { done = true; api.stopTimer(); setTimeout(() => api.fail(), 200); } });

        function draw() {
            if (!done) { ring += ringSpd * dirR; if (ring < lo - 0.12) dirR = 1; if (ring > 1) { ring = 1; dirR = -1; } }
            ctx.clearRect(0, 0, W, H);

            ctx.strokeStyle = 'rgba(255,80,90,0.55)'; ctx.lineWidth = 6; ctx.beginPath();
            for (let x = x0 - 10; x <= x1 + 10; x += 14) { const yy = yMid + Math.sin(x * 0.25) * 4; x === x0 - 10 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy); }
            ctx.stroke();

            ctx.strokeStyle = acc; ctx.lineWidth = 2;
            stitches.forEach(s => { if (s.done) { ctx.beginPath(); ctx.moveTo(s.x, yMid - 26); ctx.lineTo(s.x, yMid + 26); ctx.stroke(); } });

            stitches.forEach((s, i) => {
                ctx.fillStyle = s.done ? suc : (i === idx ? '#fff' : 'rgba(255,255,255,0.3)');
                ctx.beginPath(); ctx.arc(s.x, s.y, 4, 0, Math.PI * 2); ctx.fill();
            });

            if (!done && idx < N) {
                const s = stitches[idx], inB = ring >= lo && ring <= hi;
                ctx.strokeStyle = 'rgba(57,217,138,0.3)'; ctx.lineWidth = (hi - lo) * 30;
                ctx.beginPath(); ctx.arc(s.x, s.y, 6 + ((lo + hi) / 2) * 30, 0, Math.PI * 2); ctx.stroke();
                ctx.strokeStyle = inB ? suc : acc; ctx.lineWidth = 2;
                ctx.beginPath(); ctx.arc(s.x, s.y, 6 + ring * 30, 0, Math.PI * 2); ctx.stroke();
            }

            if (!done) loop = requestAnimationFrame(draw);
        }
        let loop = requestAnimationFrame(draw);
        return { destroy() { cancelAnimationFrame(loop); } };
    }
});
